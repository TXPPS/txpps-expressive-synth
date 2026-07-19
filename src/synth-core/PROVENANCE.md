# synth-core Provenance

Every file in `src/synth-core/` was transplanted from the donor
implementation, per the approved Strategy A (see
`docs/TX80_DUAL_IMPLEMENTATION_AUDIT.md` §6).

**Donor:** repository `txpps/txpps-tx-80`, branch
`claude/tx80-synth-completion-nkt36a`, commit
`96c97e2869a189e372396c8532787e0e20923974`.
The full donor history is preserved in THIS repository as the read-only
branch `reference/claude-tx80-96c97e2` (same SHA as its head).

No Git merge or cherry-pick was performed — files were copied and committed
normally, with the modifications listed below.

| File here | Donor path | Local modifications |
| --- | --- | --- |
| `runtime/contracts.ts` | `src/lib/synth/contracts.ts` | none (verbatim) |
| `runtime/runtime.ts` | `src/lib/synth/runtime.ts` | none (verbatim) |
| `runtime/runtime.test.ts` | `src/lib/synth/runtime.test.ts` | none (verbatim) |
| `tx80/types.ts` | `src/lib/tx80/types.ts` | `ChorusParams`/`DelayParams`/`ReverbParams` inlined (donor imported them from its TX27 foundation `src/lib/audio/types.ts`) |
| `tx80/parameters.ts` | `src/lib/tx80/parameters.ts` | import path `../synth/contracts` → `../runtime/contracts` |
| `tx80/parameters.test.ts` | `src/lib/tx80/parameters.test.ts` | none (verbatim) |
| `tx80/presets.ts` | `src/lib/tx80/presets.ts` | none (verbatim) |
| `tx80/storage.ts` | `src/lib/tx80/storage.ts` | none (verbatim) |
| `tx80/midi.ts` | `src/lib/tx80/midi.ts` | none (verbatim) |
| `tx80/productAdapter.ts` | `src/lib/tx80/productAdapter.ts` | import path `../synth/contracts` → `../runtime/contracts` |
| `tx80/engine/engine.ts` | `src/lib/tx80/engine/engine.ts` | imports `../../audio/reverb` → `./reverb`, `../../audio/types` → `../types` |
| `tx80/engine/voice.ts` | `src/lib/tx80/engine/voice.ts` | none (verbatim) |
| `tx80/engine/reverb.ts` | `src/lib/audio/reverb.ts` | import `./types` → `../types` (product-neutral IR generator shared by the donor's TX27 and TX-80) |
| `mapping.ts`, `mapping.test.ts` | — | NEW in this repo (Gate 1): UI-registry ↔ engine-registry translation layer |

Deliberately NOT transplanted: donor UI components/routes, TX27 product
code, donor docs, donor e2e specs (arrive at Gate 2 with the switchover),
donor `proofEngine.*` (TX27 gate artifact).

Boundary rule: nothing under `src/synth-core/` may import from application
code (`src/state`, `src/components`, `src/hooks`, `src/routes`, `src/audio`).
Application code integrates with synth-core only through
`runtime/contracts.ts` (`SynthEngine`), `runtime/runtime.ts`
(`SynthRuntime`), `tx80/productAdapter.ts` and `mapping.ts`.

As of Gate 1 this directory is **dark**: compiled and unit-tested, not yet
imported by the running application. The audible path is still `src/audio/`
until Gate 2.
