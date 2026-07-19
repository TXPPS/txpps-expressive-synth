# TXPPS TX-80 — Current Status

**Phase**: Fixed app header + portrait performance-dock expansion on authoritative `main`.
**Last update**: 2026-07-19

## Branch authority

- **`main` is the sole active development branch.**
- Preview: https://txpps-tx-80.toppsmusicproductions.workers.dev/

```bash
git checkout main && git pull --ff-only origin main
```

## Latest — Pin header + expand portrait controls

- **Root cause:** `position: sticky` failed on real iPhone Safari because ancestors
  (`overflow-x: hidden` on `html`/`body` and previously the shell) create a scroll
  containing block that differs from Playwright Chromium.
- **Fix:** TX-80 app toolbar uses `position: fixed` + measured `--tx80-header-height`
  with shell `padding-top`. Scroll owner remains the **document**.
- Safe-area: `padding-top: max(env(safe-area-inset-top), …)` on the fixed header.
- Portrait PLAY/FULL: CSS Grid lower row — Pitch | Mod | Oct/Sus | Keyboard share one height.
- Pitch/Mod labels overlay **inside** the strip (TX27); `--tx80-ribbon-gap` (~8–16px by
  tier) separates ribbon from the shared lower row so wheels never touch the ribbon while
  tops stay flush with OCT+/keyboard.
- Sustain `flex-1` fills remaining control-column height.
- Phone PLAY: build footer removed (tier/mode in Settings → ABOUT / Diagnostics).
- Mobile WebKit Playwright project: `tests/e2e/fixed-header.e2e.ts`.

**Physical phone retest still required** after deploy (hard-refresh).

## Deferred

| Item | Status |
|------|--------|
| MIDI | Gate 5 |
| Ribbon trigger | Gate 7 |
| Unmapped layer knobs | Gate 6 |
| `src/audio/` removal | Later gate |
| Physical phone + listening | **Still required** |
