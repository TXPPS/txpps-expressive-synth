import type {
  ParameterValue,
  SynthDiagnostics,
  SynthEngine,
  SynthRuntimeStatus,
} from "./contracts";

export interface ProofSubtractiveState {
  cutoff: number;
}

/**
 * Compile-only non-FM proof. It intentionally creates no AudioContext and is
 * not a product. Its only purpose is to keep the shared contract honest.
 */
export class ProofSubtractiveEngine implements SynthEngine<ProofSubtractiveState> {
  private state: ProofSubtractiveState = { cutoff: 12000 };
  private status: SynthRuntimeStatus = { phase: "idle", contextState: "none", error: null };
  private listeners = new Set<(status: SynthRuntimeStatus) => void>();

  async start(): Promise<void> {
    this.status = { phase: "ready", contextState: "running", error: null };
    for (const listener of this.listeners) listener(this.status);
  }

  async stop(): Promise<void> {
    this.status = { phase: "suspended", contextState: "suspended", error: null };
    for (const listener of this.listeners) listener(this.status);
  }

  dispose(): void {
    this.status = { phase: "disposed", contextState: "closed", error: null };
    this.listeners.clear();
  }

  isRunning(): boolean {
    return this.status.phase === "ready";
  }

  isUsable(): boolean {
    return this.status.phase !== "disposed";
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
      engineId: "proof.subtractive.silent",
      contextState: this.status.contextState,
      running: this.isRunning(),
      usable: this.isUsable(),
      activeVoices: 0,
    };
  }

  noteOn(): void {}
  noteOff(): void {}
  setSustain(): void {}
  panic(): void {}
  setPitchBend(): void {}
  setModulation(): void {}
  setPitchBendRange(): void {}

  setParameter(id: string, value: ParameterValue): ParameterValue {
    if (id !== "filter.cutoff" || typeof value !== "number") {
      throw new Error(`Unsupported proof parameter: ${id}`);
    }
    this.state = { cutoff: Math.min(20000, Math.max(20, value)) };
    return this.state.cutoff;
  }

  getParameter(id: string): ParameterValue {
    if (id !== "filter.cutoff") throw new Error(`Unsupported proof parameter: ${id}`);
    return this.state.cutoff;
  }

  loadState(state: ProofSubtractiveState): void {
    this.setParameter("filter.cutoff", state.cutoff);
  }

  exportState(): ProofSubtractiveState {
    return { ...this.state };
  }

  getAnalyser(): AnalyserNode | null {
    return null;
  }
}
