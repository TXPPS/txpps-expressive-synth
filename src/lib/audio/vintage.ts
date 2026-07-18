import type { VintageParams } from "./types";

// Vintage Circuit: coordinated coloration path.
// Signature TX27 module. Not a plain distortion or filter.
export class VintageCircuit {
  ctx: AudioContext;
  input: GainNode;
  output: GainNode;
  private preDrive: GainNode;
  private shaper: WaveShaperNode;
  private postGain: GainNode;
  private toneHi: BiquadFilterNode; // gentle HF softening
  private toneLo: BiquadFilterNode; // low-mid warmth
  private noiseSrc?: AudioBufferSourceNode;
  private noiseGain: GainNode;
  private driftLFO?: OscillatorNode;
  private driftGain?: GainNode;
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  private leftGain: GainNode;
  private rightGain: GainNode;
  private leftTone: BiquadFilterNode;
  private rightTone: BiquadFilterNode;
  private bypassGain: GainNode; // pass-through when disabled
  private wetGain: GainNode;
  private params: VintageParams;
  private enabled = true;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.bypassGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    this.preDrive = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = "2x";
    this.postGain = ctx.createGain();

    this.toneLo = ctx.createBiquadFilter();
    this.toneLo.type = "peaking";
    this.toneLo.frequency.value = 220;
    this.toneLo.Q.value = 0.7;
    this.toneLo.gain.value = 0;

    this.toneHi = ctx.createBiquadFilter();
    this.toneHi.type = "lowshelf";
    this.toneHi.frequency.value = 6000;
    this.toneHi.gain.value = 0;

    this.splitter = ctx.createChannelSplitter(2);
    this.merger = ctx.createChannelMerger(2);
    this.leftGain = ctx.createGain();
    this.rightGain = ctx.createGain();
    this.leftTone = ctx.createBiquadFilter();
    this.leftTone.type = "highshelf";
    this.leftTone.frequency.value = 4000;
    this.leftTone.gain.value = 0;
    this.rightTone = ctx.createBiquadFilter();
    this.rightTone.type = "highshelf";
    this.rightTone.frequency.value = 4200;
    this.rightTone.gain.value = 0;

    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;

    // wire wet path
    this.input.connect(this.preDrive);
    this.preDrive.connect(this.shaper);
    this.shaper.connect(this.postGain);
    this.postGain.connect(this.toneLo);
    this.toneLo.connect(this.toneHi);
    this.toneHi.connect(this.splitter);
    this.splitter.connect(this.leftTone, 0);
    this.splitter.connect(this.rightTone, 1);
    this.leftTone.connect(this.leftGain);
    this.rightTone.connect(this.rightGain);
    this.leftGain.connect(this.merger, 0, 0);
    this.rightGain.connect(this.merger, 0, 1);
    this.merger.connect(this.wetGain);
    this.wetGain.connect(this.output);

    // bypass path (used when disabled)
    this.input.connect(this.bypassGain);
    this.bypassGain.connect(this.output);
    this.bypassGain.gain.value = 0;
    this.wetGain.gain.value = 1;

    // noise
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.5;
    const nsrc = ctx.createBufferSource();
    nsrc.buffer = noiseBuf;
    nsrc.loop = true;
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = "highpass";
    nFilter.frequency.value = 400;
    nsrc.connect(nFilter);
    nFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.output);
    nsrc.start();
    this.noiseSrc = nsrc;

    this.params = {
      enabled: true,
      age: 0.3,
      warmth: 0.5,
      grain: 0.3,
      wear: 0.3,
      drift: 0.3,
      noise: 0.2,
      stereoAge: 0.3,
      drive: 0.4,
    };
    this.applyParams(this.params);
  }

  private makeCurve(drive: number, grain: number): Float32Array {
    // gentle tanh + tiny grain-like inflection
    const n = 1024;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    const k = 1 + drive * 6;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      let y = Math.tanh(x * k) / Math.tanh(k);
      y += grain * 0.02 * Math.sin(x * Math.PI * 6);
      curve[i] = Math.max(-1, Math.min(1, y));
    }
    return curve;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    const now = this.ctx.currentTime;
    this.wetGain.gain.cancelScheduledValues(now);
    this.bypassGain.gain.cancelScheduledValues(now);
    this.wetGain.gain.linearRampToValueAtTime(on ? 1 : 0, now + 0.05);
    this.bypassGain.gain.linearRampToValueAtTime(on ? 0 : 1, now + 0.05);
    if (!on) {
      this.noiseGain.gain.linearRampToValueAtTime(0, now + 0.05);
    } else {
      this.applyParams(this.params);
    }
  }

  applyParams(p: VintageParams) {
    this.params = p;
    const now = this.ctx.currentTime;
    const age = p.age;
    // nonlinear coordinated mappings
    const warmth = p.warmth * (0.4 + age * 0.9);
    const grain = p.grain * age;
    const wear = p.wear * (0.3 + age * 1.1);
    const drift = p.drift * age;
    const noise = p.noise * age * age;
    const stereo = p.stereoAge * (0.3 + age);
    const drive = p.drive * (0.4 + age * 0.8);

    this.preDrive.gain.setTargetAtTime(1 + drive * 1.2, now, 0.05);
    // automatic level compensation
    this.postGain.gain.setTargetAtTime(1 / (1 + drive * 0.9), now, 0.05);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.shaper as any).curve = this.makeCurve(drive, grain);

    this.toneLo.gain.setTargetAtTime(warmth * 3, now, 0.05); // dB
    this.toneHi.gain.setTargetAtTime(-wear * 4, now, 0.05);

    // stereo age: subtle L/R gain + tone mismatch, slight narrowing
    const narrow = 1 - stereo * 0.15;
    this.leftGain.gain.setTargetAtTime(narrow * (1 - stereo * 0.03), now, 0.05);
    this.rightGain.gain.setTargetAtTime(narrow * (1 + stereo * 0.03), now, 0.05);
    this.leftTone.gain.setTargetAtTime(-stereo * 1.2, now, 0.05);
    this.rightTone.gain.setTargetAtTime(stereo * 0.8, now, 0.05);

    // Noise level — only audible when signal is present is hard without gate;
    // use a low base level scaled by wet gain (wet gain = 0 when disabled).
    this.noiseGain.gain.setTargetAtTime(this.enabled ? noise * 0.0015 : 0, now, 0.1);

    // Drift: small pitch-related instability applied globally by tiny detune
    // via a slow LFO into the input's playbackRate is impossible without a source;
    // instead we modulate postGain very slightly for level instability.
    if (!this.driftLFO) {
      this.driftLFO = this.ctx.createOscillator();
      this.driftLFO.frequency.value = 0.3;
      this.driftGain = this.ctx.createGain();
      this.driftGain.gain.value = 0;
      this.driftLFO.connect(this.driftGain);
      this.driftGain.connect(this.postGain.gain);
      this.driftLFO.start();
    }
    if (this.driftGain) {
      this.driftGain.gain.setTargetAtTime(drift * 0.02, now, 0.1);
    }
  }

  // Extra "vintage darkness" amount to influence reverb IR / damping (0..1)
  getReverbDarkness(): number {
    if (!this.enabled) return 0;
    return Math.min(1, this.params.age * 0.7 + this.params.wear * 0.3);
  }
}
