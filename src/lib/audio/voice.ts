import { ALGORITHMS } from "./algorithms";
import type { OperatorParams, Patch } from "./types";

// A single 4-operator FM voice.
export class FMVoice {
  ctx: AudioContext;
  output: GainNode;
  note: number = 60;
  velocity: number = 1;
  active: boolean = true;
  releaseTime: number = 0;
  private oscs: OscillatorNode[] = [];
  private envGains: GainNode[] = []; // envelope * level
  private modGains: GainNode[] = []; // modulator send gains (per modulation edge)
  private carrierGains: GainNode[] = []; // per-op carrier output gains
  private feedbackNode?: GainNode;
  private feedbackDelay?: DelayNode;
  private ops: OperatorParams[];
  private patch: Patch;
  private endTime: number = Infinity;

  // Shared modulation sources supplied by TX27Engine.
  // Per-op detune is baked into osc.frequency; osc.detune (in cents) is left
  // free so pitchBendSource and vibratoDepth can connect to it additively.
  private pitchBendSource: ConstantSourceNode | null;
  private vibratoDepth: GainNode | null;
  // Optional portamento start: oscillators begin at the previous note's pitch
  // and glide to the target (poly glide mode). Envelopes are NOT affected.
  private glideFrom: { note: number; time: number } | null;

  constructor(
    ctx: AudioContext,
    dest: AudioNode,
    patch: Patch,
    note: number,
    velocity: number,
    pitchBendSource?: ConstantSourceNode,
    vibratoDepth?: GainNode,
    glideFrom?: { note: number; time: number },
  ) {
    this.ctx = ctx;
    this.patch = patch;
    this.ops = patch.operators;
    this.note = note;
    this.velocity = velocity;
    this.pitchBendSource = pitchBendSource ?? null;
    this.vibratoDepth = vibratoDepth ?? null;
    this.glideFrom =
      glideFrom && glideFrom.time > 0 && glideFrom.note !== note ? glideFrom : null;
    this.output = ctx.createGain();
    this.output.gain.value = 0.25; // headroom for polyphony
    this.output.connect(dest);
    this.build();
  }

  private freqFromNote(note: number, ratio: number, detune: number): number {
    const f = 440 * Math.pow(2, (note - 69) / 12);
    return f * ratio * Math.pow(2, detune / 1200);
  }

  private build() {
    const now = this.ctx.currentTime;
    const algo = ALGORITHMS[this.patch.algorithm - 1] ?? ALGORITHMS[0];
    const baseFreq = 440 * Math.pow(2, (this.note - 69) / 12);

    for (let i = 0; i < 4; i++) {
      const op = this.ops[i];
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      // Per-op detune baked into frequency; osc.detune stays at 0 cents and
      // receives pitch bend (ConstantSourceNode) + vibrato (GainNode) additively.
      const targetFreq = this.freqFromNote(this.note, op.ratio, op.detune);
      if (this.glideFrom) {
        // Poly portamento: start at the previous pitch, glide exponentially
        // to the target. Mod depths/feedback below use the TARGET frequency
        // (constant-index approximation — standard for FM portamento).
        const startFreq = this.freqFromNote(this.glideFrom.note, op.ratio, op.detune);
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.setTargetAtTime(targetFreq, now, this.glideFrom.time);
      } else {
        osc.frequency.value = targetFreq;
      }
      if (this.pitchBendSource) this.pitchBendSource.connect(osc.detune);
      if (this.vibratoDepth) this.vibratoDepth.connect(osc.detune);

      const env = this.ctx.createGain();
      env.gain.value = 0;
      osc.connect(env);
      this.oscs.push(osc);
      this.envGains.push(env);

      // Envelope
      const level = op.enabled ? op.level : 0;
      const master = this.patch.masterAttack;
      const attack = Math.max(0.001, op.attack + master);
      const decay = Math.max(0.001, op.decay);
      const sustain = op.sustain * level;
      env.gain.cancelScheduledValues(now);
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(level, now + attack);
      env.gain.linearRampToValueAtTime(sustain, now + attack + decay);
    }

    // For each carrier: create a carrier gain, sum into output
    for (const ci of algo.carriers) {
      const cg = this.ctx.createGain();
      cg.gain.value = 1;
      this.envGains[ci].connect(cg);
      cg.connect(this.output);
      this.carrierGains.push(cg);
    }

    // Modulation edges: env of source -> modGain -> dest.frequency
    for (const [src, dst] of algo.modulations) {
      const mg = this.ctx.createGain();
      const destFreq = this.freqFromNote(this.note, this.ops[dst].ratio, this.ops[dst].detune);
      mg.gain.value = destFreq * this.patch.fmDepth * 4;
      this.envGains[src].connect(mg);
      mg.connect(this.oscs[dst].frequency);
      this.modGains.push(mg);
    }

    // Feedback loop on feedbackOp via delay
    if (this.patch.feedback > 0) {
      const fbOp = algo.feedbackOp;
      const delay = this.ctx.createDelay(0.02);
      delay.delayTime.value = 1 / this.ctx.sampleRate;
      const fbGain = this.ctx.createGain();
      const baseFbFreq = this.freqFromNote(this.note, this.ops[fbOp].ratio, this.ops[fbOp].detune);
      fbGain.gain.value = baseFbFreq * this.patch.feedback * 2;
      this.envGains[fbOp].connect(delay);
      delay.connect(fbGain);
      fbGain.connect(this.oscs[fbOp].frequency);
      this.feedbackNode = fbGain;
      this.feedbackDelay = delay;
    }

    // Velocity affects overall output
    const velGain = 1 - this.patch.velocitySens + this.patch.velocitySens * this.velocity;
    this.output.gain.setValueAtTime(this.output.gain.value * velGain, now);

    for (const osc of this.oscs) osc.start(now);
    void baseFreq;
  }

  // Retune (for glide in mono mode).
  // Pitch bend continues to apply additively via osc.detune — no adjustment needed here.
  retune(note: number, glide: number) {
    this.note = note;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const op = this.ops[i];
      const f = this.freqFromNote(note, op.ratio, op.detune);
      this.oscs[i].frequency.cancelScheduledValues(now);
      if (glide > 0) {
        this.oscs[i].frequency.setTargetAtTime(f, now, glide);
      } else {
        this.oscs[i].frequency.setValueAtTime(f, now);
      }
    }
  }

  release() {
    if (!this.active) return;
    this.active = false;
    const now = this.ctx.currentTime;
    // Guarded: param automation against a context the OS closed mid-session
    // can throw on Safari; a released voice must always end up reapable.
    try {
      let maxRel = 0;
      for (let i = 0; i < 4; i++) {
        const op = this.ops[i];
        const rel = Math.max(0.02, op.release + this.patch.masterRelease);
        const env = this.envGains[i];
        const cur = env.gain.value;
        env.gain.cancelScheduledValues(now);
        env.gain.setValueAtTime(cur, now);
        env.gain.linearRampToValueAtTime(0, now + rel);
        if (rel > maxRel) maxRel = rel;
      }
      this.endTime = now + maxRel + 0.05;
    } catch {
      this.endTime = now;
    }
  }

  // Immediate stop (panic)
  stop() {
    const now = this.ctx.currentTime;
    this.active = false;
    try {
      this.output.gain.cancelScheduledValues(now);
      this.output.gain.setValueAtTime(this.output.gain.value, now);
      this.output.gain.linearRampToValueAtTime(0, now + 0.02);
      this.endTime = now + 0.05;
    } catch {
      this.endTime = now;
    }
  }

  isDone(now: number) {
    return !this.active && now >= this.endTime;
  }

  dispose() {
    try {
      for (let i = 0; i < this.oscs.length; i++) {
        const osc = this.oscs[i];
        // Disconnect shared modulation sources from this oscillator's detune
        // before stopping. Explicit per-AudioParam disconnect prevents leaked
        // connections after the voice is GC'd. Idempotent — errors are swallowed.
        try { this.pitchBendSource?.disconnect(osc.detune); } catch { /* already disconnected */ }
        try { this.vibratoDepth?.disconnect(osc.detune); } catch { /* already disconnected */ }
        try { osc.stop(); } catch { /* already stopped */ }
        osc.disconnect();
      }
      for (const g of this.envGains) g.disconnect();
      for (const g of this.modGains) g.disconnect();
      for (const g of this.carrierGains) g.disconnect();
      this.feedbackNode?.disconnect();
      this.feedbackDelay?.disconnect();
      this.output.disconnect();
    } catch {
      /* noop */
    }
  }
}
