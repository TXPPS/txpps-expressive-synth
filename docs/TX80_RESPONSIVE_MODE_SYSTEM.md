# TX-80 Responsive Mode System

**Status:** shipped on `main` (fixed header + portrait dock expansion).

## Mode contracts

| Mode | Purpose | Editor panels | Performance dock |
|------|---------|---------------|------------------|
| **PLAY** | Immediate performance + patch selection | Hidden | Full dock fills viewport |
| **EDIT** | Synthesis editing + optional audition | Shown (section nav on phone) | Hidden by default; **SHOW KEYS** / **HIDE KEYS** |
| **FULL** | Complete workstation | Shown | Docked keyboard always |

Mode is persisted in `localStorage` key `tx80-ui-mode`. Switching modes never recreates `AudioContext`, never resets the patch, and never remounts the synth engine.

## Fixed app header

**Choice: `position: fixed`** (not sticky).

**Why sticky failed on physical iPhone Safari:** sticky positioning is broken when any ancestor (commonly `overflow-x: hidden` on `html`/`body`, or a shell with `overflow-x-hidden`) establishes a scroll/overflow containing block. Playwright Chromium still reported sticky as “working,” which diverged from real WebKit.

**Implementation:**

- `Header` is `position: fixed; top: 0; left: 0; right: 0; z-index: 80`
- Opaque gradient background for readability
- `padding-top: max(env(safe-area-inset-top), 0.35rem)` (and L/R safe-area)
- `ResizeObserver` publishes `--tx80-header-height` on `:root`
- Shell (`[data-tx80-shell]`) uses `padding-top: var(--tx80-header-height)` so content never sits under the toolbar
- `data-tx80-header-position="fixed"` · `data-tx80-scroll-owner="document"`

**Scroll owner:** the **document** (window). There is no nested app scrollport for the main shell. Native Safari chrome is outside app control — only the TX-80 toolbar is pinned.

**No duplicate toolbar** across orientation changes (single Header mount).

## Viewport tiers

Capability-based (no user-agent sniffing) via `useViewportLayout()`:

- `phone-portrait-compact` / `phone-portrait-large`
- `phone-landscape-compact` / `phone-landscape-large`
- `tablet-portrait` / `tablet-landscape`
- `desktop` / `wide-desktop`

## Performance dock geometry

Shared CSS variables on the dock (tier-tuned):

| Variable | Role |
|----------|------|
| `--tx80-lower-perf-min` | Minimum shared lower-row height (dvh-based on phone PLAY) |
| `--tx80-dock-gap` | Gap between Pitch / Mod / Oct / keys |
| `--tx80-side-control-width` | Pitch & Mod column width |
| `--tx80-oct-col-width` | Octave / display / Sustain column |
| `--tx80-ribbon-height` | Ribbon slot (documented target) |

**PLAY lower row** = CSS Grid:

`Pitch | Mod | Oct/Sus | Keyboard` — one `minmax(--tx80-lower-perf-min, 1fr)` row so all four regions share top/bottom bounds.

- Pitch/Mod tracks fill column height (real pointer travel = strip `getBoundingClientRect().height`)
- Sustain is `flex-1` in the oct column (grows downward; ≥44×44)
- Phone PLAY: build footer removed; layout line lives in Settings → ABOUT / Diagnostics
- FULL/EDIT: thin build footer on tablet/desktop only (not phone)

See `docs/TX80_KEYBOARD_GEOMETRY.md`.

## Patch selection

Two levels — see `docs/TX80_PATCH_BROWSER_BEHAVIOR.md`.

## Audio start

Single header control (`data-tx80-audio-start`). The long autoplay banner is removed.

## Accessibility

- Instrument `user-select: none`; diagnostic terminal remains selectable
- Compact portrait keeps short labels with full `aria-label`s
- `env(safe-area-inset-*)` on header and performance dock

## Rollback

```bash
git revert <this-fix-commit-sha>
# or last-resort pre Gate 1+2:
git checkout archive/pre-gate2-main
```

## Related

- `docs/TX80_MOBILE_QA_MATRIX.md`
- `docs/TX80_KEYBOARD_GEOMETRY.md`
- `CURRENT_STATUS.md`
