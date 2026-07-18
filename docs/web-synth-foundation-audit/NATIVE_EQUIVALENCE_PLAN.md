# Native Equivalence Plan

**Purpose:** Every future web synth must be translatable to JUCE (VST3 / standalone / possible AUv3) **without reverse-engineering the web UI**.

Web implementation is a **runtime**, not the sole behavioral source of truth.

---

## Permanent package: `native-reference/`

Required artifacts per product (and shared templates in foundation):

| File                         | Role                                                |
| ---------------------------- | --------------------------------------------------- |
| `PARAMETER_CONTRACT.json`    | Stable IDs, ranges, defaults, units, automate flags |
| `STATE_SCHEMA.json`          | Patch + global settings + library envelope          |
| `DSP_BEHAVIOR_SPEC.md`       | Signal flow, algorithms, nonlinearities, timing     |
| `MODULATION_GRAPH.md`        | Sources → destinations; fixed vs matrix             |
| `VOICE_ARCHITECTURE.md`      | Polyphony, steal, mono, glide, sustain              |
| `PRESET_FORMAT.md`           | File schemas, versioning, product tag               |
| `UI_CONTROL_MAPPING.md`      | Control → parameter ID (not pixel specs)            |
| `WEB_TO_JUCE_EQUIVALENCE.md` | Node/class mapping, known deltas                    |
| `DEVICE_LIMITATIONS.md`      | Web MIDI, iOS audio, offline, latency               |
| `VALIDATION_TESTS.md`        | Shared cases web + native must pass                 |

---

## TX27 starter mapping (evidence-based)

### Parameter ID proposal (do not silently rename live presets)

Introduce **aliases** first; keep JSON field paths as `migrateFrom`:

| Proposed APVTS ID           | Current field                 | Scope  |
| --------------------------- | ----------------------------- | ------ |
| `algo`                      | `algorithm`                   | patch  |
| `op1.ratio` … `op4.release` | `operators[i].*`              | patch  |
| `op1.enabled` …             | `operators[i].enabled`        | patch  |
| `fm.depth`                  | `fmDepth`                     | patch  |
| `fm.feedback`               | `feedback`                    | patch  |
| `vel.sens`                  | `velocitySens`                | patch  |
| `voice.mode`                | `voiceMode`                   | patch  |
| `voice.polyphony`           | `polyphony`                   | patch  |
| `glide.time`                | `glide`                       | patch  |
| `glide.mode`                | `glideMode`                   | patch  |
| `env.masterAttack`          | `masterAttack`                | patch  |
| `env.masterRelease`         | `masterRelease`               | patch  |
| `filter.cutoff`             | `filter.cutoff`               | patch  |
| `filter.resonance`          | `filter.resonance`            | patch  |
| `fx.chorus.*`               | `chorus.*`                    | patch  |
| `fx.delay.*`                | `delay.*`                     | patch  |
| `fx.reverb.*`               | `reverb.*`                    | patch  |
| `vintage.*`                 | `vintage.*`                   | patch  |
| `master.volume`             | `masterVolume`                | patch  |
| `perf.bendRange`            | settings `bendRangeSemitones` | global |

Legacy `pitchBendRangeSemitones` on patch: migrate → ignore on load; preserve on export if needed for old files.

### DSP behavior notes for native parity

- 4 sine operators; FM via AudioParam frequency modulation (web) → native equivalent must document **modulation index formula** (`destHz * fmDepth * 4`, feedback `opHz * feedback * 2`)
- Algorithms 1–6 exactly as `algorithms.ts`
- Post-voice LPF + chorus/delay/reverb/vintage/limiter order
- Vintage `drift` currently = amplitude LFO — **spec must say what product intends** before JUCE copies a bug
- Reverb IR: early reflections use `Math.random` — native should use seeded RNG for determinism

### Voice architecture

- Steal: oldest active
- Polyphony: 4/8/12
- Mono: last-note priority + heldOrder return
- Glide modes: off / poly / mono legato
- Sustain by note number

---

## Web → JUCE equivalence principles

1. Parameter IDs identical in web contract and APVTS
2. Preset JSON round-trips both hosts (or documented converter)
3. Validation tests shared numerically where possible (envelope times, filter mapping)
4. Document intentional deltas (browser latency, missing MIDI on iOS web)
5. UI mapping doc does not dictate JUCE LookAndFeel — only parameter bindings

---

## Route toward plugins

| Target          | Approach                                            |
| --------------- | --------------------------------------------------- |
| JUCE standalone | Same DSP spec + APVTS                               |
| VST3            | Same                                                |
| AUv3            | Same DSP; note iOS audio session differences vs PWA |
| Web remains PWA | Not abandoned; parallel product surface             |

Do **not** auto-generate JUCE from React. Generate/maintain **contracts**; implement DSP twice against the same tests.
