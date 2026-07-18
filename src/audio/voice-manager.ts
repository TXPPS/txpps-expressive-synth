/**
 * Voice Manager — handles voice allocation and polyphony.
 * 
 * - Allocates voices when a note is pressed (noteOn)
 * - Releases voices when a note is released (noteOff)
 * - Handles polyphony limits via oldest-note stealing
 * - Tracks active vs released voices
 */

import { getAudioContext } from "./context";
import { Voice, type VoiceParams } from "./voice";

export class VoiceManager {
  private voices: Map<number, Voice> = new Map(); // midi → Voice
  private activeVoices: Voice[] = [];
  private releasedVoices: Voice[] = [];
  private maxPolyphony: number = 8;
  private masterGain: GainNode;
  private voiceParams: VoiceParams;

  constructor(maxPolyphony: number, voiceParams: VoiceParams) {
    const ctx = getAudioContext();
    this.maxPolyphony = maxPolyphony;
    this.voiceParams = voiceParams;
    
    // Create master gain node
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.75;
    this.masterGain.connect(ctx.destination);
  }

  setVoiceParams(params: Partial<VoiceParams>) {
    this.voiceParams = { ...this.voiceParams, ...params };
    // Update all active voices
    for (const voice of this.activeVoices) {
      voice.updateParams(params);
    }
    for (const voice of this.releasedVoices) {
      voice.updateParams(params);
    }
  }

  setMasterLevel(level: number) {
    this.masterGain.gain.value = Math.max(0, Math.min(1, level));
  }

  noteOn(midiNote: number, velocity: number = 0.8) {
    // Check if already playing
    if (this.voices.has(midiNote)) {
      return;
    }

    // Allocate new voice
    const voice = new Voice(midiNote, velocity, this.voiceParams, this.masterGain);
    voice.trigger();

    this.voices.set(midiNote, voice);
    this.activeVoices.push(voice);

    // Enforce polyphony limit by stealing oldest note
    if (this.activeVoices.length > this.maxPolyphony) {
      const stealVoice = this.activeVoices.shift();
      if (stealVoice) {
        stealVoice.release();
        this.releasedVoices.push(stealVoice);
        const stolenMidi = stealVoice.getMidiNote();
        this.voices.delete(stolenMidi);
      }
    }
  }

  noteOff(midiNote: number) {
    const voice = this.voices.get(midiNote);
    if (!voice) return;

    // Move from active to released
    const idx = this.activeVoices.indexOf(voice);
    if (idx >= 0) {
      this.activeVoices.splice(idx, 1);
    }

    voice.release();
    this.releasedVoices.push(voice);
    this.voices.delete(midiNote);
  }

  panic() {
    // Stop all voices immediately
    for (const voice of this.activeVoices) {
      voice.stop();
    }
    for (const voice of this.releasedVoices) {
      voice.stop();
    }
    this.voices.clear();
    this.activeVoices = [];
    this.releasedVoices = [];
  }

  cleanup() {
    // Remove finished voices from released list
    this.releasedVoices = this.releasedVoices.filter((v) => {
      if (v.isReleased()) {
        v.stop();
        return false;
      }
      return true;
    });
  }

  getActiveName(): string {
    return `${this.activeVoices.length}/${this.maxPolyphony}`;
  }

  getMasterGain(): GainNode {
    return this.masterGain;
  }
}
