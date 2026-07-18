# TXPPS TX-80 — Parameter Matrix

The authoritative registry lives in `src/state/params.ts`. This document mirrors it in human-readable form and tracks wiring status.

Legend:
- **UI**: control is rendered
- **STATE**: bound to Zustand store (`useSynthStore.setParam`)
- **ENGINE**: routed to a live audio node
- **PRESET**: serialized to preset JSON

## Layer I & Layer II (identical set, per layer)

| Param | UI | STATE | ENGINE | PRESET | Notes |
|---|---|---|---|---|---|
| `osc.wave` | ✅ | ✅ | ⏳ M2 | ✅ | enum: saw / square / pulse / triangle / sine |
| `osc.octave` | ✅ | ✅ | ⏳ M2 | ✅ | -2..2 |
| `osc.tune` | ✅ | ✅ | ⏳ M2 | ✅ | -12..12 st, Layer II defaults slightly detuned |
| `osc.fine` | via slider | ✅ | ⏳ M2 | ✅ | -50..50 cents |
| `osc.pw` | ✅ | ✅ | ⏳ M2 | ✅ | 0.05..0.95 |
| `osc.pwm` | (M2) | ✅ | ⏳ M2 | ✅ | 0..1 |
| `sub.level` | ✅ | ✅ | ⏳ M2 | ✅ | 0..1 |
| `noise.level` | ✅ | ✅ | ⏳ M2 | ✅ | 0..1 |
| `filt.cutoff` | ✅ | ✅ | ⏳ M2 | ✅ | 20..18000 Hz, audio-rate smoothed |
| `filt.reso` | ✅ | ✅ | ⏳ M2 | ✅ | 0..1 |
| `filt.envAmt` | ✅ | ✅ | ⏳ M2 | ✅ | -1..1 |
| `filt.kbd` | (M3) | ✅ | ⏳ M2 | ✅ | keyboard tracking |
| `filt.drive` | (M3) | ✅ | ⏳ M2 | ✅ | 0..1 |
| `env.a.{a,d,s,r}` | ✅ | ✅ | ⏳ M2 | ✅ | AMP envelope |
| `env.f.{a,d,s,r}` | (M3) | ✅ | ⏳ M2 | ✅ | Filter envelope |
| `layer.on` | ✅ | ✅ | ⏳ M2/M3 | ✅ | enable / bypass |
| `layer.level` | ✅ | ✅ | ⏳ M2/M3 | ✅ | 0..1 |
| `layer.pan` | ✅ | ✅ | ⏳ M2/M3 | ✅ | -1..1 |
| `layer.modAmt` | (M5) | ✅ | ⏳ M5 | ✅ | LFO depth per-layer |

## Modulation

| Param | UI | STATE | ENGINE | PRESET |
|---|---|---|---|---|
| `mod.lfo1.wave` | ✅ | ✅ | ⏳ M5 | ✅ |
| `mod.lfo1.rate` | ✅ | ✅ | ⏳ M5 | ✅ |
| `mod.lfo1.depth` | ✅ | ✅ | ⏳ M5 | ✅ |
| `mod.lfo1.dest` | ✅ | ✅ | ⏳ M5 | ✅ |
| `mod.lfo2.*` | ✅ | ✅ | ⏳ M5 | ✅ |

## FX

| Param | UI | STATE | ENGINE | PRESET |
|---|---|---|---|---|
| `fx.chorus.{on,rate,depth,mix}` | ✅ | ✅ | ⏳ M5 | ✅ |
| `fx.delay.{on,time,fb,mix}` | ✅ | ✅ | ⏳ M5 | ✅ |
| `fx.reverb.{on,size,mix}` | ✅ | ✅ | ⏳ M5 | ✅ |

## Master / Perf

| Param | UI | STATE | ENGINE | PRESET |
|---|---|---|---|---|
| `master.level` | ✅ | ✅ | ⏳ M2 | ✅ |
| `master.tune` | ✅ | ✅ | ⏳ M2 | ✅ |
| `master.polyphony` | ✅ | ✅ | ⏳ M2 | ✅ |
| `porta.{on,time}` | ✅ | ✅ | ⏳ M4 | ✅ |
| `gliss.{on,rate}` | ✅ | ✅ | ⏳ M4 | ✅ |
| `ribbon.{mode,range}` | ✅ | ✅ | ⏳ M4 | ✅ |

Transient (not serialized): `pitchBend`, `modWheel`, `sustainPedal`, `panicToken`.
