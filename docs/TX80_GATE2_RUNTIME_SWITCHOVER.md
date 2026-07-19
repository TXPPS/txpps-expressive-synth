# Gate 2 — Authoritative Runtime Switchover and Voice Ownership Repair

Branch `feat/gate2-runtime-switchover` (from Gate 1 head `64a4c37`).
Approved scope: replace the live audio path with the transplanted
synth-core runtime behind the existing UI/state; no visual or state-
architecture changes.

## Old live path (retired at this gate)

`Keyboard.tsx` → `useAudioEngine` → `getAudioEngine()` (`src/audio/engine.ts`
singleton) → `VoiceManager` (`Map<midiNote, Voice>`) → `Voice`/`ADSREnvelope`
→ per-manager master gain → destination. Defects (audit-verified): release
scheduling never cancelled pending ramps (deterministic stuck voices on
sub-55 ms presses), `cleanup()` had no call sites (no oscillator ever
stopped outside panic), un-awaited init dropped the cold first note, and a
failed init latched permanently.

## New live path

`Keyboard.tsx` (unchanged) → `useAudioEngine` (rewritten, the ONLY changed
runtime-facing app file) → `SynthRuntime` (`src/synth-core/runtime/`) →
`TX80ProductEngine` → `TX80Engine` (dual-layer voices, counted ownership,
LIFO same-note release, fast-fade oldest stealing, counted sustain, 200 ms
reaper with per-AudioParam disconnects, chorus→delay→reverb→limiter→
analyser) → one `AudioContext`.

Parameters: Zustand store (authoritative ids) → hook diff → `mapping.ts`
(direct/derived translation) → `engine.setParameter`; preset-scale changes
(>24 ids) apply as one `loadState`. On every `ready` transition the engine
is reconciled with the current store patch and sustain state BEFORE queued
notes flush.

## Ownership model

- **Press identity:** one entry per pointerId in the Keyboard's
  per-pointer map (unchanged component) → one noteOn/noteOff pair per
  physical press. Two pointers on one key are two presses.
- **Engine identity:** per-note press COUNTS with LIFO instance release;
  each voice carries a unique generation id; the reaper validates per-voice
  end times, so stale releases/timers cannot touch recycled voices; stolen
  voices are already inactive when their press is later released (no-op).
- **Sustain:** store toggle → engine counted deferral; pedal-up releases
  deferred instances oldest-first while keeping still-held presses.
- **Hook mirror:** `heldRef` (midi→count) exists ONLY for blur/visibility
  cleanup; blur or hidden releases all forwarded presses and temporarily
  lifts sustain, restoring the user's sustain setting on return.

## First-note solution

`handleNoteOn` registers the press immediately (`SynthRuntime.playNote`):
activation starts synchronously inside the gesture, the note is stored in
the pending map, and flushes when the context is confirmed running.
`releaseNote` during startup cancels the pending entry — a fast cold tap
produces neither a ghost nor a stuck note (regression-tested). A failed
activation publishes `failed` and the next gesture retries (the in-flight
promise clears on settle).

## Lifecycle states

SynthRuntime phases `idle | starting | recovering | ready | suspended |
failed | disposed` map onto the store's `audioStatus`
(`ready→running`, `recovering→starting`, `disposed→idle`); the existing
Header/pill UI renders them unchanged.

## Quarantine and singleton proof

`src/audio/` remains in the tree, unmodified, with **zero import paths**
(grep-verified; the only importer was this hook). Dev-only instrumentation
(`installDevContextGuard`) counts AudioContext constructions and asserts
the singleton; the shipped read-only `window.__TX80_DIAG` exposes context/
engine counters, phase, voice counts and pending notes; `__TX80_PEAK`
exposes the master analyser. E2e asserts: synth-core modules present in
the live dev module graph, **no `/src/audio/` module ever loads**, exactly
1 context and 1 engine after activation. Production bundle: old-engine
marker strings absent (tree-shaken); `tx80.dual2` present.

## Files modified in this gate

- `src/hooks/useAudioEngine.ts` — full rewrite (the switchover).
- `playwright.config.ts`, `tests/e2e/gate2-runtime.e2e.ts` — NEW browser
  regression layer (20 scenarios; CDP touch for true multi-pointer).
- `package.json`/`package-lock.json` — `@playwright/test` devDependency.
- `CURRENT_STATUS.md`, this document.
- NOT touched: all visual components, store, params registry, mapping
  layer, routes, CSS, `src/audio/` (quarantined), `src/synth-core/` donor
  modules.

## Test results (this container)

`npm ci` ✓ · `npm run typecheck` ✓ · `npm run test` 28/28 ✓ ·
`npm run lint` clean on changed files ✓ · `npm run build` ✓ ·
Playwright **20/20** ✓ — cold first note (analyser-active voice), cold
fast tap (no ghost/stuck), basic on/off, alternating spam, same-key spam
(osc start/stop delta returns to the persistent-LFO baseline), same-note
two-pointer stacking + one-for-one release, slide, pointercancel,
lostpointercapture, blur, hidden, stealing at the polyphony cap +
generation-safe stolen release, sustain with repeated notes, panic
(voices+pending+ownership cleared, playable after), dual-layer
coordination (4 oscillators, ONE voice per press), stale-tail immunity for
a fresh held voice, octave-change release, duplicate-pointerdown guard,
module-graph/singleton proof, no horizontal overflow. Console clean
(only dev-tooling resource noise filtered).

## Human validation still required

Audible quality (this container is silent), real multitouch on physical
devices, iOS Safari behavior, and the manual checkpoint sequence in the
gate report.

## Rollback

`git checkout feat/gate1-synth-core-transplant` (or revert the Gate 2
commit). Inside the branch, re-pointing `src/hooks/useAudioEngine.ts` to
the quarantined `src/audio` engine restores the old path in one file.

## Remaining Gate 6 mapping decisions (unchanged from Gate 1)

`osc.pwm`, `filt.type`, `filt.drive`, `layer.modAmt`, `master.tune`
(unmapped with dispositions); lossy: tune→coarse rounding, PW fold, LFO
`s&h`→square, ribbon `trigger`→continuous fallback, rate/polyphony
snapping.
