export type ParameterValue = number | string | boolean;

export interface ParameterDefinition {
  /** Stable machine ID. Never derived from a display label. */
  id: string;
  name: string;
  defaultValue: ParameterValue;
  minimum?: number;
  maximum?: number;
  step?: number;
  unit?: string;
  category?: string;
  automatable?: boolean;
  midiAssignable?: boolean;
  choices?: readonly ParameterValue[];
}

export type SynthRuntimePhase =
  "idle" | "starting" | "recovering" | "ready" | "suspended" | "failed" | "disposed";

export interface SynthRuntimeStatus {
  phase: SynthRuntimePhase;
  contextState: string;
  error: Error | null;
}

export interface SynthDiagnostics {
  engineId: string;
  contextState: string;
  running: boolean;
  usable: boolean;
  activeVoices?: number;
}

/**
 * Product-neutral boundary used by the application shell and input systems.
 * Product patch/state shapes stay behind the generic State type.
 */
export interface SynthEngine<State> {
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): void;

  isRunning(): boolean;
  isUsable(): boolean;
  getRuntimeStatus(): SynthRuntimeStatus;
  subscribeRuntimeStatus(listener: (status: SynthRuntimeStatus) => void): () => void;
  getDiagnostics(): SynthDiagnostics;

  noteOn(note: number, velocity?: number): void;
  noteOff(note: number): void;
  setSustain(down: boolean): void;
  panic(): void;

  setPitchBend(normalized: number): void;
  setModulation(normalized: number): void;
  setPitchBendRange(semitones: number): void;

  setParameter(id: string, value: ParameterValue): ParameterValue;
  getParameter(id: string): ParameterValue;
  loadState(state: State): void;
  exportState(): State;

  getAnalyser(): AnalyserNode | null;
}

export interface ProductManifest {
  id: string;
  name: string;
  shortName: string;
  version: string;
  engineId: string;
  presetProduct: string;
  parameterContract: string;
  uiSections: readonly string[];
  theme: Readonly<Record<string, string>>;
}

export interface SynthProductAdapter<State> {
  manifest: ProductManifest;
  parameters: readonly ParameterDefinition[];
  createEngine(initialState: State, initialBendRangeSemitones?: number): SynthEngine<State>;
  createDefaultState(): State;
}
