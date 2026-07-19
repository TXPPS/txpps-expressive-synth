/**
 * Bidirectional helpers between UI PatchValues and engine Tx80Patch.
 * Used by the factory/user preset browser so the Zustand store stays
 * authoritative while donor factory sounds remain loadable.
 */

import { defaultPatch, type PatchValues } from "@/state/params";
import type { Tx80Patch, Tx80Waveform } from "@/synth-core/tx80/types";

const UI_WAVES = new Set(["saw", "square", "pulse", "triangle", "sine"]);

function waveToUi(w: Tx80Waveform): string {
  return UI_WAVES.has(w) ? w : "saw";
}

function ribbonToUi(mode: Tx80Patch["ribbon"]["mode"]): string {
  if (mode === "gliss") return "glissando";
  if (mode === "hold") return "hold";
  return "continuous";
}

function layerToUi(prefix: "layerI" | "layerII", layer: Tx80Patch["layers"][0], out: PatchValues) {
  out[`${prefix}.osc.wave`] = waveToUi(layer.wave);
  out[`${prefix}.osc.octave`] = layer.octave;
  out[`${prefix}.osc.tune`] = layer.coarse;
  out[`${prefix}.osc.fine`] = layer.fine;
  out[`${prefix}.osc.pw`] = layer.pulseWidth;
  out[`${prefix}.sub.level`] = layer.subLevel;
  out[`${prefix}.noise.level`] = layer.noiseLevel;
  out[`${prefix}.mix.osc`] = layer.oscLevel;
  out[`${prefix}.filt.cutoff`] = layer.filter.cutoff;
  out[`${prefix}.filt.reso`] = layer.filter.resonance;
  out[`${prefix}.filt.envAmt`] = layer.filter.envAmount;
  out[`${prefix}.filt.kbd`] = layer.filter.keyTracking;
  out[`${prefix}.env.f.a`] = layer.filterEnv.attack;
  out[`${prefix}.env.f.d`] = layer.filterEnv.decay;
  out[`${prefix}.env.f.s`] = layer.filterEnv.sustain;
  out[`${prefix}.env.f.r`] = layer.filterEnv.release;
  out[`${prefix}.env.a.a`] = layer.ampEnv.attack;
  out[`${prefix}.env.a.d`] = layer.ampEnv.decay;
  out[`${prefix}.env.a.s`] = layer.ampEnv.sustain;
  out[`${prefix}.env.a.r`] = layer.ampEnv.release;
  out[`${prefix}.layer.on`] = layer.enabled;
  out[`${prefix}.layer.level`] = layer.level;
  out[`${prefix}.layer.pan`] = layer.pan;
}

function lfoToUi(idx: 1 | 2, lfo: Tx80Patch["lfoA"], out: PatchValues) {
  const dest =
    lfo.destination === "filter"
      ? "cutoff"
      : lfo.destination === "balance"
        ? "layerBalance"
        : lfo.destination;
  out[`mod.lfo${idx}.wave`] = lfo.wave;
  out[`mod.lfo${idx}.rate`] = lfo.rate;
  out[`mod.lfo${idx}.depth`] = lfo.depth;
  out[`mod.lfo${idx}.dest`] = dest;
}

/** Convert a donor engine patch into UI store values (merged onto defaults). */
export function enginePatchToUiValues(patch: Tx80Patch): PatchValues {
  const out = defaultPatch();
  layerToUi("layerI", patch.layers[0], out);
  layerToUi("layerII", patch.layers[1], out);
  lfoToUi(1, patch.lfoA, out);
  lfoToUi(2, patch.lfoB, out);

  out["fx.chorus.on"] = patch.chorus.enabled;
  out["fx.chorus.rate"] = patch.chorus.rate;
  out["fx.chorus.depth"] = Math.min(1, patch.chorus.depth / 0.01);
  out["fx.chorus.mix"] = patch.chorus.amount;
  out["fx.delay.on"] = patch.delay.enabled;
  out["fx.delay.time"] = patch.delay.time;
  out["fx.delay.fb"] = patch.delay.feedback;
  out["fx.delay.mix"] = patch.delay.mix;
  out["fx.reverb.on"] = patch.reverb.enabled;
  out["fx.reverb.size"] = patch.reverb.size;
  out["fx.reverb.mix"] = patch.reverb.mix;

  const travel = patch.pitchTravel;
  out["porta.on"] = travel.mode === "porta";
  out["gliss.on"] = travel.mode === "gliss";
  out["porta.time"] = travel.mode === "porta" ? travel.time : (out["porta.time"] as number);
  out["gliss.rate"] =
    travel.mode === "gliss" ? Math.min(0.6, travel.time / 12) : (out["gliss.rate"] as number);

  out["ribbon.mode"] = ribbonToUi(patch.ribbon.mode);
  out["ribbon.range"] = patch.ribbon.range;
  out["master.level"] = patch.master.volume;
  out["master.tune"] = patch.master.tune ?? 440;
  out["master.polyphony"] = patch.polyphony;

  return out;
}
