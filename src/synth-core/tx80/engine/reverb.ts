import type { ReverbParams } from "../types";

// Generate an original stereo impulse response for one of three reverb modes.
// Purely algorithmic — no external samples.
export function buildIR(
  ctx: BaseAudioContext,
  params: ReverbParams,
  vintageDark: number = 0,
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const decaySeconds = Math.max(0.2, 0.4 + params.decay * 6 * (0.3 + params.size));
  const length = Math.min(sampleRate * 8, Math.floor(sampleRate * decaySeconds));
  const buffer = ctx.createBuffer(2, length, sampleRate);

  const damping = Math.min(0.99, 0.1 + params.damping * 0.85 + vintageDark * 0.15);
  const width = Math.max(0, Math.min(1, params.width));

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    let seed = ch === 0 ? 1337 : 4242;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed / 0xffffffff) * 2 - 1;
    };
    // Early reflection cluster differs per mode
    const earlyCount = params.type === "digital" ? 8 : params.type === "hall" ? 14 : 22;
    for (let e = 0; e < earlyCount; e++) {
      const t = Math.floor((0.002 + Math.random() * (0.06 + params.size * 0.12)) * sampleRate);
      if (t < length) data[t] += (Math.random() * 2 - 1) * 0.6;
    }

    for (let i = 0; i < length; i++) {
      const t = i / length;
      let env: number;
      if (params.type === "digital") {
        env = Math.pow(1 - t, 2.5);
      } else if (params.type === "hall") {
        env = Math.pow(1 - t, 1.8) * (0.9 + 0.1 * Math.sin(i * 0.001));
      } else {
        // glass — brighter, longer diffuse tail
        env = Math.pow(1 - t, 1.4);
      }
      const sample = rnd() * env;
      // one-pole lowpass for damping / darkness
      lp = lp + (1 - damping) * (sample - lp);
      const damped = params.type === "glass" ? sample * 0.5 + lp * 0.5 : lp;
      data[i] += damped;
    }
    // simple stereo width narrowing per channel
    for (let i = 0; i < length; i++) {
      data[i] *= 0.5 + 0.5 * width;
    }
  }
  return buffer;
}
