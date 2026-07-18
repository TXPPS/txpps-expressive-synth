# Web to JUCE Equivalence

**Status:** Proposed translation contract; no JUCE implementation in this repo.

| Web                        | JUCE target                                         |
| -------------------------- | --------------------------------------------------- |
| Stable registry ID         | APVTS parameter ID (unchanged)                      |
| `AudioContext` lifecycle   | device/audio processor lifecycle                    |
| `FMVoice`                  | product-owned C++ voice                             |
| Gain-node envelopes        | sample/block envelope implementation                |
| Biquad low-pass            | JUCE DSP filter with matched mapping                |
| Constant-source pitch bend | per-voice/global pitch offset                       |
| Patch JSON                 | ValueTree/APVTS converter preserving schema version |

Rules:

1. IDs in `PARAMETER_CONTRACT.json` are immutable after release.
2. Keep preset fields readable through explicit aliases/migrations.
3. Validate DSP formulas and voice policy against `VALIDATION_TESTS.md`.
4. Browser startup, PWA, and Web MIDI limitations do not translate into DSP behavior.
5. Do not generate C++ by reverse-engineering React controls.
