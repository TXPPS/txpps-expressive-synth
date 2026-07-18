# TXPPS TX-80 — Build Plan

A real, playable dual-layer polyphonic web synthesizer. Local-first, no backend. I'll work in milestones and verify each in the live preview before continuing.

## Stack

- TanStack Start (existing template), React 19, TypeScript, Tailwind v4
- Web Audio API (no audio libraries — direct nodes for control + size)
- Zustand for app state (small, fast, no ceremony)
- IndexedDB (via `idb`) for user presets; bundled factory presets in code
- Pointer Events for unified mouse/touch/pen
- PWA: manifest + guarded service worker (disabled in Lovable preview per skill)

## Architecture

```
src/
  audio/
    context.ts           AudioContext singleton + resume/suspend lifecycle
    engine.ts            Top-level engine: voices, layers, effects, master
    voice.ts             Per-note voice (Layer I + Layer II sub-voices)
    layer.ts             Osc + sub + noise + filter + 2 envelopes per layer
    modulation.ts        LFO1/LFO2 with routable destinations
    effects.ts           Chorus → Delay → Reverb → Limiter chain
    portamento.ts        Continuous glide scheduler
    glissando.ts         Stepped semitone glide scheduler
    ribbon.ts            Ribbon-mode adapter driving pitch/glide
    midi.ts              Guarded Web MIDI
  state/
    store.ts             Zustand: patch params, UI mode, transient perf state
    params.ts            Full parameter schema + defaults + ranges + units
    presets.ts           Factory presets + IndexedDB user preset CRUD
  components/
    Knob.tsx  Slider.tsx  Switch.tsx  Selector.tsx  Meter.tsx
    Panel.tsx  Section.tsx
    Keyboard.tsx         Multitouch pointer keyboard, adaptive range
    Ribbon.tsx           Pointer-capture ribbon w/ modes
    PerformanceStrip.tsx Pitch/mod/sustain/panic
    LayerPanel.tsx       Reused for Layer I / Layer II
    ModPanel.tsx  FxPanel.tsx  MasterPanel.tsx  PresetBar.tsx
    Header.tsx           Brand + mode tabs (FULL/EDIT/PLAY/READY/PANIC)
  routes/
    index.tsx            Main synth surface
    __root.tsx           Head metadata + PWA links
  pwa/
    register.ts          Guarded SW registration (skip in preview/dev)
  styles.css             TXPPS design tokens (dark, phosphor-green accents but original palette)
public/
  sw.js  manifest.webmanifest  icons
```

## Milestones

1. **Foundation & shell** — Design tokens, responsive layout skeleton (desktop/tablet/phone × portrait/landscape) with placeholder panels, header, keyboard footprint, ribbon footprint. Wire Zustand store scaffolding.
2. **Audio lifecycle + Layer I playable** — AudioContext resume flow, voice allocator, Layer I osc→filter→VCA with AMP+FILT envelopes, keyboard triggers real polyphonic sound. Panic works.
3. **Layer II independent** — Duplicate layer path, independent params, layer mix + pan, verify layers isolate and combine.
4. **Portamento, glissando, ribbon, perf controls** — Continuous glide, true stepped glissando, pointer-capture ribbon (continuous / stepped / trigger modes), pitch/mod/sustain wheels.
5. **Modulation, FX, presets, MIDI, safety** — 2 LFOs with routable destinations (clean reset on target change), chorus/delay/reverb chain, factory + user presets in IndexedDB, guarded Web MIDI, limiter.
6. **Responsive polish** — Verify all four layouts in preview (desktop, tablet portrait/landscape, phone portrait/landscape), orientation change without state loss.
7. **PWA + final validation** — Manifest, guarded SW (preview-safe kill guards per PWA skill), full signal-path validation table in code comments, manual test pass in preview, final report.

## Design direction

Original TXPPS identity — not a CS-80 skin, not a TX27 reskin. Deep charcoal panels, warm off-white silkscreen labels, restrained amber + phosphor-green indicators, tactile shaded knobs, subtle brushed-metal fader tracks. Display font: a geometric mono for readouts (JetBrains Mono), humanist sans for labels (Inter Tight). No purple, no gradients-on-white, no decorative glow spam.

## Non-goals for v1

- JSON preset import/export (add only if stable at end of M5)
- Velocity from touch pressure (approximate from key-hit Y only)
- Sample-accurate MPE
- Arpeggiator / sequencer

## Verification per milestone

- `bun run build` clean
- Preview loads without console errors
- Milestone-specific manual test (play a note, switch preset, rotate device, etc.)
- Do not claim "done" until the preview exercises the path

## Known risks

- iOS Safari AudioContext quirks — mitigated by explicit resume-on-first-gesture
- Reverb without impulse response — use a synthesized noise-burst IR generated at boot
- Service worker in Lovable preview — hard-disabled by hostname guard
- Scope: this is a large build; each milestone will be one focused turn so you can catch drift early

Approve to start Milestone 1. 

Approved to begin **Milestone 1**, subject to the following binding requirements.

**1. Preserve the milestone sequence**

Proceed incrementally and do not skip ahead.

Do not rebuild, reset, replace, or change the project stack between milestones unless a verified technical blocker requires it.

At the end of each milestone:

- run the live preview
- inspect the console
- report what actually works
- identify anything unverified
- fix blocking regressions before continuing

You do not need to wait for separate approval after every minor internal step, but do not begin the next major milestone until the current milestone’s completion conditions are satisfied.

**2. Milestone 1 must establish the final responsive structure**

The shell may use temporary control placeholders, but it must not be a disposable mockup.

The Milestone 1 layout must establish the real production structure that later audio controls will inhabit.

Use the attached TX27 screenshots as the primary reference for responsive behavior, particularly:

- phone portrait
- phone landscape
- tablet portrait
- tablet landscape
- desktop
- keyboard sizing
- ribbon placement
- pitch and modulation control placement
- section containment
- safe-area handling
- orientation changes
- avoiding overlapping controls
- avoiding controls hanging outside their assigned panels

TX-80 should share the practical responsive discipline of TX27 while maintaining its own visual identity.

Do not create a desktop-only panel and simply shrink it for phones.

**3. No decorative controls**

Temporary placeholders must be visibly identified as temporary during Milestone 1.

Once audio implementation begins, every visible knob, switch, slider, key, ribbon area, button, selector, meter, and preset control must connect to real state and real behavior.

Do not retain decorative or disconnected controls in the finished interface.

**4. AudioContext must be lazy and gesture-safe**

Do not create or resume AudioContext during module loading, application mounting, or page boot.

Create or resume the audio engine through a guarded user interaction.

The interface must render even if:

- audio initialization fails
- autoplay is blocked
- MIDI is unavailable
- IndexedDB fails
- the service worker fails

Do not use a full-screen blocking power overlay.

Use a compact, recoverable audio-status control integrated into the interface.

Preserve the user’s first intended keyboard note where technically practical.

**5. Reverb impulse generation must not block startup**

Do not generate an expensive synthesized impulse response synchronously during page boot.

Create it lazily when:

- audio is initialized, or
- reverb is first enabled

Cache and reuse it.

Impulse generation must not block the UI, delay initial rendering, or cause the first note to be lost.

**6. Effects routing is provisional**

The proposed:

Chorus → Delay → Reverb → Limiter

routing is acceptable as an initial stable implementation, but do not treat it as irrevocably locked.

Document the actual routing and verify:

- bypass behavior
- wet/dry behavior
- feedback safety
- no connection cycles
- no duplicate connections
- no excessive gain accumulation
- no node leaks
- correct preset restoration

The limiter belongs at the final master-output safety stage, not inside an individual layer.

**7. Dual-layer voice coordination**

Each played musical note should normally create one coordinated voice containing:

- Layer I sub-voice
- Layer II sub-voice

The two layers must share note identity, note-off, sustain, stealing, and lifecycle cleanup while maintaining independent synthesis parameters.

Avoid two unrelated voice allocators that can drift apart, release differently, or steal different notes.

Layer I and Layer II must be independently:

- enabled
- edited
- heard
- muted
- tuned
- filtered
- enveloped
- panned
- balanced

**8. Portamento and glissando must remain distinct**

Portamento:

- continuous pitch movement
- smooth arrival at the exact target
- no audible semitone stepping

Glissando:

- discrete chromatic semitone steps
- works ascending and descending
- arrives exactly at the target
- can be interrupted safely by a new target

Do not implement both features through one pitch-ramp function with different labels.

**9. Ribbon implementation requirements**

The ribbon must use Pointer Events and pointer capture.

It must handle:

- first touch
- drag
- leaving the visual bounds
- pointer release
- pointer cancellation
- orientation change
- left-to-right movement
- right-to-left movement
- phone portrait
- phone landscape

No ribbon interaction may leave:

- a stuck note
- a stuck pitch offset
- an active glide
- an unreleased pointer state

**10. Keyboard requirements**

The keyboard must support true simultaneous pointer identities.

Do not rely on one shared mouse-style pressed state.

Each active pointer must independently track:

- pointer ID
- note
- note-on state
- note-off or cancellation
- movement between keys, if supported

Every exit path must release the correct note.

Include a reliable panic/all-notes-off control from the first playable milestone.

**11. Preset storage must degrade gracefully**

IndexedDB is approved.

However, IndexedDB failure must not prevent the synth from loading or playing.

Factory presets must remain available in memory.

User preset controls should show a clear non-blocking warning if local storage is unavailable.

Do not add any backend, account system, API key, authentication, or cloud storage.

**12. PWA safety**

The service worker must remain disabled in Lovable preview and normal development mode.

Do not allow a stale service worker to cache broken development bundles or produce a blank preview.

Enable service-worker registration only in an appropriate production environment with:

- versioned cache handling
- update behavior
- stale-cache cleanup
- graceful registration failure

**13. Parameter schema must be authoritative**

src/state/params.ts should become the canonical parameter registry.

Each parameter should define:

- stable ID
- layer or global scope
- label
- type
- minimum
- maximum
- default
- unit
- step or enum values
- smoothing behavior
- preset serialization status
- audio-engine destination

Do not duplicate parameter ranges independently across UI components, state, presets, and DSP.

**14. Validation documentation**

Do not place the full parameter or signal-path validation matrix only inside code comments.

Create dedicated project documents such as:

- [ARCHITECTURE.md](http://ARCHITECTURE.md)
- PARAMETER_[MATRIX.md](http://MATRIX.md)
- MANUAL_[QA.md](http://QA.md)
- CURRENT_[STATUS.md](http://STATUS.md)

Code comments may explain local implementation decisions, but the authoritative validation record should be readable outside the source code.

**15. Honest verification**

A successful bun run build does not prove that the synthesizer works.

For every milestone distinguish:

- implemented
- build-verified
- preview-verified
- manually exercised
- device-tested
- unverified
- defective

Do not claim that audio, multitouch, orientation changes, MIDI, IndexedDB, or PWA behavior works unless the relevant path was actually exercised.

**Milestone 1 completion conditions**

Milestone 1 is complete only when:

1. The Lovable preview visibly loads.
2. There are no fatal console errors.
3. The final responsive application structure is present.
4. Layer I and Layer II have clearly defined independent panel regions.
5. The shared modulation, effects, master, preset, ribbon, performance, and keyboard regions are established.
6. Desktop layout fits without panel overlap.
7. Phone portrait has no horizontal page scrolling.
8. Phone landscape prioritizes keyboard, ribbon, and performance controls.
9. Tablet layouts reflow intentionally.
10. Rotation retains UI state.
11. No service worker interferes with preview.
12. A Milestone 1 report lists files changed, preview result, console result, layouts inspected, and remaining risks.

Proceed with Milestone 1 under these conditions.