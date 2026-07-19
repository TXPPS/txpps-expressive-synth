# TX-80 Keyboard Geometry

TX27-derived discrete white-key ranges. Prefer **playable key size** over
maximum note count.

## Algorithm

```ts
RANGE_STEPS_COMPACT = [14, 10, 7]
RANGE_STEPS_DESKTOP = [28, 21, 14, 10, 7]
// first c where containerWidth / c >= minKeyWidth
```

Source: `src/lib/keyboardGeometry.ts`.

## Targets by tier

| Tier | minKeyWidth | White-key band | PLAY key height |
|------|-------------|----------------|-----------------|
| Phone portrait | 34 | **7–10** | `h-full` / min **200px** (shared grid row) |
| Phone landscape | 30 | **10–14** | fill dock / min 140px |
| Tablet portrait | 28 | **10–14** | fill / min 180px |
| Tablet landscape | 26 | **14** | fill / min 170px |
| Desktop | 24 | **14–28** | fill / min 180px |
| EDIT audition | 28 | **7–10** | min ~110–140px |

## Shared performance-dock geometry (PLAY)

Portrait/landscape PLAY uses a CSS Grid lower row so these share one height:

1. Pitch column  
2. Mod column  
3. Octave + display + Sustain column  
4. Keyboard  

CSS variables (set on the dock, tuned per tier):

- `--tx80-lower-perf-min` — large phone portrait PLAY ≈ `min(52dvh, 28rem)`
- `--tx80-side-control-width` — Pitch/Mod track width  
- `--tx80-oct-col-width` — control column  
- `--tx80-dock-gap`

Pitch/Mod **interaction height** equals the strip element height (not an empty outer wrapper). Pitch spring-returns; Mod latches. Pointer capture / `touch-action` / cancel & lostcapture clearing preserved.

Sustain uses `flex-1` to consume remaining column height after Oct+/Oct−/display (≥ 44×44 CSS px).

## Orientation

On `orientationchange`, active keyboard pointers are released before geometry
recomputes. Patch, mode, and AudioContext are retained.
