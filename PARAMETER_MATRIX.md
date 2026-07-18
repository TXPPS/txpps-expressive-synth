# TX-80 Parameter Matrix

Generated from `src/lib/tx80/parameters.ts` by `scripts/generate-parameter-matrix.mjs`
— regenerate after any registry change; do not edit the table by hand.

Every row is one authoritative parameter definition. The UI binds through
`ParamKnob`/buttons/`TxSelect` → `setParameter(id, value)` →
`setTx80Parameter` (coerce + clamp) → React patch state **and**
`TX80ProductEngine.setParameter` → `TX80Engine.setPatch` (section-diffed
application). Presets serialize the full `Tx80Patch`; transient performance
state (held notes, pointer state, pitch-bend position, ribbon position) is
never serialized.

**Verification status:** every parameter's UI→state→serialize→restore path is
covered by unit tests (registry round-trip + factory-preset round-trip) and
the browser e2e layer covers representative members of every engine section
(see `tests/e2e/tx80-engine.e2e.ts`). Audible/perceptual verification of each
individual parameter remains on the human listening list in MANUAL_QA.md.

| Parameter ID | UI component | State path | Default | Range / choices | Unit | Smoothing | Preset | Engine destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `l1.enabled` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.enabled` | true | true / false | — | none | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.level` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.level` | 0.8 | 0 … 1 | — | fast | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.pan` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.pan` | 0 | -1 … 1 | — | fast | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.octave` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.octave` | 0 | -2 … 2 (step 1) | oct | none | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.coarse` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.coarse` | 0 | -7 … 7 (step 1) | st | none | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.fine` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.fine` | 0 | -50 … 50 (step 0.5) | cent | fast | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.wave` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.wave` | "saw" | saw / pulse / triangle / sine | — | none | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.pw` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.pulseWidth` | 0.5 | 0.05 … 0.5 | — | fast | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.oscLevel` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.oscLevel` | 0.8 | 0 … 1 | — | fast | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.subLevel` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.subLevel` | 0 | 0 … 1 | — | fast | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.noiseLevel` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.noiseLevel` | 0 | 0 … 1 | — | fast | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.filter.cutoff` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.filter.cutoff` | 9000 | 30 … 16000 (step 1) | Hz | fast | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.filter.resonance` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.filter.resonance` | 0.15 | 0 … 1 | — | fast | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.filter.envAmount` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.filter.envAmount` | 0.25 | -1 … 1 | — | fast | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.filter.keyTracking` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.filter.keyTracking` | 0.5 | 0 … 1 | — | fast | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.fenv.attack` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.filterEnv.attack` | 0.005 | 0.001 … 8 | s | none | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.fenv.decay` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.filterEnv.decay` | 0.35 | 0.001 … 8 | s | none | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.fenv.sustain` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.filterEnv.sustain` | 0.4 | 0 … 1 | — | none | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.fenv.release` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.filterEnv.release` | 0.4 | 0.01 … 10 | s | none | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.aenv.attack` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.ampEnv.attack` | 0.01 | 0.001 … 8 | s | none | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.aenv.decay` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.ampEnv.decay` | 0.3 | 0.001 … 8 | s | none | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.aenv.sustain` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.ampEnv.sustain` | 0.7 | 0 … 1 | — | none | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l1.aenv.release` | LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.0.ampEnv.release` | 0.4 | 0.01 … 10 | s | none | yes | Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.enabled` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.enabled` | false | true / false | — | none | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.level` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.level` | 0.6 | 0 … 1 | — | fast | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.pan` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.pan` | 0 | -1 … 1 | — | fast | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.octave` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.octave` | 0 | -2 … 2 (step 1) | oct | none | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.coarse` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.coarse` | 0 | -7 … 7 (step 1) | st | none | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.fine` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.fine` | 6 | -50 … 50 (step 0.5) | cent | fast | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.wave` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.wave` | "saw" | saw / pulse / triangle / sine | — | none | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.pw` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.pulseWidth` | 0.5 | 0.05 … 0.5 | — | fast | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.oscLevel` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.oscLevel` | 0.8 | 0 … 1 | — | fast | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.subLevel` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.subLevel` | 0 | 0 … 1 | — | fast | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.noiseLevel` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.noiseLevel` | 0 | 0 … 1 | — | fast | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.filter.cutoff` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.filter.cutoff` | 9000 | 30 … 16000 (step 1) | Hz | fast | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.filter.resonance` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.filter.resonance` | 0.15 | 0 … 1 | — | fast | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.filter.envAmount` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.filter.envAmount` | 0.25 | -1 … 1 | — | fast | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.filter.keyTracking` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.filter.keyTracking` | 0.5 | 0 … 1 | — | fast | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.fenv.attack` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.filterEnv.attack` | 0.005 | 0.001 … 8 | s | none | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.fenv.decay` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.filterEnv.decay` | 0.35 | 0.001 … 8 | s | none | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.fenv.sustain` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.filterEnv.sustain` | 0.4 | 0 … 1 | — | none | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.fenv.release` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.filterEnv.release` | 0.4 | 0.01 … 10 | s | none | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.aenv.attack` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.ampEnv.attack` | 0.01 | 0.001 … 8 | s | none | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.aenv.decay` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.ampEnv.decay` | 0.3 | 0.001 … 8 | s | none | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.aenv.sustain` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.ampEnv.sustain` | 0.7 | 0 … 1 | — | none | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `l2.aenv.release` | LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle | `layers.1.ampEnv.release` | 0.4 | 0.01 … 10 | s | none | yes | Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus |
| `voice.mode` | PERF panel buttons + ParamKnob | `voiceMode` | "poly" | poly / solo | — | none | yes | Voice allocator (poly/solo policy, count, velocity mapping) |
| `voice.polyphony` | PERF panel buttons + ParamKnob | `polyphony` | 8 | 4 / 8 / 12 / 16 | — | none | yes | Voice allocator (poly/solo policy, count, velocity mapping) |
| `velocity.sensitivity` | PERF panel buttons + ParamKnob | `velocitySens` | 0.5 | 0 … 1 | — | fast | yes | Voice allocator (poly/solo policy, count, velocity mapping) |
| `pitch.mode` | PERF panel buttons, ParamKnob, TxSelect | `pitchTravel.mode` | "off" | off / porta / gliss | — | none | yes | Note-on pitch scheduling (porta/gliss) · ribbonSource ConstantSource |
| `pitch.time` | PERF panel buttons, ParamKnob, TxSelect | `pitchTravel.time` | 0.12 | 0 … 1 | s/oct | none | yes | Note-on pitch scheduling (porta/gliss) · ribbonSource ConstantSource |
| `ribbon.mode` | PERF panel buttons, ParamKnob, TxSelect | `ribbon.mode` | "pitch" | pitch / gliss / hold | — | none | yes | Note-on pitch scheduling (porta/gliss) · ribbonSource ConstantSource |
| `ribbon.range` | PERF panel buttons, ParamKnob, TxSelect | `ribbon.range` | 2 | 2 / 5 / 7 / 12 / 24 | — | none | yes | Note-on pitch scheduling (porta/gliss) · ribbonSource ConstantSource |
| `lfoA.wave` | MOD panel wave buttons, ParamKnob, TxSelect | `lfoA.wave` | "sine" | sine / triangle / square / saw | — | none | yes | LFO A oscillator + depth gain → selected destination bus |
| `lfoA.rate` | MOD panel wave buttons, ParamKnob, TxSelect | `lfoA.rate` | 5 | 0.05 … 12 (step 0.01) | Hz | fast | yes | LFO A oscillator + depth gain → selected destination bus |
| `lfoA.depth` | MOD panel wave buttons, ParamKnob, TxSelect | `lfoA.depth` | 0 | 0 … 1 | — | fast | yes | LFO A oscillator + depth gain → selected destination bus |
| `lfoA.dest` | MOD panel wave buttons, ParamKnob, TxSelect | `lfoA.destination` | "pitch" | off / pitch / filter / amp / pw / pan / balance | — | none | yes | LFO A oscillator + depth gain → selected destination bus |
| `lfoB.wave` | MOD panel wave buttons, ParamKnob, TxSelect | `lfoB.wave` | "triangle" | sine / triangle / square / saw | — | none | yes | LFO B oscillator + depth gain → selected destination bus |
| `lfoB.rate` | MOD panel wave buttons, ParamKnob, TxSelect | `lfoB.rate` | 0.4 | 0.05 … 12 (step 0.01) | Hz | fast | yes | LFO B oscillator + depth gain → selected destination bus |
| `lfoB.depth` | MOD panel wave buttons, ParamKnob, TxSelect | `lfoB.depth` | 0 | 0 … 1 | — | fast | yes | LFO B oscillator + depth gain → selected destination bus |
| `lfoB.dest` | MOD panel wave buttons, ParamKnob, TxSelect | `lfoB.destination` | "filter" | off / pitch / filter / amp / pw / pan / balance | — | none | yes | LFO B oscillator + depth gain → selected destination bus |
| `fx.chorus.enabled` | FX panel ON/OFF + ParamKnob | `chorus.enabled` | false | true / false | — | none | yes | Chorus wet/dry gains, tap LFO rate/depth |
| `fx.chorus.amount` | FX panel ON/OFF + ParamKnob | `chorus.amount` | 0.4 | 0 … 1 | — | fast | yes | Chorus wet/dry gains, tap LFO rate/depth |
| `fx.chorus.rate` | FX panel ON/OFF + ParamKnob | `chorus.rate` | 0.6 | 0.05 … 8 | Hz | fast | yes | Chorus wet/dry gains, tap LFO rate/depth |
| `fx.chorus.depth` | FX panel ON/OFF + ParamKnob | `chorus.depth` | 0.003 | 0 … 0.01 (step 0.0001) | s | fast | yes | Chorus wet/dry gains, tap LFO rate/depth |
| `fx.delay.enabled` | FX panel ON/OFF + ParamKnob | `delay.enabled` | false | true / false | — | none | yes | DelayNode.delayTime, feedback gain (≤0.85), wet/dry gains |
| `fx.delay.time` | FX panel ON/OFF + ParamKnob | `delay.time` | 0.32 | 0.02 … 1.2 | s | fast | yes | DelayNode.delayTime, feedback gain (≤0.85), wet/dry gains |
| `fx.delay.feedback` | FX panel ON/OFF + ParamKnob | `delay.feedback` | 0.35 | 0 … 0.85 | — | fast | yes | DelayNode.delayTime, feedback gain (≤0.85), wet/dry gains |
| `fx.delay.mix` | FX panel ON/OFF + ParamKnob | `delay.mix` | 0.25 | 0 … 1 | — | fast | yes | DelayNode.delayTime, feedback gain (≤0.85), wet/dry gains |
| `fx.reverb.enabled` | FX panel ON/OFF, type buttons + ParamKnob | `reverb.enabled` | true | true / false | — | none | yes | Convolver wet/dry, pre-delay; size/decay/damping/width bake the cached IR |
| `fx.reverb.type` | FX panel ON/OFF, type buttons + ParamKnob | `reverb.type` | "hall" | digital / hall / glass | — | none | yes | Convolver wet/dry, pre-delay; size/decay/damping/width bake the cached IR |
| `fx.reverb.mix` | FX panel ON/OFF, type buttons + ParamKnob | `reverb.mix` | 0.22 | 0 … 1 | — | fast | yes | Convolver wet/dry, pre-delay; size/decay/damping/width bake the cached IR |
| `fx.reverb.size` | FX panel ON/OFF, type buttons + ParamKnob | `reverb.size` | 0.6 | 0 … 1 | — | none | yes | Convolver wet/dry, pre-delay; size/decay/damping/width bake the cached IR |
| `fx.reverb.decay` | FX panel ON/OFF, type buttons + ParamKnob | `reverb.decay` | 0.55 | 0 … 1 | — | none | yes | Convolver wet/dry, pre-delay; size/decay/damping/width bake the cached IR |
| `fx.reverb.preDelay` | FX panel ON/OFF, type buttons + ParamKnob | `reverb.preDelay` | 0.02 | 0 … 0.2 | s | fast | yes | Convolver wet/dry, pre-delay; size/decay/damping/width bake the cached IR |
| `fx.reverb.damping` | FX panel ON/OFF, type buttons + ParamKnob | `reverb.damping` | 0.5 | 0 … 1 | — | none | yes | Convolver wet/dry, pre-delay; size/decay/damping/width bake the cached IR |
| `fx.reverb.width` | FX panel ON/OFF, type buttons + ParamKnob | `reverb.width` | 0.9 | 0 … 1 | — | none | yes | Convolver wet/dry, pre-delay; size/decay/damping/width bake the cached IR |
| `master.volume` | OUT panel ParamKnob | `master.volume` | 0.7 | 0 … 1 | — | fast | yes | masterGain / layer balance crossfade gains |
| `master.balance` | OUT panel ParamKnob | `master.balance` | 0 | -1 … 1 | — | fast | yes | masterGain / layer balance crossfade gains |

**Not in the patch registry (deliberately):** global pitch-bend range and
confirm-preset-change live in `tx80-settings` (localStorage); UI mode in
`tx80-ui-mode`; last preset id in `tx80-last-preset`. Pitch bend, mod
wheel, sustain, ribbon position and held notes are live performance state.
