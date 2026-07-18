import { buildIR } from "../../audio/reverb";
import type { ChorusParams, DelayParams, ReverbParams } from "../../audio/types";
import { clampBendRange } from "../storage";
import type { LfoDestination, Tx80Layer, Tx80Lfo, Tx80Patch } from "../types";
import { cloneTx80Patch } from "../types";
import { Tx80Voice, type PitchTravel, type Tx80SharedNodes } from "./voice";

interface ActiveVoice {
  voice: Tx80Voice;
  note: number;
  startedAt: number;
}

/** Shallow equality over flat parameter objects (primitives only). */
function flatEq<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  for (const k in a) if (a[k] !== b[k]) return false;
  for (const k in b) if (!(k in a)) return false;
  return true;
}

/** Bound an AudioContext state-transition promise. On iOS, resume() (and
 *  occasionally suspend()) can return promises that NEVER settle. An
 *  unbounded await wedges the whole init path for the rest of the session.
 *  Rejects with a named TimeoutError instead. (Proven in TX27.) */
function withTimeout(p: Promise<unknown>, ms: number, label: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.name = "TimeoutError";
      reject(err);
    }, ms);
    p.then(
      () => {
        window.clearTimeout(t);
        resolve();
      },
      (e) => {
        window.clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/** iOS reports a non-standard "interrupted" state. Treat every non-running,
 *  non-closed state as resumable. */
function needsResume(state: AudioContextState): boolean {
  return state !== "running" && (state as string) !== "closed";
}

/** Per-destination scaling of a normalized LFO depth (0..1). */
const LFO_SCALE = {
  pitch: 100, // cents
  filter: 3600, // cents (3 octaves)
  pw: 0.45, // comparator-offset units
  amp: 0.5, // gain around the compensated base
  pan: 1, // pan units
  balance: 0.5, // gain around the balance base
} as const;

export class TX80Engine {
  ctx!: AudioContext;
  private patch: Tx80Patch;
  private voices: ActiveVoice[] = [];
  /** Press counts per note (a note can be stacked by multiple pointers). */
  private heldNotes = new Map<number, number>();
  private heldOrder: number[] = [];
  /** Deferred releases while the sustain pedal is down (note → count). */
  private sustained = new Map<number, number>();
  private sustainDown = false;
  private monoVoice: Tx80Voice | null = null;
  private lastPitch: number | null = null;

  // ── Buses ──────────────────────────────────────────────────────────────
  private layerVoiceBus: GainNode[] = [];
  private layerLevel: GainNode[] = [];
  private layerBalance: GainNode[] = [];
  private layerPan: StereoPannerNode[] = [];
  private mixBus!: GainNode;
  private tremolo!: GainNode;

  // ── Shared modulation sources ──────────────────────────────────────────
  private shared: Tx80SharedNodes | null = null;
  private modWheelLFO: OscillatorNode | null = null;
  private modWheelDepth: GainNode | null = null;
  private lfoOsc: (OscillatorNode | null)[] = [null, null];
  private lfoDepth: (GainNode | null)[] = [null, null];
  private balanceInvert: GainNode | null = null;
  private lastBendNorm = 0;
  private bendRangeSemitones = 2;
  private ribbonCents = 0;

  // ── Effects ────────────────────────────────────────────────────────────
  private chorusIn!: GainNode;
  private chorusOut!: GainNode;
  private chorusDry!: GainNode;
  private chorusWet!: GainNode;
  private chorusLFOs: OscillatorNode[] = [];
  private chorusLFOGains: GainNode[] = [];
  private delayIn!: GainNode;
  private delayOut!: GainNode;
  private delayDry!: GainNode;
  private delayWet!: GainNode;
  private delayNode!: DelayNode;
  private delayFB!: GainNode;
  private reverbIn!: GainNode;
  private reverbOut!: GainNode;
  private reverbDry!: GainNode;
  private reverbWet!: GainNode;
  private reverbNode!: ConvolverNode;
  private reverbPre!: DelayNode;
  private reverbIRKey: string | null = null;

  // ── Master ─────────────────────────────────────────────────────────────
  private limiter!: DynamicsCompressorNode;
  private masterGain!: GainNode;
  private analyser!: AnalyserNode;

  // ── Lifecycle (serialized; proven pattern from TX27) ───────────────────
  private lifecycle: Promise<void> = Promise.resolve();
  private pendingLifecycleOps = 0;
  private shutdownWaitTimer: number | null = null;
  private cleanupTimer: number | null = null;
  private isDestroyed = false;
  onStateChange: ((state: string) => void) | null = null;

  constructor(patch: Tx80Patch, initialBendRangeSemitones = 2) {
    this.patch = patch;
    this.bendRangeSemitones = clampBendRange(initialBendRangeSemitones);
  }

  /** Serialize an async lifecycle step; when idle the step begins
   *  synchronously in the caller's stack so a gesture-triggered start()
   *  reaches AudioContext creation/resume() inside the original gesture. */
  private runExclusive(fn: () => Promise<void>): Promise<void> {
    const exec = async () => {
      try {
        await fn();
      } finally {
        this.pendingLifecycleOps--;
      }
    };
    this.pendingLifecycleOps++;
    const next = this.pendingLifecycleOps === 1 ? exec() : this.lifecycle.then(exec);
    this.lifecycle = next.catch(() => undefined);
    return next;
  }

  private awaitableWait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.shutdownWaitTimer = window.setTimeout(() => {
        this.shutdownWaitTimer = null;
        resolve();
      }, ms);
    });
  }

  start(): Promise<void> {
    return this.runExclusive(async () => {
      if (this.isDestroyed) throw new Error("engine destroyed");
      if (!this.ctx) {
        const Ctor: typeof AudioContext =
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
          window.AudioContext;
        this.ctx = new Ctor({ latencyHint: "interactive" });
        this.ctx.onstatechange = () => {
          this.onStateChange?.(this.ctx ? this.ctx.state : "closed");
        };
        this.buildGraph();
        this.applyAll();
        this.startCleanup();
        if (needsResume(this.ctx.state)) {
          await withTimeout(this.ctx.resume(), 4000, "AudioContext.resume()");
        }
        return;
      }
      if ((this.ctx.state as string) === "closed") {
        throw new Error("AudioContext is closed — engine must be rebuilt");
      }
      if (needsResume(this.ctx.state)) {
        await withTimeout(this.ctx.resume(), 4000, "AudioContext.resume()");
        const t = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(t);
        this.masterGain.gain.setValueAtTime(0, t);
        this.masterGain.gain.setTargetAtTime(this.patch.master.volume, t, 0.02);
      }
    });
  }

  stop(): Promise<void> {
    return this.runExclusive(async () => {
      if (!this.ctx || this.ctx.state !== "running") return;
      this.stopAllVoicesNow();
      const t = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
      this.masterGain.gain.linearRampToValueAtTime(0, t + 0.03);
      await this.awaitableWait(45);
      try {
        await withTimeout(this.ctx.suspend(), 3000, "AudioContext.suspend()");
      } catch {
        /* context stays running/interrupted — voices are already silenced */
      }
    });
  }

  private stopAllVoicesNow(): void {
    for (const a of this.voices) {
      a.voice.stop();
      a.voice.dispose();
    }
    this.voices = [];
    this.heldNotes.clear();
    this.heldOrder.length = 0;
    this.sustained.clear();
    this.sustainDown = false;
    this.monoVoice = null;
    this.lastPitch = null;
    this.lastBendNorm = 0;
    this.ribbonCents = 0;
    if (this.ctx && this.shared) {
      const t = this.ctx.currentTime;
      this.shared.pitchBendSource.offset.setTargetAtTime(0, t, 0.01);
      this.shared.ribbonSource.offset.setTargetAtTime(0, t, 0.01);
    }
  }

  isRunning(): boolean {
    return !!this.ctx && this.ctx.state === "running";
  }

  isUsable(): boolean {
    return (
      !this.isDestroyed &&
      !!this.ctx &&
      (this.ctx.state as string) !== "closed" &&
      !!this.masterGain &&
      !!this.shared
    );
  }

  contextState(): string {
    return this.ctx ? this.ctx.state : "none";
  }

  // ── Graph ──────────────────────────────────────────────────────────────

  private buildGraph(): void {
    const ctx = this.ctx;

    // Noise buffer (2 s of white noise, shared by every voice).
    const noiseLen = Math.floor(ctx.sampleRate * 2);
    const noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const nd = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) nd[i] = Math.random() * 2 - 1;

    // Shared modulation sources.
    const pitchBendSource = ctx.createConstantSource();
    pitchBendSource.offset.value = 0;
    pitchBendSource.start();
    const ribbonSource = ctx.createConstantSource();
    ribbonSource.offset.value = 0;
    ribbonSource.start();
    const pitchModBus = ctx.createGain();
    pitchModBus.gain.value = 1;
    const cutoffModBus = ctx.createGain();
    cutoffModBus.gain.value = 1;
    const pwModBus = ctx.createGain();
    pwModBus.gain.value = 1;
    const pwConst: [ConstantSourceNode, ConstantSourceNode] = [
      ctx.createConstantSource(),
      ctx.createConstantSource(),
    ];
    for (const i of [0, 1] as const) {
      pwConst[i].offset.value = 1 - 2 * this.patch.layers[i].pulseWidth;
      pwConst[i].start();
    }
    this.shared = {
      pitchBendSource,
      ribbonSource,
      pitchModBus,
      cutoffModBus,
      pwModBus,
      pwConst,
      noiseBuffer,
    };

    // Mod-wheel vibrato: continuous 5.4 Hz sine into the pitch bus; only the
    // depth gain changes with the wheel (0..30 cents).
    this.modWheelLFO = ctx.createOscillator();
    this.modWheelLFO.type = "sine";
    this.modWheelLFO.frequency.value = 5.4;
    this.modWheelLFO.start();
    this.modWheelDepth = ctx.createGain();
    this.modWheelDepth.gain.value = 0;
    this.modWheelLFO.connect(this.modWheelDepth);
    this.modWheelDepth.connect(pitchModBus);

    // Layer buses: voices → [voiceBus] → level → balance → pan → mix.
    this.mixBus = ctx.createGain();
    this.mixBus.gain.value = 1;
    for (const i of [0, 1] as const) {
      const voiceBus = ctx.createGain();
      voiceBus.gain.value = 1;
      const level = ctx.createGain();
      const layer = this.patch.layers[i];
      level.gain.value = layer.enabled ? layer.level : 0;
      const balance = ctx.createGain();
      balance.gain.value = 1;
      const pan = ctx.createStereoPanner();
      pan.pan.value = layer.pan;
      voiceBus.connect(level);
      level.connect(balance);
      balance.connect(pan);
      pan.connect(this.mixBus);
      this.layerVoiceBus.push(voiceBus);
      this.layerLevel.push(level);
      this.layerBalance.push(balance);
      this.layerPan.push(pan);
    }

    // Amplitude-modulation stage (LFO destination "amp").
    this.tremolo = ctx.createGain();
    this.tremolo.gain.value = 1;
    this.mixBus.connect(this.tremolo);

    // Product LFOs A/B — always running; destination wiring in applyLfo().
    for (const i of [0, 1]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 1;
      osc.start();
      const depth = ctx.createGain();
      depth.gain.value = 0;
      osc.connect(depth);
      this.lfoOsc[i] = osc;
      this.lfoDepth[i] = depth;
    }
    this.balanceInvert = ctx.createGain();
    this.balanceInvert.gain.value = -1;

    // Chorus (stereo, 2 taps).
    this.chorusIn = ctx.createGain();
    this.chorusOut = ctx.createGain();
    this.chorusDry = ctx.createGain();
    this.chorusWet = ctx.createGain();
    const merger = ctx.createChannelMerger(2);
    for (let i = 0; i < 2; i++) {
      const d = ctx.createDelay(0.05);
      d.delayTime.value = 0.015;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.6 + i * 0.1;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.003;
      lfo.connect(lfoGain);
      lfoGain.connect(d.delayTime);
      this.chorusIn.connect(d);
      d.connect(merger, 0, i);
      lfo.start();
      this.chorusLFOs.push(lfo);
      this.chorusLFOGains.push(lfoGain);
    }
    merger.connect(this.chorusWet);
    this.chorusIn.connect(this.chorusDry);
    this.chorusDry.connect(this.chorusOut);
    this.chorusWet.connect(this.chorusOut);

    // Delay with damped, bounded feedback.
    this.delayIn = ctx.createGain();
    this.delayOut = ctx.createGain();
    this.delayDry = ctx.createGain();
    this.delayWet = ctx.createGain();
    this.delayNode = ctx.createDelay(2);
    this.delayNode.delayTime.value = 0.32;
    this.delayFB = ctx.createGain();
    this.delayFB.gain.value = 0.35;
    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = "lowpass";
    fbFilter.frequency.value = 4000;
    this.delayIn.connect(this.delayDry);
    this.delayDry.connect(this.delayOut);
    this.delayIn.connect(this.delayNode);
    this.delayNode.connect(fbFilter);
    fbFilter.connect(this.delayFB);
    this.delayFB.connect(this.delayNode);
    this.delayNode.connect(this.delayWet);
    this.delayWet.connect(this.delayOut);

    // Reverb — the impulse response is generated lazily in setReverb() and
    // cached by parameter signature (never rebuilt per control tick).
    this.reverbIn = ctx.createGain();
    this.reverbOut = ctx.createGain();
    this.reverbDry = ctx.createGain();
    this.reverbWet = ctx.createGain();
    this.reverbPre = ctx.createDelay(0.5);
    this.reverbPre.delayTime.value = 0.02;
    this.reverbNode = ctx.createConvolver();
    this.reverbIn.connect(this.reverbDry);
    this.reverbDry.connect(this.reverbOut);
    this.reverbIn.connect(this.reverbPre);
    this.reverbPre.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbWet);
    this.reverbWet.connect(this.reverbOut);

    // Safety limiter at the final master output.
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.12;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;

    this.tremolo.connect(this.chorusIn);
    this.chorusOut.connect(this.delayIn);
    this.delayOut.connect(this.reverbIn);
    this.reverbOut.connect(this.limiter);
    this.limiter.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }

  private applyAll(): void {
    for (const i of [0, 1] as const) this.applyLayerBus(i);
    this.applyLfo(0, this.patch.lfoA);
    this.applyLfo(1, this.patch.lfoB);
    this.setChorus(this.patch.chorus);
    this.setDelay(this.patch.delay);
    this.setReverb(this.patch.reverb);
    this.setMasterVolume(this.patch.master.volume);
    this.refreshBalanceBases();
  }

  // ── Layer buses + live layer edits ─────────────────────────────────────

  private applyLayerBus(i: 0 | 1): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const layer = this.patch.layers[i];
    this.layerLevel[i].gain.setTargetAtTime(layer.enabled ? layer.level : 0, t, 0.02);
    this.layerPan[i].pan.setTargetAtTime(layer.pan, t, 0.02);
    this.shared?.pwConst[i].offset.setTargetAtTime(1 - 2 * layer.pulseWidth, t, 0.01);
  }

  private applyLayerToVoices(i: 0 | 1, prev: Tx80Layer, next: Tx80Layer): void {
    const filterChanged = !flatEq(prev.filter, next.filter);
    const tuningChanged =
      prev.octave !== next.octave || prev.coarse !== next.coarse || prev.fine !== next.fine;
    const levelsChanged =
      prev.oscLevel !== next.oscLevel ||
      prev.subLevel !== next.subLevel ||
      prev.noiseLevel !== next.noiseLevel;
    for (const a of this.voices) {
      a.voice.forEachSub(i, (sub) => {
        sub.setLayer(next);
        if (filterChanged) sub.updateFilter();
        if (tuningChanged) sub.updateTuning();
        if (levelsChanged) sub.updateLevels();
      });
    }
  }

  // ── LFO routing ────────────────────────────────────────────────────────

  /** Rewire one product LFO. Static bus nodes make destination changes pure
   *  connect/disconnect operations — voices are never touched and no nodes
   *  are created or destroyed during control movement. */
  private applyLfo(i: 0 | 1, params: Tx80Lfo): void {
    if (!this.ctx || !this.shared) return;
    const osc = this.lfoOsc[i];
    const depth = this.lfoDepth[i];
    if (!osc || !depth) return;
    const t = this.ctx.currentTime;
    osc.type = params.wave === "saw" ? "sawtooth" : params.wave;
    osc.frequency.setTargetAtTime(params.rate, t, 0.05);
    // Disconnect from every possible former destination (idempotent).
    try {
      depth.disconnect();
    } catch {
      /* not connected */
    }
    const dest: LfoDestination = params.destination;
    if (dest === "off" || params.depth <= 0) {
      depth.gain.setTargetAtTime(0, t, 0.03);
      this.refreshAmpBase();
      this.refreshBalanceBases();
      return;
    }
    switch (dest) {
      case "pitch":
        depth.gain.setTargetAtTime(params.depth * LFO_SCALE.pitch, t, 0.03);
        depth.connect(this.shared.pitchModBus);
        break;
      case "filter":
        depth.gain.setTargetAtTime(params.depth * LFO_SCALE.filter, t, 0.03);
        depth.connect(this.shared.cutoffModBus);
        break;
      case "pw":
        depth.gain.setTargetAtTime(params.depth * LFO_SCALE.pw, t, 0.03);
        depth.connect(this.shared.pwModBus);
        break;
      case "amp":
        depth.gain.setTargetAtTime(params.depth * LFO_SCALE.amp, t, 0.03);
        depth.connect(this.tremolo.gain);
        break;
      case "pan":
        depth.gain.setTargetAtTime(params.depth * LFO_SCALE.pan, t, 0.03);
        depth.connect(this.layerPan[0].pan);
        depth.connect(this.layerPan[1].pan);
        break;
      case "balance":
        depth.gain.setTargetAtTime(params.depth * LFO_SCALE.balance, t, 0.03);
        depth.connect(this.layerBalance[0].gain);
        if (this.balanceInvert) {
          depth.connect(this.balanceInvert);
          this.balanceInvert.connect(this.layerBalance[1].gain);
        }
        break;
    }
    this.refreshAmpBase();
    this.refreshBalanceBases();
  }

  /** Compensate the tremolo base so amp modulation swings [1−depth, 1]
   *  instead of exceeding unity. */
  private refreshAmpBase(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    let ampDepth = 0;
    for (const [i, lfo] of ([this.patch.lfoA, this.patch.lfoB] as const).entries()) {
      void i;
      if (lfo.destination === "amp") ampDepth += lfo.depth * LFO_SCALE.amp;
    }
    this.tremolo.gain.setTargetAtTime(Math.max(0.05, 1 - Math.min(0.9, ampDepth)), t, 0.03);
  }

  /** Static Layer I/II balance crossfade plus a floor that keeps balance
   *  modulation from driving a bus gain negative (phase flip). */
  private refreshBalanceBases(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const b = this.patch.master.balance;
    let balDepth = 0;
    for (const lfo of [this.patch.lfoA, this.patch.lfoB]) {
      if (lfo.destination === "balance") balDepth += lfo.depth * LFO_SCALE.balance;
    }
    const floor = Math.min(0.9, balDepth);
    const g1 = Math.max(Math.min(1, 1 - b), floor);
    const g2 = Math.max(Math.min(1, 1 + b), floor);
    this.layerBalance[0].gain.setTargetAtTime(g1, t, 0.03);
    this.layerBalance[1].gain.setTargetAtTime(g2, t, 0.03);
  }

  // ── Patch application ──────────────────────────────────────────────────

  setPatch(patch: Tx80Patch): void {
    const prev = this.patch;
    this.patch = patch;
    if (!this.isUsable()) return;
    if (prev === patch) return;
    for (const i of [0, 1] as const) {
      const was = prev.layers[i];
      const is = patch.layers[i];
      if (
        flatEq(
          { ...was, filter: 0, filterEnv: 0, ampEnv: 0 },
          { ...is, filter: 0, filterEnv: 0, ampEnv: 0 },
        ) &&
        flatEq(was.filter, is.filter) &&
        flatEq(was.filterEnv, is.filterEnv) &&
        flatEq(was.ampEnv, is.ampEnv)
      ) {
        continue;
      }
      this.applyLayerBus(i);
      this.applyLayerToVoices(i, was, is);
    }
    if (!flatEq(prev.lfoA, patch.lfoA)) this.applyLfo(0, patch.lfoA);
    if (!flatEq(prev.lfoB, patch.lfoB)) this.applyLfo(1, patch.lfoB);
    if (!flatEq(prev.chorus, patch.chorus)) this.setChorus(patch.chorus);
    if (!flatEq(prev.delay, patch.delay)) this.setDelay(patch.delay);
    if (!flatEq(prev.reverb, patch.reverb)) this.setReverb(patch.reverb);
    if (prev.master.volume !== patch.master.volume) this.setMasterVolume(patch.master.volume);
    if (prev.master.balance !== patch.master.balance) this.refreshBalanceBases();
    if (prev.voiceMode !== patch.voiceMode) this.releaseAllVoices();
    if (prev.ribbon.mode !== patch.ribbon.mode || prev.ribbon.range !== patch.ribbon.range) {
      this.recentreRibbon();
    }
  }

  /** Full preset load: apply everything and clear stale performance offsets
   *  (ribbon). Pitch-bend position is a live physical control and is kept. */
  loadPatch(patch: Tx80Patch): void {
    this.setPatch(patch);
    this.recentreRibbon();
  }

  private setChorus(c: ChorusParams): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.chorusWet.gain.setTargetAtTime(c.enabled ? c.amount : 0, t, 0.03);
    this.chorusDry.gain.setTargetAtTime(1, t, 0.03);
    for (const lfo of this.chorusLFOs) lfo.frequency.setTargetAtTime(c.rate, t, 0.05);
    for (const g of this.chorusLFOGains) g.gain.setTargetAtTime(c.depth, t, 0.05);
  }

  private setDelay(d: DelayParams): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.delayNode.delayTime.setTargetAtTime(Math.max(0.01, d.time), t, 0.02);
    this.delayFB.gain.setTargetAtTime(Math.min(0.85, Math.max(0, d.feedback)), t, 0.02);
    this.delayWet.gain.setTargetAtTime(d.enabled ? d.mix : 0, t, 0.03);
    this.delayDry.gain.setTargetAtTime(1, t, 0.03);
  }

  private setReverb(r: ReverbParams): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.reverbWet.gain.setTargetAtTime(r.enabled ? r.mix : 0, t, 0.05);
    this.reverbDry.gain.setTargetAtTime(1, t, 0.05);
    this.reverbPre.delayTime.setTargetAtTime(Math.max(0, r.preDelay), t, 0.02);
    // Lazy IR: skip generation entirely while the reverb is disabled, and
    // only rebuild when a parameter baked into the buffer changes.
    if (!r.enabled && !this.reverbIRKey) return;
    const irKey = `${r.type}|${r.size}|${r.decay}|${r.damping}|${r.width}`;
    if (irKey === this.reverbIRKey) return;
    try {
      this.reverbNode.buffer = buildIR(this.ctx, r);
      this.reverbIRKey = irKey;
    } catch {
      /* noop */
    }
  }

  private setMasterVolume(v: number): void {
    if (!this.ctx) return;
    this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  // ── Performance controls ───────────────────────────────────────────────

  setPitchBend(norm: number): void {
    this.lastBendNorm = Math.max(-1, Math.min(1, norm));
    if (!this.ctx || !this.shared) return;
    const cents = this.lastBendNorm * this.bendRangeSemitones * 100;
    this.shared.pitchBendSource.offset.setTargetAtTime(cents, this.ctx.currentTime, 0.003);
  }

  setPitchBendRange(semitones: number): void {
    const clamped = clampBendRange(semitones);
    if (clamped === this.bendRangeSemitones) return;
    this.bendRangeSemitones = clamped;
    if (!this.ctx || !this.shared) return;
    const cents = this.lastBendNorm * clamped * 100;
    this.shared.pitchBendSource.offset.setTargetAtTime(cents, this.ctx.currentTime, 0.01);
  }

  setModWheel(v: number): void {
    if (!this.ctx || !this.modWheelDepth) return;
    const depthCents = Math.max(0, Math.min(1, v)) * 30;
    this.modWheelDepth.gain.setTargetAtTime(depthCents, this.ctx.currentTime, 0.05);
  }

  /** Ribbon position, normalized −1..1 relative to the player's first touch.
   *  PITCH/HOLD: continuous cents. GLISS: quantized to whole semitones with a
   *  fast step so movement is audibly discrete. */
  setRibbonPosition(norm: number): void {
    if (!this.ctx || !this.shared) return;
    const clamped = Math.max(-1, Math.min(1, norm));
    const range = this.patch.ribbon.range;
    const t = this.ctx.currentTime;
    if (this.patch.ribbon.mode === "gliss") {
      const cents = Math.round(clamped * range) * 100;
      if (cents !== this.ribbonCents) {
        this.shared.ribbonSource.offset.setTargetAtTime(cents, t, 0.004);
        this.ribbonCents = cents;
      }
      return;
    }
    this.ribbonCents = clamped * range * 100;
    this.shared.ribbonSource.offset.setTargetAtTime(this.ribbonCents, t, 0.006);
  }

  /** Ribbon release: PITCH and GLISS spring back to center with an exact
   *  arrival at 0; HOLD keeps the last value. */
  releaseRibbon(): void {
    if (!this.ctx || !this.shared) return;
    if (this.patch.ribbon.mode === "hold") return;
    this.recentreRibbon();
  }

  private recentreRibbon(): void {
    this.ribbonCents = 0;
    if (!this.ctx || !this.shared) return;
    const t = this.ctx.currentTime;
    const p = this.shared.ribbonSource.offset;
    try {
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(0, t + 0.06);
    } catch {
      /* param automation against a dying context */
    }
  }

  // ── Notes ──────────────────────────────────────────────────────────────

  private travelFor(fromNote: number | null, targetNote: number): PitchTravel | null {
    const { mode, time } = this.patch.pitchTravel;
    if (mode === "off" || time <= 0) return null;
    if (fromNote === null || fromNote === targetNote) return null;
    return { fromNote, mode, timePerOctave: time };
  }

  noteOn(note: number, velocity = 1): void {
    if (!this.isUsable()) return;
    velocity = Math.max(0, Math.min(1, velocity));
    this.heldNotes.set(note, (this.heldNotes.get(note) ?? 0) + 1);
    const oi = this.heldOrder.indexOf(note);
    if (oi >= 0) this.heldOrder.splice(oi, 1);
    this.heldOrder.push(note);

    if (this.patch.voiceMode === "solo") {
      if (this.monoVoice && this.monoVoice.active) {
        // Legato: retune the sounding voice — no envelope retrigger. Travel
        // (portamento or glissando) applies between the two pitches.
        const travel = this.travelFor(this.monoVoice.note, note);
        this.monoVoice.retune(note, travel);
        for (const a of this.voices) if (a.voice === this.monoVoice) a.note = note;
        this.lastPitch = note;
        return;
      }
      const v = new Tx80Voice(
        this.ctx,
        [this.layerVoiceBus[0], this.layerVoiceBus[1]],
        this.patch,
        note,
        velocity,
        this.shared!,
        this.travelFor(this.lastPitch, note),
      );
      this.monoVoice = v;
      this.voices.push({ voice: v, note, startedAt: this.ctx.currentTime });
      this.lastPitch = note;
      return;
    }

    // Poly: coordinated voice stealing (oldest sounding voice, quick fade —
    // both layers of the stolen voice go together).
    const active = this.voices.filter((a) => a.voice.active);
    if (active.length >= this.patch.polyphony) {
      active.sort((a, b) => a.startedAt - b.startedAt);
      active[0].voice.stop(0.04);
    }
    const v = new Tx80Voice(
      this.ctx,
      [this.layerVoiceBus[0], this.layerVoiceBus[1]],
      this.patch,
      note,
      velocity,
      this.shared!,
      this.travelFor(this.lastPitch, note),
    );
    this.voices.push({ voice: v, note, startedAt: this.ctx.currentTime });
    this.lastPitch = note;
  }

  /** Release ONE instance of a note (LIFO), so stacked presses of the same
   *  key from multiple pointers release one-for-one. */
  private releaseOneVoice(note: number): void {
    for (let i = this.voices.length - 1; i >= 0; i--) {
      const a = this.voices[i];
      if (a.voice.active && (a.note === note || a.voice.note === note)) {
        a.voice.release();
        if (a.voice === this.monoVoice) this.monoVoice = null;
        return;
      }
    }
  }

  noteOff(note: number): void {
    const count = this.heldNotes.get(note) ?? 0;
    if (count > 1) this.heldNotes.set(note, count - 1);
    else {
      this.heldNotes.delete(note);
      const oi = this.heldOrder.indexOf(note);
      if (oi >= 0) this.heldOrder.splice(oi, 1);
    }
    if (this.sustainDown) {
      this.sustained.set(note, (this.sustained.get(note) ?? 0) + 1);
      return;
    }
    if (this.patch.voiceMode === "solo") {
      const mv = this.monoVoice;
      if (mv && mv.active) {
        if (this.heldOrder.length > 0) {
          // Return-travel to the most recently pressed still-held note.
          const target = this.heldOrder[this.heldOrder.length - 1];
          if (target !== mv.note) {
            mv.retune(target, this.travelFor(mv.note, target));
            for (const a of this.voices) if (a.voice === mv) a.note = target;
            this.lastPitch = target;
          }
          return;
        }
        this.monoVoice = null;
        mv.release();
      }
      // Release any stray poly voices left over from a mode switch.
      for (const a of this.voices) {
        if (a.voice.active && a.voice !== mv && (a.note === note || a.voice.note === note)) {
          a.voice.release();
        }
      }
      return;
    }
    this.releaseOneVoice(note);
  }

  /** Release the OLDEST active instance of a note — used on pedal-up, where
   *  the sustained instances are by definition older than any still-held
   *  press of the same key. */
  private releaseOldestVoice(note: number): void {
    for (const a of this.voices) {
      if (a.voice.active && (a.note === note || a.voice.note === note)) {
        a.voice.release();
        if (a.voice === this.monoVoice) this.monoVoice = null;
        return;
      }
    }
  }

  setSustain(down: boolean): void {
    this.sustainDown = down;
    if (down) return;
    for (const [note, count] of this.sustained) {
      // Keep one sounding instance per press still physically held; release
      // the rest (the deferred noteOffs), oldest first.
      const keep = this.heldNotes.get(note) ?? 0;
      for (let k = 0; k < count; k++) {
        const activeForNote = this.voices.filter(
          (a) => a.voice.active && (a.note === note || a.voice.note === note),
        ).length;
        if (activeForNote <= keep) break;
        this.releaseOldestVoice(note);
      }
    }
    this.sustained.clear();
  }

  private releaseAllVoices(): void {
    for (const a of this.voices) if (a.voice.active) a.voice.release();
    this.monoVoice = null;
  }

  panic(): void {
    for (const a of this.voices) a.voice.stop(0.02);
    this.heldNotes.clear();
    this.heldOrder.length = 0;
    this.sustained.clear();
    this.sustainDown = false;
    this.monoVoice = null;
    this.lastPitch = null;
    this.lastBendNorm = 0;
    this.ribbonCents = 0;
    if (this.isUsable() && this.shared) {
      const t = this.ctx.currentTime;
      this.shared.pitchBendSource.offset.setTargetAtTime(0, t, 0.01);
      this.recentreRibbon();
    }
    // MOD wheel depth is intentionally NOT reset — it is a latching control.
  }

  activeVoiceCount(): number {
    return this.voices.filter((v) => v.voice.active).length;
  }

  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  private startCleanup(): void {
    if (this.cleanupTimer !== null) return;
    const tick = () => {
      const now = this.ctx.currentTime;
      for (let i = this.voices.length - 1; i >= 0; i--) {
        if (this.voices[i].voice.isDone(now)) {
          this.voices[i].voice.dispose();
          this.voices.splice(i, 1);
        }
      }
    };
    this.cleanupTimer = window.setInterval(tick, 200);
  }

  destroy(): void {
    this.isDestroyed = true;
    this.onStateChange = null;
    if (this.ctx) this.ctx.onstatechange = null;
    if (this.cleanupTimer !== null) window.clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
    if (this.shutdownWaitTimer !== null) window.clearTimeout(this.shutdownWaitTimer);
    this.shutdownWaitTimer = null;
    this.panic();
    for (const a of this.voices) a.voice.dispose();
    this.voices = [];
    const stopSafe = (n: OscillatorNode | ConstantSourceNode | null) => {
      if (!n) return;
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
      try {
        n.disconnect();
      } catch {
        /* already disconnected */
      }
    };
    stopSafe(this.modWheelLFO);
    this.modWheelLFO = null;
    this.modWheelDepth?.disconnect();
    this.modWheelDepth = null;
    for (const i of [0, 1]) {
      stopSafe(this.lfoOsc[i]);
      this.lfoOsc[i] = null;
      try {
        this.lfoDepth[i]?.disconnect();
      } catch {
        /* noop */
      }
      this.lfoDepth[i] = null;
    }
    for (const lfo of this.chorusLFOs) stopSafe(lfo);
    this.chorusLFOs = [];
    if (this.shared) {
      stopSafe(this.shared.pitchBendSource);
      stopSafe(this.shared.ribbonSource);
      stopSafe(this.shared.pwConst[0]);
      stopSafe(this.shared.pwConst[1]);
      try {
        this.shared.pitchModBus.disconnect();
      } catch {
        /* noop */
      }
      try {
        this.shared.cutoffModBus.disconnect();
      } catch {
        /* noop */
      }
      try {
        this.shared.pwModBus.disconnect();
      } catch {
        /* noop */
      }
      this.shared = null;
    }
    if (this.ctx && (this.ctx.state as string) !== "closed") {
      this.ctx.close().catch(() => undefined);
    }
  }

  exportPatchClone(): Tx80Patch {
    return cloneTx80Patch(this.patch);
  }
}
