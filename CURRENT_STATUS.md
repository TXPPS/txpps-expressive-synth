# Current Status — TXPPS TX-80

**Repository:** TXPPS-TX-80 (branch `claude/tx80-synth-completion-nkt36a`)
**Baseline:** TXPPS TX27 Replit Refinement (Gate 2 state), imported as the
first commit and preserved intact.

## Current-state audit (performed before implementation, 2026-07-18)

The delivered project ZIP contained the **TXPPS TX27 FM synthesizer** at its
verified Gate 2 state. Audit findings against the task's claims:

- **No TX-80 code existed.** There were no Layer I/II panels, no ribbon, no
  dual-layer parameter registry, no Zustand store, and no TX-80 route,
  documentation, or assets anywhere in the ZIP. The "approved Milestone 1
  TX-80 shell" could not be verified because it was not present.
- What DID exist and verify cleanly (bun install / `tsc --noEmit` /
  21 vitest tests / production build + SW precache injection, all green on
  import):
  - the product-neutral `SynthEngine<State>` boundary (`src/lib/synth/`)
  - the `SynthRuntime` gesture-gated activation coordinator
  - the TX27 product (engine, registry, presets, patch library, UI)
  - genuinely multitouch `Keyboard`, pointer-captured `PerfStrip`, `Knob`,
    `TxSelect`, themed dialogs with focus traps
  - the TXPPS design system (`src/styles.css`), PWA manifest + versioned
    service worker with production guard, Playwright e2e harness
- State is React `useState` + refs (the TX27 pattern) — **not Zustand**. The
  existing pattern was kept; introducing Zustand would have been a rewrite
  for zero functional gain.
- Persistence is **localStorage** (the proven TX27 storage layer pattern),
  not IndexedDB/idb. TX-80 uses the same discipline (versioned payloads,
  graceful failure, factory presets never depend on storage). Deviation from
  the "IndexedDB via idb" expectation is deliberate and documented.

**Decision:** build TX-80 as a new product on the existing foundation, in the
same repository, preserving all TX27 code. The TX27 instrument remains fully
working at `/tx27`; TX-80 is the root route `/`.

## What is implemented and verified (TX-80)

All verification below is **automated evidence** (unit + real-browser e2e
against the production build served by `wrangler dev`). Perceptual sound
quality is NOT claimed — see MANUAL_QA.md.

- **Verified (unit, 32 tests):** TX-80 parameter registry (79 parameters:
  unique stable IDs, defaults resolve against INIT, layer independence,
  clamping/coercion, serialization round-trip), patch normalization,
  factory-preset round-trip + stable IDs, plus all 21 pre-existing TX27
  foundation tests.
- **Verified (browser, 48 e2e tests, Chromium desktop + Pixel 7 + Galaxy
  Tab S4 portrait/landscape emulation):**
  - cold launch arms without error; gesture-gated audio start; first-note
    preservation; rapid-activation dedup; power off → reconnect;
    background/visibility note release; panic
  - engine identity `tx80.dual2`, running AudioContext, **real signal at the
    master analyser** from a held note and clean decay after release
  - chord → one coordinated voice per note; repeated same-note presses stack
    and release one-for-one (LIFO); voice stealing caps at the configured
    polyphony; solo mode holds one voice through legato overlap and returns
    to the held note
  - portamento and glissando modes play and land cleanly; LFO destination
    cycling (FILTER/AMP/PAN/BALANCE/PW/PITCH) rewires without errors;
    Layer II enable/disable is independent of Layer I
  - preset switching while holding a note releases cleanly; ribbon drag +
    release leaves no stale state
  - presets: parameter → SAVE AS → localStorage payload → reload survival;
    saved preset restored as the active patch after reload; delete; factory
    navigation; settings stored separately from patches
  - PWA: service worker registers/controls, precache populated, offline
    reload usable, same-origin-only requests, content-hash cache version +
    build id injected, old-cache cleanup present
  - responsive: no horizontal page scroll, power/panic/preset/ribbon/keyboard
    within viewport, SETUP dialog contained — on all four emulated
    phone/tablet orientations
- **Verified (build tooling):** `tsc --noEmit` clean; ESLint clean on all new
  TX-80 files; production build + SW precache injection green.

## Environment-limited (NOT verified here)

- WebKit/iPhone emulation projects and the Edge channel project require
  browsers not installed in this container (only Chromium is available).
  The specs remain in the repo and run where those browsers exist.
- Physical-device validation (iOS Safari, installed PWA, screen-lock
  recovery, real multitouch) — see MANUAL_QA.md.
- **Anything audible.** This environment cannot hear audio. Graph
  construction, analyser activity, voice lifecycle and parameter paths are
  verified; sound quality, musical balance of factory presets, portamento/
  glissando feel, and effect character require human listening.

## Known unresolved / accepted limitations

- Waveform and envelope edits apply to NEW notes only (continuous params —
  tuning, levels, filter, pan, PW — do retarget sounding voices). Standard
  synth behavior, documented in ARCHITECTURE.md.
- Pulse wave uses a comparator-shaped sawtooth (2× oversampled); some
  aliasing at extreme pitches is expected at this stage.
- Heavy balance modulation lifts the quieter layer's floor (anti-phase-flip
  guard) — documented trade-off.
- The pre-existing global lint noise in legacy TX27 files (CRLF formatting)
  is unchanged, per the repo's own instruction not to mass-format.
- `randomizePatch` exists for TX27 only; TX-80 has INIT instead of RND.
- JSON preset import/export is not implemented for TX-80 (optional per the
  brief; the TX27 library keeps its own).

## TX27 (unchanged behavior, new path)

The complete TX27 instrument moved from `/` to `/tx27` (route path + title
only; no functional changes). Its storage keys are untouched, so existing
user patches keep working.
