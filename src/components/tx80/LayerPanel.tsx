import { ParamKnob } from "@/components/tx80/ParamKnob";
import type { ParameterValue } from "@/lib/synth/contracts";
import type { Tx80Layer, Tx80Waveform } from "@/lib/tx80/types";

const WAVE_LABELS: Record<Tx80Waveform, string> = {
  saw: "SAW",
  pulse: "PULSE",
  triangle: "TRI",
  sine: "SINE",
};

function fmtHz(v: number): string {
  return v < 1000 ? v.toFixed(0) : (v / 1000).toFixed(1) + "k";
}
function pct(v: number): string {
  return (v * 100).toFixed(0);
}
function signedInt(v: number): string {
  return v > 0 ? `+${v.toFixed(0)}` : v.toFixed(0);
}

/** Full editor for one TX-80 layer. Every control routes through the
 *  authoritative registry (ranges/steps come from the definitions via
 *  ParamKnob) using the layer's id prefix (l1.* / l2.*). */
export function LayerPanel({
  index,
  layer,
  setParameter,
}: {
  index: 0 | 1;
  layer: Tx80Layer;
  setParameter: (id: string, value: ParameterValue) => void;
}) {
  const p = `l${index + 1}`;
  const roman = index === 0 ? "I" : "II";

  return (
    <div className={layer.enabled ? "" : "opacity-60"}>
      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-black/40">
        <div className="text-[10px] tracking-[0.3em] text-tx-muted flex-1">LAYER {roman}</div>
        <button
          className={`tx-btn ${layer.enabled ? "tx-btn-active" : ""}`}
          onClick={() => setParameter(`${p}.enabled`, !layer.enabled)}
          aria-pressed={layer.enabled}
        >
          {layer.enabled ? "ON" : "MUTED"}
        </button>
      </div>

      {/* Source */}
      <div className="flex gap-1 mb-2">
        {(Object.keys(WAVE_LABELS) as Tx80Waveform[]).map((w) => (
          <button
            key={w}
            className={`tx-btn flex-1 px-1 ${layer.wave === w ? "tx-btn-active" : ""}`}
            onClick={() => setParameter(`${p}.wave`, w)}
            aria-pressed={layer.wave === w}
          >
            {WAVE_LABELS[w]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        <ParamKnob
          id={`${p}.octave`}
          label="OCTAVE"
          value={layer.octave}
          onChange={setParameter}
          format={signedInt}
        />
        <ParamKnob
          id={`${p}.coarse`}
          label="COARSE"
          value={layer.coarse}
          onChange={setParameter}
          format={signedInt}
        />
        <ParamKnob
          id={`${p}.fine`}
          label="FINE"
          value={layer.fine}
          onChange={setParameter}
          format={(v) => v.toFixed(1)}
        />
        <div
          className={layer.wave === "pulse" ? "" : "opacity-40"}
          title={layer.wave === "pulse" ? undefined : "Pulse wave only"}
        >
          <ParamKnob
            id={`${p}.pw`}
            label="PW"
            value={layer.pulseWidth}
            onChange={setParameter}
            format={pct}
          />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        <ParamKnob
          id={`${p}.oscLevel`}
          label="OSC"
          value={layer.oscLevel}
          onChange={setParameter}
          format={pct}
        />
        <ParamKnob
          id={`${p}.subLevel`}
          label="SUB"
          value={layer.subLevel}
          onChange={setParameter}
          format={pct}
        />
        <ParamKnob
          id={`${p}.noiseLevel`}
          label="NOISE"
          value={layer.noiseLevel}
          onChange={setParameter}
          format={pct}
        />
        <ParamKnob
          id={`${p}.pan`}
          label="PAN"
          value={layer.pan}
          onChange={setParameter}
          format={(v) =>
            Math.abs(v) < 0.005
              ? "C"
              : v < 0
                ? `L${Math.round(-v * 100)}`
                : `R${Math.round(v * 100)}`
          }
        />
      </div>

      {/* Filter */}
      <div className="text-[9px] tracking-[0.3em] text-tx-muted pb-1 border-b border-black/40 mb-2">
        FILTER
      </div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        <ParamKnob
          id={`${p}.filter.cutoff`}
          label="CUTOFF"
          taper="log"
          value={layer.filter.cutoff}
          onChange={setParameter}
          format={fmtHz}
        />
        <ParamKnob
          id={`${p}.filter.resonance`}
          label="RESO"
          value={layer.filter.resonance}
          onChange={setParameter}
          format={pct}
        />
        <ParamKnob
          id={`${p}.filter.envAmount`}
          label="ENV AMT"
          value={layer.filter.envAmount}
          onChange={setParameter}
          format={(v) => (v * 100).toFixed(0)}
        />
        <ParamKnob
          id={`${p}.filter.keyTracking`}
          label="KEY TRK"
          value={layer.filter.keyTracking}
          onChange={setParameter}
          format={pct}
        />
      </div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        <ParamKnob
          id={`${p}.fenv.attack`}
          label="F.ATK"
          taper="log"
          value={layer.filterEnv.attack}
          onChange={setParameter}
          format={(v) => v.toFixed(2)}
        />
        <ParamKnob
          id={`${p}.fenv.decay`}
          label="F.DEC"
          taper="log"
          value={layer.filterEnv.decay}
          onChange={setParameter}
          format={(v) => v.toFixed(2)}
        />
        <ParamKnob
          id={`${p}.fenv.sustain`}
          label="F.SUS"
          value={layer.filterEnv.sustain}
          onChange={setParameter}
          format={pct}
        />
        <ParamKnob
          id={`${p}.fenv.release`}
          label="F.REL"
          taper="log"
          value={layer.filterEnv.release}
          onChange={setParameter}
          format={(v) => v.toFixed(2)}
        />
      </div>

      {/* Amp */}
      <div className="text-[9px] tracking-[0.3em] text-tx-muted pb-1 border-b border-black/40 mb-2">
        AMPLIFIER
      </div>
      <div className="grid grid-cols-5 gap-2">
        <ParamKnob
          id={`${p}.aenv.attack`}
          label="A.ATK"
          taper="log"
          value={layer.ampEnv.attack}
          onChange={setParameter}
          format={(v) => v.toFixed(2)}
        />
        <ParamKnob
          id={`${p}.aenv.decay`}
          label="A.DEC"
          taper="log"
          value={layer.ampEnv.decay}
          onChange={setParameter}
          format={(v) => v.toFixed(2)}
        />
        <ParamKnob
          id={`${p}.aenv.sustain`}
          label="A.SUS"
          value={layer.ampEnv.sustain}
          onChange={setParameter}
          format={pct}
        />
        <ParamKnob
          id={`${p}.aenv.release`}
          label="A.REL"
          taper="log"
          value={layer.ampEnv.release}
          onChange={setParameter}
          format={(v) => v.toFixed(2)}
        />
        <ParamKnob
          id={`${p}.level`}
          label="LEVEL"
          value={layer.level}
          onChange={setParameter}
          format={pct}
        />
      </div>
    </div>
  );
}
