# TXPPS TX-80 — Current Status

**Phase**: Responsive mode system on authoritative `main` (post Gate 1+2).
**Last update**: 2026-07-19

## Branch authority

- **`main` is the sole active development branch.**
- Gate 1 + Gate 2 remain integrated; responsive PLAY/EDIT/FULL work ships on `main`.
- Historical refs: `feat/gate2-runtime-switchover`, `archive/pre-gate2-main`,
  `archive/m2-copilot-audio`, `reference/claude-tx80-96c97e2`.
- Preview: https://txpps-tx-80.toppsmusicproductions.workers.dev/

```bash
git checkout main && git pull --ff-only origin main
```

## Latest — responsive modes + mobile layout (COMPLETE on main)

- Distinct **PLAY / EDIT / FULL** contracts (TX27-inspired behavior, TX-80 identity)
- Viewport tiers via `useViewportLayout` (portrait/landscape phone → wide desktop)
- Single header audio-start control; duplicate autoplay banner removed
- TX27-style **preset browser** overlay (18 factory patches + categories)
- Coordinated **performance dock** (ribbon, wheels, octave, sustain, keyboard)
- EDIT: keyboard hidden by default; SHOW KEYS / HIDE KEYS audition dock
- Phone section navigator for editor panels; safe-area insets
- Responsive Playwright matrix (37 tests) + QA docs

See `docs/TX80_RESPONSIVE_MODE_SYSTEM.md` and `docs/TX80_MOBILE_QA_MATRIX.md`.

## Gate 2 — COMPLETE (on main)

Authoritative synth-core runtime, voice ownership, UI wiring, branding,
selection lock, Settings + diagnostics. Legacy `src/audio/` quarantined.

## Gate 1 — COMPLETE (on main)

Synth-core transplant + parameter mapping; npm canonical.

## Deferred (honest)

| Item | Status |
|------|--------|
| MIDI | Gate 5 — disabled with explanation |
| Ribbon trigger | Gate 7 — disabled with explanation |
| Unmapped layer knobs | Gate 6 |
| Removal of `src/audio/` | Later removal gate |
| Physical phone + human listening | **Still required** |

## Quarantine

`src/audio/` remains on disk with zero live imports.
