/**
 * TX-80 Audio Engine
 * 
 * Main orchestrator that:
 * - Manages AudioContext lifecycle
 * - Routes store parameter changes to synthesis components
 * - Handles noteOn/noteOff from keyboard
 * - Manages voice allocation and polyphony
 * - Handles panic
 */

import { getAudioContext, isAudioContextRunning, resumeAudioContext } from "./context";
import { VoiceManager } from "./voice-manager";
import { type VoiceParams } from "./voice";
import { type PatchValues } from "@/state/params";

let engine: AudioEngine | null = null;

export class AudioEngine {
  private voiceManager: VoiceManager | null = null;
  private currentPatch: PatchValues | null = null;
  private isInitialized: boolean = false;

  async initialize(patch: PatchValues) {
    if (this.isInitialized) return;

    try {
      // Ensure AudioContext is ready
      await resumeAudioContext();
      
      if (!isAudioContextRunning()) {
        throw new Error("AudioContext failed to resume");
      }

      this.currentPatch = patch;

      // Create voice manager with default polyphony
      const maxPoly = (patch["master.polyphony"] as number) || 8;
      const voiceParams = this.extractVoiceParams(patch);
      this.voiceManager = new VoiceManager(maxPoly, voiceParams);

      this.isInitialized = true;
    } catch (error) {
      console.error("Audio engine initialization failed:", error);
      throw error;
    }
  }

  noteOn(midiNote: number, velocity: number = 0.8) {
    if (!this.voiceManager) return;
    this.voiceManager.noteOn(midiNote, velocity);
  }

  noteOff(midiNote: number) {
    if (!this.voiceManager) return;
    this.voiceManager.noteOff(midiNote);
  }

  panic() {
    if (!this.voiceManager) return;
    this.voiceManager.panic();
  }

  setParam(id: string, value: number | string | boolean) {
    if (!this.voiceManager || !this.currentPatch) return;

    this.currentPatch[id] = value;

    // Route parameter to appropriate component
    if (id === "master.level") {
      this.voiceManager.setMasterLevel(value as number);
    } else if (id.startsWith("layerI.") || id.startsWith("layerII.")) {
      // Update layer parameters on all voices
      const params = this.extractVoiceParams(this.currentPatch);
      this.voiceManager.setVoiceParams(params);
    } else if (id === "master.polyphony") {
      // TODO: reconfigure voice manager polyphony
    }
  }

  private extractVoiceParams(patch: PatchValues): VoiceParams {
    // Layer I parameters (could be extended for Layer II switching)
    const scope = "layerI";
    return {
      wave: (patch[`${scope}.osc.wave`] as any) || "saw",
      octaveShift: (patch[`${scope}.osc.octave`] as number) || 0,
      tune: (patch[`${scope}.osc.tune`] as number) || 0,
      fine: (patch[`${scope}.osc.fine`] as number) || 0,
      pw: (patch[`${scope}.osc.pw`] as number) || 0.5,
      pwm: (patch[`${scope}.osc.pwm`] as number) || 0,
      
      subLevel: (patch[`${scope}.sub.level`] as number) || 0,
      noiseLevel: (patch[`${scope}.noise.level`] as number) || 0,
      oscLevel: (patch[`${scope}.mix.osc`] as number) || 0.85,
      
      filterCutoff: (patch[`${scope}.filt.cutoff`] as number) || 2200,
      filterResonance: (patch[`${scope}.filt.reso`] as number) || 0.15,
      filterKeyTrack: (patch[`${scope}.filt.kbd`] as number) || 0.4,
      filterEnvAmount: (patch[`${scope}.filt.envAmt`] as number) || 0.35,
      
      ampEnvParams: {
        attack: (patch[`${scope}.env.a.a`] as number) || 0.005,
        decay: (patch[`${scope}.env.a.d`] as number) || 0.4,
        sustain: (patch[`${scope}.env.a.s`] as number) || 0.8,
        release: (patch[`${scope}.env.a.r`] as number) || 0.35,
      },
      
      filterEnvParams: {
        attack: (patch[`${scope}.env.f.a`] as number) || 0.005,
        decay: (patch[`${scope}.env.f.d`] as number) || 0.8,
        sustain: (patch[`${scope}.env.f.s`] as number) || 0.3,
        release: (patch[`${scope}.env.f.r`] as number) || 0.6,
      },
      
      pan: (patch[`${scope}.layer.pan`] as number) || 0,
    };
  }

  getStatus(): string {
    if (!this.isInitialized) return "idle";
    if (!isAudioContextRunning()) return "suspended";
    return "running";
  }
}

export function getAudioEngine(): AudioEngine {
  if (!engine) {
    engine = new AudioEngine();
  }
  return engine;
}
