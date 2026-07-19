import type {
  ParameterValue,
  SynthDiagnostics,
  SynthEngine,
  SynthProductAdapter,
  SynthRuntimeStatus,
} from "../runtime/contracts";
import { TX80Engine } from "./engine/engine";
import { getTx80Parameter, setTx80Parameter, TX80_PARAMETER_DEFINITIONS } from "./parameters";
import { TX80_FACTORY_PRESETS } from "./presets";
import { cloneTx80Patch, TX80_INIT_PATCH, type Tx80Patch } from "./types";

/** TX-80 product engine behind the product-neutral SynthEngine boundary.
 *  The application shell (route) talks only to this interface plus the
 *  TX-80-specific performance extensions (ribbon). */
export class TX80ProductEngine implements SynthEngine<Tx80Patch> {
  private state: Tx80Patch;
  readonly engine: TX80Engine;
  private listeners = new Set<(status: SynthRuntimeStatus) => void>();
  private status: SynthRuntimeStatus = {
    phase: "idle",
    contextState: "none",
    error: null,
  };

  constructor(initialState: Tx80Patch, initialBendRangeSemitones = 2) {
    this.state = cloneTx80Patch(initialState);
    this.engine = new TX80Engine(this.state, initialBendRangeSemitones);
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
      engineId: "tx80.dual2",
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

  // ── TX-80 performance extensions (ribbon) ──────────────────────────────

  setRibbonPosition(norm: number): void {
    this.engine.setRibbonPosition(norm);
  }

  releaseRibbon(): void {
    this.engine.releaseRibbon();
  }

  setParameter(id: string, value: ParameterValue): ParameterValue {
    this.state = setTx80Parameter(this.state, id, value);
    this.engine.setPatch(this.state);
    return getTx80Parameter(this.state, id);
  }

  getParameter(id: string): ParameterValue {
    return getTx80Parameter(this.state, id);
  }

  loadState(state: Tx80Patch): void {
    this.state = cloneTx80Patch(state);
    this.engine.loadPatch(this.state);
  }

  exportState(): Tx80Patch {
    return cloneTx80Patch(this.state);
  }

  getAnalyser(): AnalyserNode | null {
    return this.engine.isUsable() ? this.engine.getAnalyser() : null;
  }
}

export const TX80_PRODUCT: SynthProductAdapter<Tx80Patch> & {
  factoryPresets: typeof TX80_FACTORY_PRESETS;
} = {
  manifest: {
    id: "txpps.tx80",
    name: "TXPPS TX-80",
    shortName: "TX-80",
    version: "1.0.0",
    engineId: "tx80.dual2",
    presetProduct: "TXPPS TX-80",
    parameterContract: "txpps.tx80.parameters.v1",
    uiSections: ["layer1", "layer2", "performance", "modulation", "effects", "master"],
    theme: {
      background: "#16140f",
      accent: "#ffb454",
    },
  },
  parameters: TX80_PARAMETER_DEFINITIONS,
  factoryPresets: TX80_FACTORY_PRESETS,
  createDefaultState: () => cloneTx80Patch(TX80_INIT_PATCH),
  createEngine: (initialState, initialBendRangeSemitones) =>
    new TX80ProductEngine(initialState, initialBendRangeSemitones),
};
