# TX-80 — Next Roadmap (post Gate 2 on main)

Authority: work continues from **`main` only**. Do not resume feature work
on `feat/gate2-runtime-switchover`.

## Completed (on main)

- Gate 1 — synth-core transplant + parameter mapping
- Gate 2 — runtime switchover, voice ownership, UI functional wiring,
  branding, selection lock, Settings + diagnostic terminal, Workers preview

## Deferred / next gates (not started)

| Gate / work | Scope |
|-------------|--------|
| Gate 3+ | Only after Hunter opens the next gate — not started by this consolidation |
| Gate 5 | MIDI input/output; enable SETTINGS MIDI when ready |
| Gate 6 | Finish unmapped layer params (`osc.pwm`, `filt.type`, `filt.drive`, `layer.modAmt`) and lossy mapping decisions |
| Gate 7 | Ribbon **trigger** mode (currently disabled with explanation) |
| Removal gate | Delete quarantined `src/audio/` after approved parity proof |
| Device sign-off | Physical phone multitouch, portrait/landscape, iOS Safari |
| Listening sign-off | Human audible quality across factory patches |

## Known limitations (honest)

- MIDI is disabled in UI with explanation.
- Ribbon trigger is disabled with explanation.
- Some registry params remain unmapped pending Gate 6.
- `src/audio/` still exists on disk but is not in the live module graph.
- Automated e2e does not replace physical-device or listening validation.
- Full-repo `npm run lint` still reports historical CRLF prettier noise;
  Gate 2 changed files are lint-clean.

## Resume

```bash
git checkout main && git pull --ff-only origin main
```
