import type { SynthEngine, SynthRuntimeStatus } from "./contracts";

export interface SynthRuntimeOptions<State> {
  createEngine: () => SynthEngine<State>;
  timeoutMs?: number;
  setTimeoutFn?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (handle: ReturnType<typeof setTimeout>) => void;
}

/**
 * Small browser-lifecycle coordinator. It owns no DSP or UI state: it only
 * creates/recreates one product engine, deduplicates activation attempts, and
 * reconciles late AudioContext state changes after a timeout.
 */
export class SynthRuntime<State> {
  private engine: SynthEngine<State> | null = null;
  private engineUnsubscribe: (() => void) | null = null;
  private activation: Promise<boolean> | null = null;
  private listeners = new Set<(status: SynthRuntimeStatus) => void>();
  private pendingNotes = new Map<number, number>();
  private status: SynthRuntimeStatus = {
    phase: "idle",
    contextState: "none",
    error: null,
  };
  private readonly timeoutMs: number;
  private readonly setTimeoutFn: NonNullable<SynthRuntimeOptions<State>["setTimeoutFn"]>;
  private readonly clearTimeoutFn: NonNullable<SynthRuntimeOptions<State>["clearTimeoutFn"]>;

  constructor(private readonly options: SynthRuntimeOptions<State>) {
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.setTimeoutFn = options.setTimeoutFn ?? ((callback, ms) => setTimeout(callback, ms));
    this.clearTimeoutFn = options.clearTimeoutFn ?? ((handle) => clearTimeout(handle));
  }

  getEngine(): SynthEngine<State> | null {
    return this.engine;
  }

  getStatus(): SynthRuntimeStatus {
    return this.status;
  }

  subscribe(listener: (status: SynthRuntimeStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private publish(status: SynthRuntimeStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  private attachEngine(engine: SynthEngine<State>): void {
    this.engineUnsubscribe?.();
    this.engine = engine;
    this.engineUnsubscribe = engine.subscribeRuntimeStatus((next) => {
      // resume() cannot be cancelled. If it succeeds after our timeout,
      // running audio is authoritative and stale failure UI must be cleared.
      if (next.contextState === "running" || next.phase === "ready") {
        this.publish({ phase: "ready", contextState: "running", error: null });
        return;
      }
      if (this.status.phase === "starting" || this.status.phase === "recovering") return;
      this.publish({
        phase: next.phase === "failed" ? "failed" : "suspended",
        contextState: next.contextState,
        error: next.error,
      });
    });
  }

  private replaceEngine(): SynthEngine<State> {
    this.engineUnsubscribe?.();
    this.engineUnsubscribe = null;
    this.engine?.dispose();
    const engine = this.options.createEngine();
    this.attachEngine(engine);
    return engine;
  }

  activate(): Promise<boolean> {
    if (this.engine?.isRunning()) {
      this.publish({ phase: "ready", contextState: "running", error: null });
      return Promise.resolve(true);
    }
    if (this.activation) return this.activation;

    const recovering = !!this.engine && !this.engine.isUsable();
    const engine = !this.engine || recovering ? this.replaceEngine() : this.engine;
    this.publish({
      phase: recovering ? "recovering" : "starting",
      contextState: engine.getRuntimeStatus().contextState,
      error: null,
    });

    // start() is invoked before any await so mobile user activation is kept.
    const startPromise = engine.start();
    const activation = new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (result: boolean, error: Error | null = null) => {
        if (settled) return;
        settled = true;
        this.clearTimeoutFn(timeout);
        if (result || engine.isRunning()) {
          this.publish({ phase: "ready", contextState: "running", error: null });
          resolve(true);
          return;
        }
        this.publish({
          phase: "failed",
          contextState: engine.getRuntimeStatus().contextState,
          error,
        });
        resolve(false);
      };
      const timeout = this.setTimeoutFn(() => {
        const error = new Error(`audio activation timed out after ${this.timeoutMs}ms`);
        error.name = "TimeoutError";
        finish(false, error);
      }, this.timeoutMs);
      startPromise.then(
        () => finish(engine.isRunning()),
        (reason) => finish(false, reason instanceof Error ? reason : new Error(String(reason))),
      );
    }).finally(() => {
      if (this.activation === activation) this.activation = null;
    });
    this.activation = activation;
    return activation;
  }

  /** Preserve notes pressed during activation; noteOff can cancel them. */
  playNote(note: number, velocity = 1): Promise<boolean> {
    if (this.engine?.isRunning()) {
      this.engine.noteOn(note, velocity);
      return Promise.resolve(true);
    }
    this.pendingNotes.set(note, velocity);
    return this.activate().then((running) => {
      if (!running || !this.engine?.isRunning()) return false;
      for (const [pendingNote, pendingVelocity] of this.pendingNotes) {
        this.engine.noteOn(pendingNote, pendingVelocity);
      }
      this.pendingNotes.clear();
      return true;
    });
  }

  releaseNote(note: number): void {
    this.pendingNotes.delete(note);
    this.engine?.noteOff(note);
  }

  panic(): void {
    this.pendingNotes.clear();
    this.engine?.panic();
  }

  async stop(): Promise<void> {
    await this.engine?.stop();
    const running = this.engine?.isRunning() ?? false;
    this.publish({
      phase: running ? "ready" : "suspended",
      contextState: this.engine?.getRuntimeStatus().contextState ?? "none",
      error: null,
    });
  }

  dispose(): void {
    this.engineUnsubscribe?.();
    this.engineUnsubscribe = null;
    this.engine?.dispose();
    this.engine = null;
    this.activation = null;
    this.pendingNotes.clear();
    this.publish({ phase: "disposed", contextState: "closed", error: null });
    this.listeners.clear();
  }
}
