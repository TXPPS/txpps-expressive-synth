import { Panel } from "./Panel";
import { useSynthStore } from "@/state/store";
import { PARAM_BY_ID } from "@/state/params";

function LfoBlock({ idx }: { idx: 1 | 2 }) {
  const patch = useSynthStore((s) => s.patch);
  const setParam = useSynthStore((s) => s.setParam);
  const prefix = `mod.lfo${idx}`;
  const ids = [`${prefix}.wave`, `${prefix}.rate`, `${prefix}.depth`, `${prefix}.dest`];
  return (
    <div className="panel-sunken p-2 space-y-1.5">
      <div className="silkscreen-strong text-[color:var(--phosphor)]">LFO {idx}</div>
      <div className="grid grid-cols-2 gap-2">
        {ids.map((id) => {
          const def = PARAM_BY_ID.get(id)!;
          const val = patch[id];
          return (
            <label key={id} className="flex flex-col gap-1 min-w-0">
              <span className="silkscreen truncate">{def.label}</span>
              {def.type === "enum" ? (
                <select
                  value={val as string}
                  onChange={(e) => setParam(id, e.target.value)}
                  className="readout bg-transparent text-sm border border-[color:var(--hairline)] rounded px-1 py-0.5"
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
                    step={def.step}
                    value={val as number}
                    onChange={(e) => setParam(id, parseFloat(e.target.value))}
                    className="accent-[color:var(--phosphor)]"
                  />
                  <span className="readout text-[0.65rem]">
                    {(val as number).toFixed(2)}
                    {def.unit ? ` ${def.unit}` : ""}
                  </span>
                </>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function ModPanel() {
  return (
    <Panel title="Modulation" accent="phosphor">
      <div className="space-y-2">
        <LfoBlock idx={1} />
        <LfoBlock idx={2} />
      </div>
    </Panel>
  );
}
