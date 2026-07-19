# TXPPS TX-80 — Current Status

**Phase**: TX27 performance parity refinements on authoritative `main`.
**Last update**: 2026-07-19

## Branch authority

- **`main` is the sole active development branch.**
- Preview: https://txpps-tx-80.toppsmusicproductions.workers.dev/

```bash
git checkout main && git pull --ff-only origin main
```

## Latest — TX27 performance parity (COMPLETE)

- Sticky opaque header with safe-area insets
- Two-level patch workflow: quick list + full library
- Category filters wrap (no clipped USER chip)
- Taller Pitch/Mod strips filling dock height
- TX27 discrete white-key geometry (`[14,10,7]` / desktop broader)
- Phone portrait PLAY keys min ~200px tall, side-column dock
- Voice stress suite: 500 events across 5 seeds

Docs: `docs/TX80_KEYBOARD_GEOMETRY.md`, `docs/TX80_PATCH_BROWSER_BEHAVIOR.md`,
`docs/TX80_VOICE_STRESS_VALIDATION.md`, `docs/TX80_RESPONSIVE_MODE_SYSTEM.md`.

## Deferred

| Item | Status |
|------|--------|
| MIDI | Gate 5 |
| Ribbon trigger | Gate 7 |
| Unmapped layer knobs | Gate 6 |
| `src/audio/` removal | Later gate |
| Physical phone + listening | **Still required** |
