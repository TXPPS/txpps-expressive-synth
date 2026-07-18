# Modulation Graph

**Status:** Verified from `engine.ts`, `voice.ts`, and `algorithms.ts`.

- Operator outputs modulate oscillator frequency according to algorithms 1–6.
- One algorithm-selected operator may feed back into its own frequency.
- Pitch bend: shared constant source → every operator detune; global range 1–12 semitones.
- MOD: fixed 5 Hz sine → shared depth (0–30 cents) → every operator detune.
- Velocity scales final voice output; `velocity.sensitivity` shapes the amount.
- No modulation matrix, aftertouch, expression, MIDI learn, or per-patch LFO.
- Vintage drift is an amplitude modulation path despite its label.

Native implementations must preserve routing and formulas before optimizing.
