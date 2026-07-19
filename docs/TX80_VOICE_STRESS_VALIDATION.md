# TX-80 Voice Stress Validation

Automated suite: `tests/e2e/voice-stress.e2e.ts`

## Coverage

| Item | Result |
|------|--------|
| Event count | **500** (5 seeds × 100) |
| Seeds | 11, 42, 77, 99, 123 |
| Same-note spam | Pass — settles to 0 voices |
| Alternating spam | Pass |
| Sustain during spam | Pass — pedal-up clears |
| Panic cleanup | Pass — 0 active voices |
| Post-stress playability | Pass |
| Mode change after hold | Pass |
| Orientation change | Pass — still 1 AudioContext |
| Gate2 ownership suite | 20/20 pass |

## Invariants checked

- `activeVoices === 0` after Panic / settle
- `contextsCreated <= 1`
- `enginesCreated <= 1`
- Engine remains playable after stress

## Not claimed

Physical multitouch on real phones; human listening quality.
