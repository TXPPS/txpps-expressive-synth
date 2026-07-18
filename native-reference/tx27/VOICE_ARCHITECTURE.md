# Voice Architecture

**Status:** Verified from `src/lib/audio/engine.ts`.

- Polyphony choices: 4, 8, 12.
- Voice stealing: oldest active voice.
- Mono priority: last-held note; releasing returns to most-recent still-held note.
- Glide modes: `off`, `poly`, `mono` (legato).
- Sustain tracks MIDI note numbers and releases on pedal-up.
- Panic clears voices, held/sustained notes, mono state, glide history, and pitch bend.
- MOD remains latched after panic.

Known defect: mono `retune()` changes oscillator frequency but not previously calculated FM/feedback gains, changing effective FM index.
