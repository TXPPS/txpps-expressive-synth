# TXPPS TX-80 — Current Status

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
