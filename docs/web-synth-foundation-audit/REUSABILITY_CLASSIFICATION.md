# Reusability Classification

**Project:** TXPPS TX27 (`TXPPS-TX27-FM-Synth`)
**Categories:** A Foundation Core · B Optional Module · C Product Adapter · D DX27 Product · E Legacy/Defective

---

## Classification matrix

| Subsystem                                                                            | Path(s)                                            | Class                         | Notes                                      |
| ------------------------------------------------------------------------------------ | -------------------------------------------------- | ----------------------------- | ------------------------------------------ |
| AudioContext lifecycle (timeouts, exclusive start/stop, interrupted, closed rebuild) | `src/lib/audio/engine.ts` (partial)                | **A** (extract)               | Currently fused inside `TX27Engine`        |
| UI audio state machine / first gesture / pending notes / visibility                  | `src/routes/index.tsx`                             | **A** (extract)               | Must leave product route                   |
| Panic / sustain / note bookkeeping                                                   | `engine.ts` + UI                                   | **A**                         | Semantics generic; typed to FM voice today |
| Voice allocation (steal, mono last-note, polyphony cap)                              | `engine.ts`                                        | **A/D**                       | Policy reusable; voice type is FM          |
| Output safety (limiter, master ramp)                                                 | `engine.ts`                                        | **A**                         | Keep                                       |
| Analyser / meter peak                                                                | `engine.ts` + UI rAF                               | **B**                         | Optional                                   |
| Post-voice LPF                                                                       | `engine.ts`                                        | **B**                         | Engine-agnostic filter stage               |
| Chorus / delay / reverb                                                              | `engine.ts`, `reverb.ts`                           | **B**                         | Optional FX rack                           |
| PWA SW + precache inject + build handshake                                           | `public/sw.js`, `pwa.ts`, `inject-sw-precache.mjs` | **A**                         | Highest-quality reusable asset             |
| App shell (meta, safe-area, error boundary)                                          | `__root.tsx`                                       | **A**                         | Strip product titles                       |
| Startup diagnostics (local-only)                                                     | `startup-diagnostics.ts`                           | **B**                         | Valuable; optional                         |
| Settings persistence pattern                                                         | `settings.ts`                                      | **A**                         | Tiny; extend carefully                     |
| On-screen keyboard                                                                   | `Keyboard.tsx`                                     | **B**                         | Strong; product-styled                     |
| Perf strips (bend/mod)                                                               | `PerfStrip.tsx`                                    | **B**                         | Generic performance UI                     |
| Knob / LCD / selects                                                                 | `Knob.tsx`, `PresetLCD.tsx`, …                     | **D**                         | Visual identity                            |
| Patch library metadata/search/import UI                                              | `patch-library/*`, components                      | **B/C**                       | Metadata util = A/B; product checks = C    |
| Factory presets / randomizer                                                         | `presets.ts`                                       | **D**                         | FM-specific                                |
| `FMVoice` / algorithms / Vintage                                                     | `voice.ts`, `algorithms.ts`, `vintage.ts`          | **D**                         | Must not enter foundation                  |
| `Patch` / `OperatorParams`                                                           | `types.ts`                                         | **D** (+ future **C** schema) | Not a shared contract yet                  |
| Route FM editor (ops, algos, vintage)                                                | `index.tsx` panels                                 | **D**                         |                                            |
| Unused shadcn UI kit                                                                 | `components/ui/*`                                  | **E**                         | Delete or quarantine                       |
| Lovable error reporting                                                              | `lovable-error-reporting.ts`                       | **E**                         | Editor-only                                |
| Legacy patch storage v1                                                              | `patchStorage.ts`                                  | **E**                         | Keep until migration proven then retire    |
| `glideMode` sanitizer omission                                                       | `migration.ts`                                     | **E**                         | Defect                                     |
| Live FM param non-update                                                             | `engine.setPatch`                                  | **E**                         | Defect                                     |
| Mono retune FM-index drift                                                           | `voice.retune`                                     | **E**                         | Defect                                     |
| Vintage drift naming                                                                 | `vintage.ts`                                       | **E**                         | Semantic defect                            |
| Web MIDI                                                                             | —                                                  | **Missing**                   | Proposed as B later                        |
| Parameter registry / APVTS IDs                                                       | —                                                  | **Missing**                   | Required for C/native                      |
| Theme system                                                                         | —                                                  | **Missing**                   | Optional B if needed                       |

---

## Engine boundary reality check

### Can another synth replace FM without rewriting the app runtime?

**Not today.** Required rewrites today:

1. Replace `FMVoice` + algorithms + Vintage
2. Replace `Patch` shape, sanitizer ranges, factory presets
3. Rewrite operator/algorithm/vintage UI in `index.tsx`
4. Change `TX27Engine` constructor/`setPatch`/`noteOn` voice construction

**Reusable without rewrite if extracted first:**

- Gesture-gated lifecycle + visibility recovery
- PWA/offline pipeline
- Keyboard + panic + pending-note queue
- Library metadata utilities (product-agnostic core)
- Settings load/save pattern
- Limiter/master/analyser shell

### UI → DSP coupling (blocks replacement)

`index.tsx` imports concrete `TX27Engine`, `ALGORITHMS`, `Patch`, `INIT_PATCH`, FM presets/randomizer, and mutates nested operator/FX fields directly. There is **no** `SynthEngine` interface.

---

## Parameter system fitness

| Capability                                   | Status                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| Stable string IDs (`op1.ratio`)              | **Missing** — nested object paths only                                      |
| Single registry of min/max/default/step/unit | **Missing** — duplicated in UI + `migration.ts`                             |
| Normalization 0–1                            | **Missing**                                                                 |
| Smoothing metadata                           | **Missing** — ad-hoc in engine                                              |
| Preset serialization                         | **Present** — `Patch` JSON                                                  |
| Schema versioning                            | **Partial** — library schema v1; weak migration dispatcher                  |
| Corrupted-state recovery                     | **Partial** — import path strong; `normalizePatch` incomplete for nested FX |
| MIDI learn / CC map                          | **Missing**                                                                 |
| JUCE APVTS readiness                         | **Not suitable** until IDs + registry exist                                 |

### De-facto field paths (72 primitives when operators expanded)

See `Patch` in `src/lib/audio/types.ts`. Notable: `glideMode` exists on type but is **not** copied in `sanitizeImportedPatch`.

### Storage keys

| Key                                                  | Purpose              |
| ---------------------------------------------------- | -------------------- |
| `tx27.userLibrary.v2`                                | User library         |
| `tx27.userPatches.v1`                                | Legacy               |
| `tx27-preset-favorites` / `recent` / `browser-state` | Library UX           |
| `tx27-settings`                                      | Global settings      |
| `tx27-ui-mode`                                       | PLAY/FULL            |
| Diagnostics keys                                     | Local startup traces |

**IndexedDB:** not used.

---

## Recommended ownership split (target)

```
Foundation Core (A)     → lifecycle, PWA, input router, persistence helpers, diagnostics hooks
Optional (B)            → keyboard, meters, FX shell, preset browser UI
Product Adapter (C)     → ProductManifest, ParameterContract, engine factory, branding
DX27 Product (D)        → FM DSP, TX27 panels, factory bank, Vintage
Legacy (E)              → delete unused UI kit; fix sanitizer defects before extraction
```

**Challenge to over-architecture:** Do **not** extract chorus/reverb/meters into separate packages on day one. Keep one `foundation/` folder inside a monorepo or even copy-forward modules until a second synth proves reuse. Packages are justified only after Gate 6.
