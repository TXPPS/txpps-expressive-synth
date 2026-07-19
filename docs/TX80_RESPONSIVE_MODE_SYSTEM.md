# TX-80 Responsive Mode System

**Status:** shipped on `main` (TX27 performance parity pass).

## Mode contracts

| Mode | Purpose | Editor panels | Performance dock |
|------|---------|---------------|------------------|
| **PLAY** | Immediate performance + patch selection | Hidden | Full dock fills viewport |
| **EDIT** | Synthesis editing + optional audition | Shown (section nav on phone) | Hidden by default; **SHOW KEYS** / **HIDE KEYS** |
| **FULL** | Complete workstation | Shown | Docked keyboard always |

Mode is persisted in `localStorage` key `tx80-ui-mode`. Switching modes never recreates `AudioContext`, never resets the patch, and never remounts the synth engine.

## Sticky header

`Header` uses `position: sticky; top: 0; z-index: 50` with opaque enclosure background and `env(safe-area-inset-top)`. Remains visible while editor content scrolls.

## Viewport tiers

Capability-based (no user-agent sniffing) via `useViewportLayout()`:

- `phone-portrait-compact` / `phone-portrait-large`
- `phone-landscape-compact` / `phone-landscape-large`
- `tablet-portrait` / `tablet-landscape`
- `desktop` / `wide-desktop`

Uses width, height, orientation, and short-landscape detection (`height ≤ 560`).

## Performance dock

Coordinated surface: ribbon · pitch · mod · octave · sustain · keyboard.

- **PLAY (all phones/tablets):** ribbon above; **tall vertical** Pitch/Mod filling keyboard height; octave/sustain column; keyboard with TX27 discrete white-key steps
- **Phone portrait:** key bed `min-height ≈ 200px`, minKeyWidth 34 → typically **7–10** white keys
- **Phone landscape:** broader range (10–14), dock fills viewport height
- **EDIT audition:** reduced but intentional height via SHOW KEYS
- See `docs/TX80_KEYBOARD_GEOMETRY.md`

## Patch selection

Two levels — see `docs/TX80_PATCH_BROWSER_BEHAVIOR.md`.

## Audio start

Single header control (`data-tx80-audio-start`):

| State | Label (desktop) | Compact |
|-------|-----------------|---------|
| idle | TAP TO START | START |
| starting | STARTING | … |
| running | READY | READY |
| suspended | RESUME | RESUME |
| failed | RETRY | RETRY |

The long “TAP TO ENABLE AUDIO — BROWSER AUTOPLAY POLICY” banner is removed.

## Preset browser

Tappable patch name opens overlay (`data-tx80-preset-browser`):

- Categories: Keys, Pads, Leads, Bass, Experimental (+ All / Favorites / User)
- Search, favorites, save, restore factory
- Phone portrait: bottom sheet; tablet/desktop: centered panel
- Escape closes; focus returns; does not reset audio

## Accessibility

- Instrument `user-select: none`; diagnostic terminal remains selectable
- Mode group, audio status, and panic keep accessible names
- Touch targets ≈ 44×44 CSS px where practical
- `env(safe-area-inset-*)` on header and performance dock
- Reduced-motion: no mandatory motion for mode changes

## Rollback

```bash
git revert <responsive-commit-sha>
# or
git checkout archive/pre-gate2-main   # pre Gate 1+2 only — last resort
```

## Related

- `docs/TX80_MOBILE_QA_MATRIX.md`
- `docs/TX80_CONTROL_CONNECTION_AUDIT.md`
- `CURRENT_STATUS.md`
