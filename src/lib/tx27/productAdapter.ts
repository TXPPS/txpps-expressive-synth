import { TX27Engine } from "../audio/engine";
import { INIT_PATCH, type Patch } from "../audio/types";
import { DEFAULT_SETTINGS } from "../settings";
import { FACTORY_PRESETS, clonePatch } from "../presets";
import type {
  ParameterValue,
  SynthDiagnostics,
  SynthEngine,
  SynthProductAdapter,
  SynthRuntimeStatus,
} from "../synth/contracts";
import { getTx27Parameter, setTx27Parameter, TX27_PARAMETER_DEFINITIONS } from "./parameters";

export class TX27ProductEngine implements SynthEngine<Patch> {
  private state: Patch;
  private readonly engine: TX27Engine;
  private listeners = new Set<(status: SynthRuntimeStatus) => void>();
  private status: SynthRuntimeStatus = {
    phase: "idle",
    contextState: "none",
    error: null,
  };

  constructor(initialState: Patch, initialBendRangeSemitones = 2) {
    this.state = clonePatch(initialState);
    this.engine = new TX27Engine(this.state, initialBendRangeSemitones);
    this.engine.onStateChange = (contextState) => {
      this.publish({
        phase: contextState === "running" ? "ready" : "suspended",
        contextState,
        error: null,
      });
    };
  }

  private publish(status: SynthRuntimeStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  async start(): Promise<void> {
    this.publish({
      phase: this.engine.contextState() === "none" ? "starting" : "recovering",
      contextState: this.engine.contextState(),
      error: null,
    });
    try {
      await this.engine.start();
      this.publish({
        phase: this.engine.isRunning() ? "ready" : "suspended",
        contextState: this.engine.contextState(),
        error: null,
      });
    } catch (reason) {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.publish({
        phase: "failed",
        contextState: this.engine.contextState(),
        error,
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.engine.stop();
    this.publish({
      phase: this.engine.isRunning() ? "ready" : "suspended",
      contextState: this.engine.contextState(),
      error: null,
    });
  }

  dispose(): void {
    this.engine.destroy();
    this.listeners.clear();
    this.status = { phase: "disposed", contextState: "closed", error: null };
  }

  isRunning(): boolean {
    return this.engine.isRunning();
  }

  isUsable(): boolean {
    return this.engine.isUsable();
  }

  getRuntimeStatus(): SynthRuntimeStatus {
    return this.status;
  }

  subscribeRuntimeStatus(listener: (status: SynthRuntimeStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  getDiagnostics(): SynthDiagnostics {
    return {
      engineId: "tx27.fm4",
      contextState: this.engine.contextState(),
      running: this.engine.isRunning(),
      usable: this.engine.isUsable(),
      activeVoices: this.engine.activeVoiceCount(),
    };
  }

  noteOn(note: number, velocity = 1): void {
    this.engine.noteOn(note, velocity);
  }

  noteOff(note: number): void {
    this.engine.noteOff(note);
  }

  setSustain(down: boolean): void {
    this.engine.setSustain(down);
  }

  panic(): void {
    this.engine.panic();
  }

  setPitchBend(normalized: number): void {
    this.engine.setPitchBend(normalized);
  }

  setModulation(normalized: number): void {
    this.engine.setModWheel(normalized);
  }

  setPitchBendRange(semitones: number): void {
    this.engine.setPitchBendRange(semitones);
  }

  setParameter(id: string, value: ParameterValue): ParameterValue {
    this.state = setTx27Parameter(this.state, id, value);
    this.engine.setPatch(this.state);
    return getTx27Parameter(this.state, id);
  }

  getParameter(id: string): ParameterValue {
    return getTx27Parameter(this.state, id);
  }

  loadState(state: Patch): void {
    this.state = clonePatch(state);
    this.engine.setPatch(this.state);
  }

  exportState(): Patch {
    return clonePatch(this.state);
  }

  getAnalyser(): AnalyserNode | null {
    return this.engine.isUsable() ? this.engine.getAnalyser() : null;
  }
}

export const TX27_PRODUCT: SynthProductAdapter<Patch> & {
  factoryPresets: readonly Patch[];
  defaultSettings: typeof DEFAULT_SETTINGS;
} = {
  manifest: {
    id: "txpps.tx27",
    name: "TXPPS TX27",
    shortName: "TX27",
    version: "1.0.0",
    engineId: "tx27.fm4",
    presetProduct: "TXPPS TX27",
    parameterContract: "txpps.tx27.parameters.v1",
    uiSections: ["operators", "algorithm", "voice", "mix", "vintage", "effects"],
    theme: {
      background: "#1a1815",
      accent: "#d8b56a",
    },
  },
  parameters: TX27_PARAMETER_DEFINITIONS,
  factoryPresets: FACTORY_PRESETS,
  defaultSettings: DEFAULT_SETTINGS,
  createDefaultState: () => clonePatch(INIT_PATCH),
  createEngine: (initialState, initialBendRangeSemitones) =>
    new TX27ProductEngine(initialState, initialBendRangeSemitones),
};
