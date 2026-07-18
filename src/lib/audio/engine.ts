import { FMVoice } from "./voice";
import { VintageCircuit } from "./vintage";
import { buildIR } from "./reverb";
import { clampBendRange } from "./types";
import type {
  ChorusParams,
  DelayParams,
  FilterParams,
  Patch,
  ReverbParams,
  VintageParams,
} from "./types";

interface ActiveVoice {
  voice: FMVoice;
  note: number;
  startedAt: number;
}

/** Shallow equality over the flat parameter objects inside Patch (filter,
 *  chorus, delay, reverb, vintage). Values are primitives only. */
function flatEq<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  for (const k in a) if (a[k] !== b[k]) return false;
  for (const k in b) if (!(k in a)) return false;
  return true;
}

/** Bound an AudioContext state-transition promise. On iOS, resume() (and
 *  occasionally suspend()) can return promises that NEVER settle — e.g. on a
 *  cold PWA launch before the system audio session is ready, or after an
 *  interruption. An unbounded await here wedges the whole init path for the
 *  rest of the session, which is exactly the observed "controls do nothing
 *  until relaunch" failure. Rejects with a named TimeoutError instead. */
function withTimeout(p: Promise<unknown>, ms: number, label: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.name = "TimeoutError";
      reject(err);
    }, ms);
    p.then(
      () => { window.clearTimeout(t); resolve(); },
      (e) => { window.clearTimeout(t); reject(e instanceof Error ? e : new Error(String(e))); },
    );
  });
}

/** iOS reports a non-standard "interrupted" state (phone call, Siri, screen
 *  lock, audio-session loss). Treat every non-running, non-closed state as
 *  resumable — resuming a running context is the only thing we must avoid. */
function needsResume(state: AudioContextState): boolean {
  return state !== "running" && (state as string) !== "closed";
}

export class TX27Engine {
  ctx!: AudioContext;
  private voices: ActiveVoice[] = [];
  private heldNotes = new Set<number>();
  // Ordered press history of currently-held notes (last = most recent).
  // Drives mono last-note priority and return-glide on release.
  private heldOrder: number[] = [];
  // Last pitch that a voice started at or glided to — the "from" pitch for
  // poly portamento. Persists across gaps (classic porta-always behavior).
  private lastGlidePitch: number | null = null;
  private sustainDown = false;
  private sustained = new Set<number>();
  private patch: Patch;

  // Bus chain
  private voiceBus!: GainNode;
  private vintage!: VintageCircuit;
  private filter!: BiquadFilterNode;

  // Chorus
  private chorusIn!: GainNode;
  private chorusOut!: GainNode;
  private chorusDry!: GainNode;
  private chorusWet!: GainNode;
  private chorusDelays: DelayNode[] = [];
  private chorusLFOs: OscillatorNode[] = [];
  private chorusLFOGains: GainNode[] = [];

  // Delay
  private delayIn!: GainNode;
  private delayOut!: GainNode;
  private delayDry!: GainNode;
  private delayWet!: GainNode;
  private delayNode!: DelayNode;
  private delayFB!: GainNode;

  // Reverb
  private reverbIn!: GainNode;
  private reverbOut!: GainNode;
  private reverbDry!: GainNode;
  private reverbWet!: GainNode;
  private reverbNode!: ConvolverNode;
  private reverbPre!: DelayNode;
  // Signature of the currently loaded impulse response — IR-affecting params
  // plus quantized vintage darkness. setReverb skips the expensive buildIR
  // when this hasn't changed (mix/preDelay moves are AudioParam-only).
  private reverbIRKey: string | null = null;

  // Master
  private limiter!: DynamicsCompressorNode;
  private masterGain!: GainNode;
  private analyser!: AnalyserNode;

  // Mono glide tracking
  private monoVoice: FMVoice | null = null;

  // ── Pitch bend ─────────────────────────────────────────────────────────────
  // A ConstantSourceNode whose offset (in cents) is connected to the detune
  // AudioParam of every active voice oscillator. Shared — new voices inherit
  // the current bend automatically when the engine passes this node at
  // FMVoice construction time.
  private pitchBendSource: ConstantSourceNode | null = null;
  // Last normalized bend position (-1..1) — remembered so a range change can
  // smoothly retarget the current bend instead of snapping or resetting.
  private lastBendNorm = 0;
  // Bend range in semitones (integer 1..12). A GLOBAL performance setting
  // supplied by the UI (src/lib/settings.ts) — patches do not touch it.
  private bendRangeSemitones = 2;

  // ── Vibrato (MOD wheel) ────────────────────────────────────────────────────
  // vibratoLFO → vibratoDepth → each osc.detune (cents, additive with bend).
  // Depth gain maps 0..1 → 0..30 cents.
  private vibratoLFO: OscillatorNode | null = null;
  private vibratoDepth: GainNode | null = null;

  private cleanupTimer: number | null = null;

  // ── Power lifecycle ────────────────────────────────────────────────────────
  // start()/stop() are serialized through this promise chain so rapid
  // POWER toggles execute strictly in order — no ON/OFF race, no duplicated
  // AudioContext, no duplicated graph. The graph is built exactly once per
  // engine instance; OFF suspends the single context, ON resumes it.
  private lifecycle: Promise<void> = Promise.resolve();
  // Number of lifecycle ops scheduled but not yet finished. When 0, a new op
  // starts SYNCHRONOUSLY inside the caller's stack — critical on mobile:
  // AudioContext creation/resume() must begin inside the user gesture that
  // triggered it, not on a later microtask/timer that Safari may reject.
  private pendingLifecycleOps = 0;
  // Tracked handle for the awaitable shutdown-ramp wait. Cleared in destroy()
  // so no stale timer can fire after teardown.
  private shutdownWaitTimer: number | null = null;
  // True once destroy() ran — the engine must never be reused after this.
  private isDestroyed = false;
  /** Optional observer for AudioContext state transitions (running/suspended/
   *  interrupted/closed). The UI uses it so POWER can never claim ON while
   *  the context is actually suspended (backgrounding, screen lock, calls). */
  onStateChange: ((state: string) => void) | null = null;

  constructor(patch: Patch, initialBendRangeSemitones: number = 2) {
    this.patch = patch;
    this.bendRangeSemitones = clampBendRange(initialBendRangeSemitones);
  }

  /** Serialize an async lifecycle step. Errors are contained so one failed
   *  step never wedges the chain. When the chain is idle the step begins
   *  synchronously in the caller's stack (async fn bodies run synchronously
   *  until their first await), so a gesture-triggered start() reaches
   *  AudioContext creation/resume() inside the original user gesture. */
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
    // Keep the chain alive even if fn rejects.
    this.lifecycle = next.catch(() => undefined);
    return next;
  }

  /** Awaitable, tracked wait used only for the power-off ramp. */
  private awaitableWait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.shutdownWaitTimer = window.setTimeout(() => {
        this.shutdownWaitTimer = null;
        resolve();
      }, ms);
    });
  }

  /** POWER ON. Must be called from a user gesture the first time (autoplay
   *  policy) — runExclusive guarantees the resume()/creation call begins
   *  synchronously inside that gesture when the chain is idle.
   *
   *  Resilience rules (each was a confirmed field failure before):
   *  · resume() is attempted for EVERY non-running, non-closed state —
   *    including iOS's non-standard "interrupted" — not just "suspended".
   *  · Every context-state await is bounded; a hanging resume() rejects with
   *    TimeoutError instead of wedging init for the rest of the session.
   *  · The graph is built BEFORE the first resume await, so a timed-out
   *    resume leaves a complete, resumable engine — never a half-built one.
   *  · A closed context cannot be restarted: throw so the owner disposes
   *    this engine and builds a fresh one (see isUsable()). */
  start(): Promise<void> {
    return this.runExclusive(async () => {
      if (this.isDestroyed) throw new Error("engine destroyed");
      if (!this.ctx) {
        const Ctor: typeof AudioContext =
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext ?? window.AudioContext;
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
        // Always ramp up from silence (a volume change while OFF could have
        // left the gain non-zero, which would replay frozen effect tails).
        const t = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(t);
        this.masterGain.gain.setValueAtTime(0, t);
        this.masterGain.gain.setTargetAtTime(this.patch.masterVolume, t, 0.02);
      }
    });
  }

  /** POWER OFF. Silences and disposes every voice immediately, ramps the
   *  master bus to zero (short serialized, awaitable ramp — no untracked
   *  setTimeout), then suspends the single AudioContext. The graph is kept
   *  so POWER ON is a cheap resume. Idempotent and race-free. */
  stop(): Promise<void> {
    return this.runExclusive(async () => {
      if (!this.ctx || this.ctx.state !== "running") return;
      // Hard-stop and dispose all voices now — no stuck voices, no tails
      // waiting on the (frozen) cleanup interval while suspended.
      this.stopAllVoicesNow();
      // Short master ramp to avoid an audible click from effect tails.
      const t = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
      this.masterGain.gain.linearRampToValueAtTime(0, t + 0.03);
      await this.awaitableWait(45);
      try {
        // Bounded + best-effort: a hanging suspend() must never wedge the
        // lifecycle chain (POWER would die for the whole session).
        await withTimeout(this.ctx.suspend(), 3000, "AudioContext.suspend()");
      } catch {
        /* context stays running/interrupted — voices are already silenced */
      }
    });
  }

  /** Immediately stop and dispose every voice and clear note-tracking state.
   *  Also recentres pitch bend (bend RANGE is preserved). */
  private stopAllVoicesNow() {
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
    this.lastGlidePitch = null;
    this.lastBendNorm = 0;
    if (this.ctx && this.pitchBendSource) {
      this.pitchBendSource.offset.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    }
  }

  isRunning() {
    return !!this.ctx && this.ctx.state === "running";
  }

  /** Narrow engine health check. A stored engine reference is NOT proof of an
   *  operational engine: iOS can close the AudioContext outright under memory
   *  pressure. Usable = not destroyed, context exists and is not closed, and
   *  the master output node exists (graph fully built). A merely suspended /
   *  interrupted context IS usable — start() resumes it; a closed one is not,
   *  and the owner must dispose this engine and construct a fresh one. */
  isUsable(): boolean {
    return (
      !this.isDestroyed &&
      !!this.ctx &&
      (this.ctx.state as string) !== "closed" &&
      !!this.masterGain &&
      !!this.pitchBendSource
    );
  }

  /** Current AudioContext state for diagnostics ("none" before first start). */
  contextState(): string {
    return this.ctx ? this.ctx.state : "none";
  }

  private buildGraph() {
    const ctx = this.ctx;
    this.voiceBus = ctx.createGain();
    this.voiceBus.gain.value = 1;

    this.vintage = new VintageCircuit(ctx);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 12000;
    this.filter.Q.value = 0.4;

    // Chorus (stereo, 2 taps)
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
      this.chorusDelays.push(d);
      this.chorusLFOs.push(lfo);
      this.chorusLFOGains.push(lfoGain);
    }
    merger.connect(this.chorusWet);
    this.chorusIn.connect(this.chorusDry);
    this.chorusDry.connect(this.chorusOut);
    this.chorusWet.connect(this.chorusOut);

    // Delay
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

    // Reverb
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

    // Limiter + master
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

    // ── Pitch bend source ────────────────────────────────────────────────────
    // Offset in cents, connected to every voice oscillator's detune param.
    this.pitchBendSource = ctx.createConstantSource();
    this.pitchBendSource.offset.value = 0;
    this.pitchBendSource.start();

    // ── Vibrato LFO ──────────────────────────────────────────────────────────
    // Sine at 5 Hz; depth GainNode gain maps MOD 0..1 → 0..30 cents.
    this.vibratoLFO = ctx.createOscillator();
    this.vibratoLFO.type = "sine";
    this.vibratoLFO.frequency.value = 5;
    this.vibratoLFO.start();
    this.vibratoDepth = ctx.createGain();
    this.vibratoDepth.gain.value = 0;
    this.vibratoLFO.connect(this.vibratoDepth);
    // vibratoDepth → individual osc.detune params (connected per-voice in FMVoice.build)

    // Chain
    this.voiceBus.connect(this.vintage.input);
    this.vintage.output.connect(this.filter);
    this.filter.connect(this.chorusIn);
    this.chorusOut.connect(this.delayIn);
    this.delayOut.connect(this.reverbIn);
    this.reverbOut.connect(this.limiter);
    this.limiter.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }

  setPatch(patch: Patch) {
    const prev = this.patch;
    this.patch = patch;
    if (!this.isUsable()) return;
    if (prev === patch) return;
    // Apply only the sections that actually changed. Live knob drags emit a
    // complete patch per pointer move; re-applying untouched sections every
    // tick (especially the convolver IR rebuild in setReverb) stalls the main
    // thread and audibly glitches held notes during filter sweeps.
    if (!flatEq(prev.filter, patch.filter)) this.setFilter(patch.filter);
    if (!flatEq(prev.chorus, patch.chorus)) this.setChorus(patch.chorus);
    if (!flatEq(prev.delay, patch.delay)) this.setDelay(patch.delay);
    if (!flatEq(prev.reverb, patch.reverb)) this.setReverb(patch.reverb);
    if (!flatEq(prev.vintage, patch.vintage)) this.setVintage(patch.vintage);
    if (prev.masterVolume !== patch.masterVolume) this.setMasterVolume(patch.masterVolume);
  }

  private applyAll() {
    this.setFilter(this.patch.filter);
    this.setChorus(this.patch.chorus);
    this.setDelay(this.patch.delay);
    this.setReverb(this.patch.reverb);
    this.setVintage(this.patch.vintage);
    this.setMasterVolume(this.patch.masterVolume);
    // NOTE: bend range is intentionally NOT applied here. It is a global
    // performance setting (settings.ts) — loading a preset must never
    // change the player's wheel range.
  }

  setFilter(f: FilterParams) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(f.cutoff, t, 0.02);
    this.filter.Q.setTargetAtTime(f.resonance * 12, t, 0.02);
  }

  setChorus(c: ChorusParams) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const wet = c.enabled ? c.amount : 0;
    this.chorusWet.gain.setTargetAtTime(wet, t, 0.03);
    this.chorusDry.gain.setTargetAtTime(1, t, 0.03);
    for (const lfo of this.chorusLFOs) lfo.frequency.setTargetAtTime(c.rate, t, 0.05);
    for (const g of this.chorusLFOGains) g.gain.setTargetAtTime(c.depth, t, 0.05);
  }

  setDelay(d: DelayParams) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.delayNode.delayTime.setTargetAtTime(Math.max(0.01, d.time), t, 0.02);
    this.delayFB.gain.setTargetAtTime(Math.min(0.85, d.feedback), t, 0.02);
    this.delayWet.gain.setTargetAtTime(d.enabled ? d.mix : 0, t, 0.03);
    this.delayDry.gain.setTargetAtTime(1, t, 0.03);
  }

  setReverb(r: ReverbParams) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.reverbWet.gain.setTargetAtTime(r.enabled ? r.mix : 0, t, 0.05);
    this.reverbDry.gain.setTargetAtTime(1, t, 0.05);
    this.reverbPre.delayTime.setTargetAtTime(Math.max(0, r.preDelay), t, 0.02);
    // Rebuild the convolver IR only when a parameter baked into the buffer
    // changes. mix/preDelay/enabled are pure AudioParam moves and never
    // require a rebuild. Vintage darkness is quantized so an AGE/WEAR sweep
    // retargets the tone in coarse steps instead of rebuilding per tick.
    const dark = this.vintage?.getReverbDarkness?.() ?? 0;
    const darkStep = Math.round(dark * 20);
    const irKey = `${r.type}|${r.size}|${r.decay}|${r.damping}|${r.width}|${darkStep}`;
    if (irKey === this.reverbIRKey) return;
    try {
      this.reverbNode.buffer = buildIR(this.ctx, r, darkStep / 20);
      this.reverbIRKey = irKey;
    } catch {
      /* noop */
    }
  }

  setVintage(v: VintageParams) {
    if (!this.ctx) return;
    this.vintage.setEnabled(v.enabled);
    this.vintage.applyParams(v);
    this.setReverb(this.patch.reverb);
  }

  setMasterVolume(v: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(v, t, 0.02);
  }

  // ── Performance controls ─────────────────────────────────────────────────

  /** Apply global pitch bend. norm is -1..1 mapping to ± the current bend
   *  range (patch.pitchBendRangeSemitones × 100 cents).
   *  Uses AudioParam automation for glitch-free modulation.
   *  Affects all current voices via the shared ConstantSourceNode,
   *  and all future voices automatically (they connect at construction). */
  setPitchBend(norm: number) {
    this.lastBendNorm = Math.max(-1, Math.min(1, norm));
    if (!this.ctx || !this.pitchBendSource) return;
    const cents = this.lastBendNorm * this.bendRangeSemitones * 100;
    this.pitchBendSource.offset.setTargetAtTime(cents, this.ctx.currentTime, 0.003);
  }

  /** Set the pitch bend range in semitones (clamped to integers 1..12).
   *  If a bend is currently applied, the active bend is smoothly retargeted
   *  to the same normalized position at the new range — no oscillator
   *  restarts, no envelope retriggers, no graph rebuild. New voices pick up
   *  the range automatically via the shared ConstantSourceNode. */
  setPitchBendRange(semitones: number) {
    const clamped = clampBendRange(semitones);
    if (clamped === this.bendRangeSemitones) return;
    this.bendRangeSemitones = clamped;
    if (!this.ctx || !this.pitchBendSource) return;
    const cents = this.lastBendNorm * clamped * 100;
    this.pitchBendSource.offset.setTargetAtTime(cents, this.ctx.currentTime, 0.01);
  }

  /** Apply modulation wheel depth. v is 0..1; maps to 0..30 cents vibrato depth.
   *  Depth change is smoothed. The 5 Hz LFO runs continuously; only its gain
   *  changes — no graph rebuild, no envelope retrigger. */
  setModWheel(v: number) {
    if (!this.ctx || !this.vibratoDepth) return;
    const depthCents = Math.max(0, Math.min(1, v)) * 30;
    this.vibratoDepth.gain.setTargetAtTime(depthCents, this.ctx.currentTime, 0.05);
  }

  // ─────────────────────────────────────────────────────────────────────────

  private startCleanup() {
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

  // ── Glide / note handling ────────────────────────────────────────────────

  /** Single-voice behavior applies when the patch voice mode is MONO or the
   *  glide mode is MONO LEGATO (one gliding voice regardless of voice mode). */
  private isMonoBehavior(): boolean {
    return this.patch.voiceMode === "mono" || this.patch.glideMode === "mono";
  }

  /** Effective glide time in seconds. The GLIDE knob only acts when a glide
   *  mode is enabled; OFF forces instant pitch. */
  private glideSeconds(): number {
    return this.patch.glideMode === "off" ? 0 : Math.max(0, this.patch.glide);
  }

  private pressNote(note: number) {
    this.heldNotes.add(note);
    const i = this.heldOrder.indexOf(note);
    if (i >= 0) this.heldOrder.splice(i, 1);
    this.heldOrder.push(note);
  }

  private releaseNote(note: number) {
    this.heldNotes.delete(note);
    const i = this.heldOrder.indexOf(note);
    if (i >= 0) this.heldOrder.splice(i, 1);
  }

  /** Retune the mono voice (legato — no envelope retrigger) and keep its
   *  ActiveVoice entry's note in sync so later noteOff/sustain matching never
   *  targets a stale pitch. No-op when already at the target. */
  private retuneMono(target: number, glide: number) {
    const mv = this.monoVoice;
    if (!mv || mv.note === target) return;
    mv.retune(target, glide);
    for (const a of this.voices) {
      if (a.voice === mv) a.note = target;
    }
    this.lastGlidePitch = target;
  }

  /** For POLY glide mode: glide-from descriptor for a brand-new voice.
   *  Undefined when portamento shouldn't apply (mode OFF, first note ever,
   *  same pitch, or MONO LEGATO — whose detached notes start at pitch). */
  private glideStart(note: number): { note: number; time: number } | undefined {
    if (this.patch.glideMode !== "poly") return undefined;
    const time = this.glideSeconds();
    const from = this.lastGlidePitch;
    if (time <= 0 || from === null || from === note) return undefined;
    return { note: from, time };
  }

  noteOn(note: number, velocity: number = 1) {
    // Never build voices into a closed/dead context — Safari throws
    // InvalidStateError from createOscillator() there.
    if (!this.isUsable()) return;
    velocity = Math.max(0, Math.min(1, velocity));
    this.pressNote(note);
    if (this.isMonoBehavior()) {
      if (this.monoVoice && this.monoVoice.active) {
        // Legato: retune the sounding voice — no envelope retrigger.
        this.retuneMono(note, this.glideSeconds());
        return;
      }
      const v = new FMVoice(
        this.ctx,
        this.voiceBus,
        this.patch,
        note,
        velocity,
        this.pitchBendSource ?? undefined,
        this.vibratoDepth ?? undefined,
        this.glideStart(note),
      );
      this.monoVoice = v;
      this.voices.push({ voice: v, note, startedAt: this.ctx.currentTime });
      this.lastGlidePitch = note;
      return;
    }
    // Poly: voice stealing
    const active = this.voices.filter((a) => a.voice.active);
    if (active.length >= this.patch.polyphony) {
      active.sort((a, b) => a.startedAt - b.startedAt);
      active[0].voice.release();
    }
    const v = new FMVoice(
      this.ctx,
      this.voiceBus,
      this.patch,
      note,
      velocity,
      this.pitchBendSource ?? undefined,
      this.vibratoDepth ?? undefined,
      this.glideStart(note),
    );
    this.voices.push({ voice: v, note, startedAt: this.ctx.currentTime });
    this.lastGlidePitch = note;
  }

  noteOff(note: number) {
    this.releaseNote(note);
    if (this.sustainDown) {
      this.sustained.add(note);
      return;
    }
    if (this.isMonoBehavior()) {
      // Release any non-mono voices still sounding this note (leftovers from
      // a voice/glide-mode switch while keys were held) so nothing sticks.
      for (const a of this.voices) {
        if (
          a.voice.active &&
          a.voice !== this.monoVoice &&
          (a.note === note || a.voice.note === note)
        ) {
          a.voice.release();
        }
      }
      const mv = this.monoVoice;
      if (mv && mv.active) {
        if (this.heldOrder.length > 0) {
          // Return-glide to the most recently pressed still-held note.
          this.retuneMono(this.heldOrder[this.heldOrder.length - 1], this.glideSeconds());
          return;
        }
        this.monoVoice = null;
        mv.release();
      }
      return;
    }
    // Poly path. Matches a.voice.note too so a voice that was legato-retuned
    // before a mode switch is still found under its sounding pitch.
    for (const a of this.voices) {
      if (a.voice.active && (a.note === note || a.voice.note === note)) {
        a.voice.release();
        if (a.voice === this.monoVoice) this.monoVoice = null;
      }
    }
  }

  setSustain(down: boolean) {
    this.sustainDown = down;
    if (!down) {
      for (const n of this.sustained) {
        if (!this.heldNotes.has(n)) {
          for (const a of this.voices) {
            if (a.voice.active && (a.note === n || a.voice.note === n)) {
              a.voice.release();
              if (a.voice === this.monoVoice) this.monoVoice = null;
            }
          }
        }
      }
      this.sustained.clear();
    }
  }

  panic() {
    for (const a of this.voices) a.voice.stop();
    this.heldNotes.clear();
    this.heldOrder.length = 0;
    this.sustained.clear();
    this.sustainDown = false;
    this.monoVoice = null;
    this.lastGlidePitch = null;
    // Reset pitch bend position to centre immediately.
    // The selected bend RANGE is intentionally preserved.
    this.lastBendNorm = 0;
    if (this.isUsable() && this.pitchBendSource) {
      this.pitchBendSource.offset.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    }
    // MOD wheel depth is intentionally NOT reset — it is a latching control.
  }

  activeVoiceCount() {
    return this.voices.filter((v) => v.voice.active).length;
  }

  getAnalyser() {
    return this.analyser;
  }

  destroy() {
    this.isDestroyed = true;
    this.onStateChange = null;
    if (this.ctx) this.ctx.onstatechange = null;
    if (this.cleanupTimer !== null) window.clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
    if (this.shutdownWaitTimer !== null) window.clearTimeout(this.shutdownWaitTimer);
    this.shutdownWaitTimer = null;
    this.panic();
    // Stop and disconnect shared modulation sources. Guards prevent double-stop.
    try { this.vibratoLFO?.stop(); } catch { /* already stopped */ }
    this.vibratoLFO?.disconnect();
    this.vibratoLFO = null;
    this.vibratoDepth?.disconnect();
    this.vibratoDepth = null;
    try { this.pitchBendSource?.stop(); } catch { /* already stopped */ }
    this.pitchBendSource?.disconnect();
    this.pitchBendSource = null;
    // The OS may have closed the context already (memory reclaim) — closing a
    // closed context rejects, and an unhandled rejection here would surface
    // as a page error during recovery. Swallow it: disposal is best-effort.
    if (this.ctx && (this.ctx.state as string) !== "closed") {
      this.ctx.close().catch(() => undefined);
    }
  }
}
