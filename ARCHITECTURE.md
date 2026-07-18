# TXPPS TX-80 — Architecture

TX-80 is an original dual-layer expressive performance synthesizer built on
the proven TX27 web-synth foundation. It is NOT an emulation of any hardware
instrument and carries no third-party branding, presets, or panel artwork.

## Repository layout

- `src/lib/synth/` — reusable, product-neutral boundary (unchanged):
  `SynthEngine<State>` contract + `SynthRuntime` activation coordinator.
- `src/lib/tx80/` — the TX-80 product:
  - `types.ts` — `Tx80Patch` state model, INIT patch, normalization/cloning
  - `parameters.ts` — **authoritative registry** (79 parameters; the only
    place ranges/defaults/steps/choices live) + get/set with coercion
  - `presets.ts` — original factory presets with permanent IDs
  - `storage.ts` — user presets / settings / UI-mode persistence
    (localStorage, versioned, graceful failure)
  - `midi.ts` — guarded Web MIDI input manager
  - `productAdapter.ts` — `TX80ProductEngine implements SynthEngine<Tx80Patch>`
    (+ ribbon extensions) and the `TX80_PRODUCT` manifest
  - `engine/engine.ts` — the Web Audio engine (graph, buses, LFOs, effects,
    lifecycle, allocator)
  - `engine/voice.ts` — `Tx80Voice` (one musical voice) and `Tx80SubVoice`
    (one layer's contribution to that voice)
- `src/components/tx80/` — product UI: `LayerPanel`, `ParamKnob`
  (registry-bound knob), `Ribbon`, dialogs, `useTx80Presets`
- `src/routes/index.tsx` — the TX-80 application shell
- `src/routes/tx27.tsx` — the untouched TX27 instrument (moved from `/`)
- Shared/reused components: `Keyboard`, `PerfStrip`, `Knob`, `TxSelect`,
  `PatchDialogShell`/`PatchConfirmDialog`, startup diagnostics, PWA module.

## Audio lifecycle

Identical discipline to TX27 (the code paths are proven in its Gate 2
validation and re-verified for TX-80 by e2e):

- **No AudioContext at module import or first render.** The engine object is
  constructed lazily inside `SynthRuntime.createEngine` on the first
  activation gesture; the AudioContext is created inside `engine.start()`.
- Activation begins **synchronously inside the user gesture** (key press,
  POWER, preset load, PLAY-mode entry) — required by iOS/Safari.
- One AudioContext singleton per engine; one engine per runtime; the runtime
  disposes and rebuilds only when the context died (`closed`).
- Every context-state await is **bounded** (`withTimeout`); a hanging
  `resume()` can never wedge the session. iOS's non-standard "interrupted"
  state is treated as resumable.
- Repeated activation attempts share one in-flight promise (Strict Mode /
  gesture spam safe). Notes played during activation are queued and flushed
  (first-note preservation) or dropped with visible RETRY UI on failure.
- POWER OFF silences voices, ramps the master bus, then suspends; the graph
  is kept for cheap resume. `panic()` is instant.
- The UI renders and stays fully usable if audio fails; a compact RETRY
  strip appears (no full-screen modal).

## Signal path

```
noteOn(note, vel)
  → voice allocator (poly stack / steal oldest, or solo legato retune)
    → Tx80Voice
        ├─ Layer I Tx80SubVoice ─┐    (only enabled layers instantiate)
        └─ Layer II Tx80SubVoice ┤
                                 ▼
     [per sub-voice] mainOsc (saw|pulse*|tri|sine) ── oscLevel gain ─┐
                     subOsc (square, −1 oct) ──────── subLevel gain ─┼─► lowpass filter
                     noise (shared looped buffer) ── noiseLevel gain ┘   (cutoff·keytrack, Q,
                                                                          ADSR on detune ±cents,
                                                                          LFO cutoff bus additive)
                     → amp ADSR gain → velocity/headroom gain → layer voice bus
  layer voice bus → layer level (0 when muted) → balance crossfade → StereoPanner → mix bus
  mix bus → tremolo (LFO amp destination, compensated base)
  → Chorus (2-tap stereo) → Delay (damped feedback ≤ 0.85) → Reverb (lazy cached IR)
  → DynamicsCompressor safety limiter → masterGain → Analyser (real meter) → destination
```

\* pulse = sawtooth → comparator WaveShaper; duty cycle comes from a
per-layer `pwConst` ConstantSource (offset = 1 − 2·pw) summed with the
global `pwModBus`, giving audio-rate PWM without rebuilding nodes.

### Shared modulation buses (created once, never rebuilt)

- `pitchBendSource` (cents) — global wheel/strip bend
- `ribbonSource` (cents) — ribbon offset
- `pitchModBus` — sums LFO-pitch depth gains + mod-wheel vibrato
- `cutoffModBus` (cents → every sub-voice `filter.detune`)
- `pwModBus` (→ every pulse shaper input)

Voices connect to these at construction and disconnect per-AudioParam on
dispose. Bend range changes, ribbon movement and LFO destination changes
never touch live voices; destination switches are pure connect/disconnect on
static nodes (no node churn during control drags).

## Voice allocation

- **Poly:** every noteOn creates a coordinated `Tx80Voice` (both enabled
  layers). Stacked presses of the same note coexist; `noteOff` releases the
  most recent active instance (LIFO). Stealing: when `polyphony` is reached
  the OLDEST sounding voice fast-fades (40 ms) — both its layers together.
- **Solo:** one voice, last-note priority. Overlapping notes legato-retune
  (no envelope retrigger) using the active travel mode; releasing returns to
  the most recent still-held note. Detached notes start fresh voices.
- **Sustain:** pedal-down defers releases per note WITH COUNTS; pedal-up
  releases deferred instances oldest-first while keeping one sounding voice
  per still-held key.
- Voice-mode changes release all voices (predictable, no orphan allocator
  state). Reaper interval disposes finished voices; panic hard-stops all.

## Portamento vs glissando

`pitchTravel.mode` (`off` | `porta` | `gliss`) + `pitchTravel.time`
(seconds per octave). Policy (documented behavior):

- **Portamento:** `exponentialRamp` from the previous pitch — smooth,
  duration ∝ interval, **exact arrival** at the ramp end.
- **Glissando:** discrete chromatic `setValueAtTime` steps (min 20 ms/step),
  ascending or descending, the final step lands exactly on the target. Not a
  continuous ramp.
- Poly policy: each new voice travels from the last played pitch. Solo:
  overlap travels; interruption cancels scheduled values, holds the current
  frequency, and re-schedules to the new target.

## Ribbon

Relative-origin controller: first touch is the reference; movement bends
around it (no jump on touch). One owning pointer (first wins), pointer
capture, clamped past bounds; release/cancel/blur/hidden all end the drag.

- `pitch` — continuous cents, springs back to exactly 0 (linear ramp)
- `gliss` — quantized whole semitones (audibly stepped), springs back
- `hold` — continuous, keeps the last value (panic/preset load recentre it)

Range: ±2/5/7/12/24 semitones (patch parameter).

## LFOs

Two always-running LFOs (sine/tri/square/saw) with per-destination scaling:
pitch ±cents, filter ±cents, amp (compensated tremolo, never above unity),
pw duty swing, pan, layer balance (anti-phase, floor-guarded against phase
flips). Destination changes disconnect the depth gain and reconnect it to
the new bus — clean, no residual offsets (buses output 0 with no input).

## Presets

Factory presets ship in the bundle (permanent `tx80-factory-*` IDs; safe
default = first entry). User presets: SAVE AS / REN / DEL with themed
dialogs, stable generated IDs, versioned `tx80-user-presets` payload,
last-selection restore. Storage failures degrade gracefully (session keeps
working; SETUP shows a notice). Loading a preset releases held notes first
and recentres the ribbon; pitch-bend position (a live physical control) is
kept. Full patch serialization is exercised by unit round-trip tests.

## MIDI

`Tx80Midi` (guarded): created only when the user presses ENABLE MIDI in
SETUP. Handles note on/off + velocity, CC1 mod wheel, CC64 sustain, pitch
bend, CC120/123 all-notes-off; `statechange` re-wires inputs and releases
all notes on disconnect. Unsupported browsers / denial produce a status
line, never a crash. MIDI is never required for basic use.

## Responsive strategy

One stateful component tree; responsive CSS + two `matchMedia` signals
(portrait, phone-width) — no per-orientation UI trees. Phone editing uses a
six-tab strip (L·I, L·II, PERF, MOD, FX, OUT); desktop uses a 12-column
grid. The performance area (ribbon + pitch/mod strips + octave/sustain +
keyboard) is pinned below the scrollable editor area in FULL, fills the
screen in PLAY, and unmounts in EDIT (after releasing pointer-owned notes).
Rotation keeps engine/patch/context; the keyboard releases pointer-owned
notes when its visible range changes so nothing sticks.

## PWA

Unchanged foundation: production-only SW registration, content-hash cache
version + build id injected post-build, no skipWaiting (updates apply on
next launch), old-cache cleanup, build-mismatch handshake with one guarded
reload. Manifest now carries TX-80 identity.

## Stack decisions vs the brief

- **Zustand:** not introduced. The imported foundation manages state with
  React state + refs; TX-80 follows the house pattern (single authoritative
  patch object + registry setters). No duplicated ranges anywhere.
- **IndexedDB/idb:** not introduced. The foundation's localStorage layer is
  proven on-device; TX-80 reuses that discipline with its own keys.
- No new dependencies of any kind were added.
