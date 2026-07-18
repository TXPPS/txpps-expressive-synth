# DSP Behavior Spec

**Status:** Verified from source; physical/audio golden comparison missing.

Signal path:

`FMVoice → voice bus → Vintage Circuit → low-pass → chorus → delay → reverb → limiter → master → analyser → output`

Source: `src/lib/audio/engine.ts`.

- Four sine operators; routing is defined in `algorithms.ts`.
- Operator envelopes and FM index behavior are in `voice.ts`.
- FM modulation gain: destination frequency × `fm.depth` × 4.
- Feedback gain: feedback-operator frequency × `fm.feedback` × 2.
- Master limiter: threshold −6 dB, ratio 12:1.
- Active voice edits: filter/FX/master update live; operator/algorithm edits affect new voices only.
- Known mismatch: `vintage.drift` currently modulates amplitude, not pitch.
- Reverb early reflections are not fully deterministic (`Math.random`).

Do not “correct” known behavior in native code without a product decision and validation test.
