import { Panel } from "./Panel";
import { useSynthStore } from "@/state/store";
import { PARAM_BY_ID } from "@/state/params";

interface Props {
  scope: "layerI" | "layerII";
  label: string;
}

// Milestone 1: visual control readouts driven by real state (bool toggle,
// number sliders). Not yet routed to audio — the routing is added in M2/M3.
// Every control shown is bound to setParam and will become the same control
// in the final wire-up, not a decorative stub.
export function LayerPanel({ scope, label }: Props) {
  const patch = useSynthStore((s) => s.patch);
  const setParam = useSynthStore((s) => s.setParam);
  const on = patch[`${scope}.layer.on`] as boolean;

  const rows: Array<{ id: string; group: string }> = [
    { id: `${scope}.osc.wave`, group: "OSC" },
    { id: `${scope}.osc.octave`, group: "OSC" },
    { id: `${scope}.osc.tune`, group: "OSC" },
    { id: `${scope}.osc.pw`, group: "OSC" },
    { id: `${scope}.sub.level`, group: "MIX" },
    { id: `${scope}.noise.level`, group: "MIX" },
    { id: `${scope}.filt.cutoff`, group: "VCF" },
    { id: `${scope}.filt.reso`, group: "VCF" },
    { id: `${scope}.filt.envAmt`, group: "VCF" },
    { id: `${scope}.env.a.a`, group: "AMP" },
    { id: `${scope}.env.a.d`, group: "AMP" },
    { id: `${scope}.env.a.s`, group: "AMP" },
    { id: `${scope}.env.a.r`, group: "AMP" },
    { id: `${scope}.layer.level`, group: "OUT" },
    { id: `${scope}.layer.pan`, group: "OUT" },
  ];

  return (
    <Panel
      title={label}
      subtitle={on ? "ON" : "OFF"}
      accent={on ? "phosphor" : "none"}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          onClick={() => setParam(`${scope}.layer.on`, !on)}
          className={`silkscreen-strong rounded border px-2 py-0.5 text-[0.6rem] ${
            on
              ? "border-[color:var(--phosphor)] text-[color:var(--phosphor)]"
              : "border-[color:var(--hairline-strong)] text-[color:var(--silkscreen-dim)]"
          }`}
        >
          {on ? "ENABLED" : "MUTED"}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {rows.map(({ id, group }) => {
          const def = PARAM_BY_ID.get(id);
          if (!def) return null;
          const value = patch[id];
          return (
            <label key={id} className="panel-sunken flex flex-col gap-1 px-2 py-1.5 min-w-0">
              <span className="silkscreen truncate">
                <span className="text-[color:var(--phosphor-dim)]">{group}</span> · {def.label}
              </span>
              {def.type === "enum" ? (
                <select
                  value={value as string}
                  onChange={(e) => setParam(id, e.target.value)}
                  className="readout bg-transparent border-none text-sm outline-none appearance-none"
                >
                  {def.values!.map((v) => (
                    <option key={v} value={v} className="bg-[color:var(--panel-raised)]">
                      {v}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    type="range"
                    min={def.min}
                    max={def.max}
                    step={def.step ?? 0.01}
                    value={value as number}
                    onChange={(e) => setParam(id, parseFloat(e.target.value))}
                    className="accent-[color:var(--phosphor)] w-full"
                  />
                  <span className="readout text-[0.7rem] truncate">
                    {typeof value === "number" ? value.toFixed(def.step && def.step >= 1 ? 0 : 2) : String(value)}
                    {def.unit ? ` ${def.unit}` : ""}
                  </span>
                </>
              )}
            </label>
          );
        })}
      </div>
    </Panel>
  );
}
