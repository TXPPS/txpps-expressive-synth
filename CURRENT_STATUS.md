# TXPPS TX-80 — Current Status

**Phase**: Reconciliation Gate 1 complete (clean baseline + dark engine
transplant). Roadmap: `docs/TX80_NEXT_ROADMAP.md`; audit:
`docs/TX80_DUAL_IMPLEMENTATION_AUDIT.md`.
**Last update**: Gate 1 (2026-07-19)

## Gate 1 — clean authoritative baseline (COMPLETE)

Strategy A approved by Hunter: this repository/`main` is the permanent
product home (approved UI, Zustand state, `src/state/params.ts` as the
authoritative parameter source); the Claude implementation in
`txpps/txpps-tx-80` is a **donor** of proven engine subsystems only.

Done in this gate (no visible product behavior changed — the audible path
is still the M2 `src/audio` engine until Gate 2):

- **Preservation:** remote branches `archive/m2-copilot-audio` (pre-gate
  `main` @ `ad15b8e`) and `reference/claude-tx80-96c97e2` (full donor
  history @ its own SHA). A local annotated tag mirrors the archive branch;
  the Git proxy in this environment rejects tag pushes, so branches are the
  remote-preserved form.
- **Dependency baseline repaired:** the out-of-sync `package-lock.json`
  (broke `npm ci`) was regenerated; the stale `bun.lock` was removed.
  **npm is the canonical package manager** for this repo. `npm ci` verified
  in sync. Added `vitest` (devDependency) and `typecheck`/`test` scripts.
- **Dev-server fix:** explicit IPv4 bind in `vite.config.ts` (the default
  dual-stack listen crashed with `EAFNOSUPPORT` on IPv6-less hosts).
- **Dark transplant:** donor runtime + engine copied to `src/synth-core/`
  (SynthEngine contracts, SynthRuntime, TX-80 dual-layer engine/voices,
  registry, presets, storage, MIDI, reverb IR). Compiled, lint-clean and
  unit-tested here; **not yet imported by the app**. Full file-by-file
  donor provenance (repo/branch/SHA + local modifications):
  `src/synth-core/PROVENANCE.md`.
- **Parameter mapping layer:** `src/synth-core/mapping.ts` translates the
  authoritative UI registry ids/vocabularies into donor-engine ids
  (direct/derived/unmapped, every unmapped entry with a reason and a
  disposition gate). Enforced by `src/synth-core/mapping.test.ts`:
  registry coverage is exact in both directions.
- **Checks after this gate:** `npm run typecheck` clean ·
  `npm run test` 28/28 · `npm run lint` clean on all new/changed files ·
  `npm run build` green · dev-server behavior probe unchanged (Layer-I
  audio via the old engine, first-note drop and stuck-voice defects still
  present **by design** — they are retired with the engine at Gate 2).

Known blockers intentionally NOT fixed in this gate (they disappear with
the Gate 2 engine switchover, per the approved plan): stuck voices from
uncancelled release ramps; never-invoked voice cleanup; cold-start
first-note loss; unrecoverable failed initialization.

---

## Historical — Milestone 1 shell status (pre-reconciliation)

**Milestone**: 1 of 7 — Responsive shell
**Last update**: initial build

## Verification vocabulary
- **implemented** = code exists
- **build-verified** = `bun run build` compiles it
- **preview-verified** = observed rendering in the live preview
- **manually-exercised** = clicked / touched / played it in preview
- **device-tested** = tested on the target device / orientation
- **unverified** = not yet observed
- **defective** = observed to be broken

## Milestone 1 — status

| Item | Status |
|---|---|
| Design tokens (`src/styles.css`) | implemented, build pending |
| Parameter registry (`src/state/params.ts`) | implemented, build pending |
| Zustand store (`src/state/store.ts`) | implemented, build pending |
| Header component | implemented, build pending |
| PresetBar | implemented, build pending |
| Layer I / Layer II panels | implemented (share `LayerPanel` component), build pending |
| Modulation panel | implemented, build pending |
| FX panel | implemented, build pending |
| Master / performance panel | implemented, build pending |
| PerformanceStrip (pitch/mod/sustain) | implemented, build pending |
| Ribbon (pointer capture) | implemented, build pending |
| Keyboard (multitouch, adaptive) | implemented, build pending |
| Responsive layout (5 breakpoints) | implemented, preview-verification pending |
| Compact audio-enable control | implemented (placeholder resume), build pending |
| Audio engine | **not started — M2** |
| Portamento / glissando / ribbon engine | **not started — M4** |
| Modulation routing | **not started — M5** |
| Effects DSP | **not started — M5** |
| Preset persistence (IndexedDB) | **not started — M5** |
| MIDI | **not started — M5** |
| PWA | **not started — M7** |

## Known limitations at this milestone
- No audio is produced. The "TAP TO ENABLE AUDIO" pill only flips a UI status; the real AudioContext lifecycle lands in Milestone 2.
- Ribbon and keyboard fire on-screen visuals but do not yet drive an engine.
- Preset prev/next/save/load buttons are visible but non-functional until M5.
- LFO destination changes are stored but not applied.
- Portamento/glissando toggles are stored but not applied.

## Explicit non-claims
- **Not claimed**: production-ready, complete, fully verified, playable, offline-capable, MIDI-capable.
- **Claimed**: a stable, structured, responsive shell wired to a real parameter registry, ready for Milestone 2 to attach the audio engine without restructuring.
