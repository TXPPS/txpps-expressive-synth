/**
 * Audio utilities
 */

/**
 * Convert MIDI note number to frequency in Hz
 * 
 * A4 (MIDI 69) = 440 Hz
 */
export function midiToFreq(midi: number, baseFreq: number = 440): number {
  return baseFreq * Math.pow(2, (midi - 69) / 12);
}

/**
 * Convert frequency to MIDI note number
 */
export function freqToMidi(freq: number, baseFreq: number = 440): number {
  return 69 + 12 * Math.log2(freq / baseFreq);
}

/**
 * Convert dB to linear gain
 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Convert linear gain to dB
 */
export function gainToDb(gain: number): number {
  return 20 * Math.log10(gain);
}
