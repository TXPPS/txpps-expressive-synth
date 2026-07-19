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
| Phone portrait | 34 | **7–10** | `h-full` / min **200px** |
| Phone landscape | 30 | **10–14** | fill dock / min 140px |
| Tablet portrait | 28 | **10–14** | fill / min 180px |
| Tablet landscape | 26 | **14** | fill / min 170px |
| Desktop | 24 | **14–28** | fill / min 180px |
| EDIT audition | 28 | **7–10** | min ~110–140px |

## Pitch / Mod

Vertical strips **fill dock column height** beside the keyboard (TX27
landscape proportion). Labels remain under each strip. Pitch spring-returns
on release; mod latches.

## Orientation

On `orientationchange`, active keyboard pointers are released before geometry
recomputes. Patch, mode, and AudioContext are retained.
