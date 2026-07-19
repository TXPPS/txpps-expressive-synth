# TX-80 Responsive Mode System

**Status:** shipped on `main` (post Gate 2 consolidation).

## Mode contracts

| Mode | Purpose | Editor panels | Performance dock |
|------|---------|---------------|------------------|
| **PLAY** | Immediate performance + patch selection | Hidden | Full dock fills viewport |
| **EDIT** | Synthesis editing + optional audition | Shown (section nav on phone) | Hidden by default; **SHOW KEYS** / **HIDE KEYS** |
| **FULL** | Complete workstation | Shown | Docked keyboard always |

Mode is persisted in `localStorage` key `tx80-ui-mode`. Switching modes never recreates `AudioContext`, never resets the patch, and never remounts the synth engine.

## Viewport tiers

Capability-based (no user-agent sniffing) via `useViewportLayout()`:

- `phone-portrait-compact` / `phone-portrait-large`
- `phone-landscape-compact` / `phone-landscape-large`
- `tablet-portrait` / `tablet-landscape`
- `desktop` / `wide-desktop`

Uses width, height, orientation, and short-landscape detection (`height ≤ 560`).

## Performance dock

Coordinated surface: ribbon · pitch · mod · octave · sustain · keyboard.

- **Phone portrait PLAY:** horizontal octave/sustain bar → horizontal pitch/mod → ribbon → compact keyboard (min key width ~34px).
- **Phone / short landscape PLAY:** ribbon above; pitch/mod + octave/sustain beside maximized keyboard.
- **Desktop / tablet FULL:** classic side wheels + keyboard with side octave/sustain.
- **EDIT audition:** compact fixed-height dock when SHOW KEYS is on.

Orientation change releases active keyboard pointers safely; parameters and patch remain.

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
