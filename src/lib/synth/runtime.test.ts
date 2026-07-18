import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ParameterValue,
  SynthDiagnostics,
  SynthEngine,
  SynthRuntimeStatus,
} from "./contracts";
import { SynthRuntime } from "./runtime";

interface TestState {
  value: number;
}

class FakeEngine implements SynthEngine<TestState> {
  state: TestState = { value: 0 };
  status: SynthRuntimeStatus;
  usable = true;
  startCalls = 0;
  disposeCalls = 0;
  panicCalls = 0;
  noteOns: Array<[number, number]> = [];
  noteOffs: number[] = [];
  private listeners = new Set<(status: SynthRuntimeStatus) => void>();
  private startResolver: (() => void) | null = null;
  startMode: "immediate" | "deferred" = "immediate";

  constructor(contextState: string = "suspended") {
    this.status = { phase: "suspended", contextState, error: null };
  }

  emit(contextState: string, phase = contextState === "running" ? "ready" : "suspended"): void {
    this.status = { phase: phase as SynthRuntimeStatus["phase"], contextState, error: null };
    for (const listener of this.listeners) listener(this.status);
  }

  resolveStart(): void {
    this.emit("running", "ready");
    this.startResolver?.();
    this.startResolver = null;
  }

  start(): Promise<void> {
    this.startCalls++;
    if (this.startMode === "immediate") {
      this.emit("running", "ready");
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.startResolver = resolve;
    });
  }

  async stop(): Promise<void> {
    this.emit("suspended");
  }

  dispose(): void {
    this.disposeCalls++;
    this.usable = false;
    this.emit("closed", "disposed");
  }

  isRunning(): boolean {
    return this.status.contextState === "running";
  }

  isUsable(): boolean {
    return this.usable && this.status.contextState !== "closed";
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
      engineId: "fake",
      contextState: this.status.contextState,
      running: this.isRunning(),
      usable: this.isUsable(),
    };
  }

  noteOn(note: number, velocity = 1): void {
    this.noteOns.push([note, velocity]);
  }
  noteOff(note: number): void {
    this.noteOffs.push(note);
  }
  setSustain(): void {}
  panic(): void {
    this.panicCalls++;
  }
  setPitchBend(): void {}
  setModulation(): void {}
  setPitchBendRange(): void {}
  setParameter(_id: string, value: ParameterValue): ParameterValue {
    return value;
  }
  getParameter(): ParameterValue {
    return this.state.value;
  }
  loadState(state: TestState): void {
    this.state = { ...state };
  }
  exportState(): TestState {
    return { ...this.state };
  }
  getAnalyser(): AnalyserNode | null {
    return null;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("SynthRuntime lifecycle simulations", () => {
  it.each(["suspended", "interrupted"])("starts from %s state", async (state) => {
    const engine = new FakeEngine(state);
    const runtime = new SynthRuntime({ createEngine: () => engine });
    await expect(runtime.activate()).resolves.toBe(true);
    expect(runtime.getStatus().phase).toBe("ready");
    expect(engine.startCalls).toBe(1);
  });

  it("recreates a closed engine", async () => {
    const first = new FakeEngine();
    const second = new FakeEngine();
    let creates = 0;
    const runtime = new SynthRuntime({
      createEngine: () => (++creates === 1 ? first : second),
    });
    await runtime.activate();
    first.usable = false;
    first.emit("closed");
    await runtime.activate();
    expect(creates).toBe(2);
    expect(first.disposeCalls).toBe(1);
    expect(second.startCalls).toBe(1);
  });

  it("times out a hanging resume and allows another activation attempt", async () => {
    vi.useFakeTimers();
    const engine = new FakeEngine();
    engine.startMode = "deferred";
    const runtime = new SynthRuntime({ createEngine: () => engine, timeoutMs: 20 });
    const first = runtime.activate();
    await vi.advanceTimersByTimeAsync(20);
    await expect(first).resolves.toBe(false);
    expect(runtime.getStatus().phase).toBe("failed");
    const retry = runtime.activate();
    expect(engine.startCalls).toBe(2);
    engine.resolveStart();
    await expect(retry).resolves.toBe(true);
  });

  it("reconciles a late successful resume after timeout", async () => {
    vi.useFakeTimers();
    const engine = new FakeEngine();
    engine.startMode = "deferred";
    const runtime = new SynthRuntime({ createEngine: () => engine, timeoutMs: 20 });
    const activation = runtime.activate();
    await vi.advanceTimersByTimeAsync(20);
    await expect(activation).resolves.toBe(false);
    expect(runtime.getStatus().phase).toBe("failed");
    engine.resolveStart();
    await Promise.resolve();
    expect(runtime.getStatus()).toMatchObject({
      phase: "ready",
      contextState: "running",
      error: null,
    });
  });

  it("deduplicates repeated activation and engine initialization", async () => {
    const engine = new FakeEngine();
    engine.startMode = "deferred";
    let creates = 0;
    const runtime = new SynthRuntime({
      createEngine: () => {
        creates++;
        return engine;
      },
    });
    const first = runtime.activate();
    const second = runtime.activate();
    expect(first).toBe(second);
    expect(creates).toBe(1);
    expect(engine.startCalls).toBe(1);
    engine.resolveStart();
    await expect(first).resolves.toBe(true);
  });

  it("preserves a first note during activation and cancels released pending notes", async () => {
    const engine = new FakeEngine();
    engine.startMode = "deferred";
    const runtime = new SynthRuntime({ createEngine: () => engine });
    const firstNote = runtime.playNote(60, 0.8);
    const releasedNote = runtime.playNote(64, 0.7);
    runtime.releaseNote(64);
    engine.resolveStart();
    await expect(firstNote).resolves.toBe(true);
    await expect(releasedNote).resolves.toBe(true);
    expect(engine.noteOns).toEqual([[60, 0.8]]);
    expect(engine.noteOffs).toContain(64);
  });

  it("panic clears pending notes and delegates to the engine", async () => {
    const engine = new FakeEngine();
    engine.startMode = "deferred";
    const runtime = new SynthRuntime({ createEngine: () => engine, timeoutMs: 10 });
    void runtime.playNote(60);
    runtime.panic();
    engine.resolveStart();
    await Promise.resolve();
    expect(engine.noteOns).toEqual([]);
    expect(engine.panicCalls).toBe(1);
  });
});
