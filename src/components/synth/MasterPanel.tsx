import { Panel } from "./Panel";
import { useSynthStore } from "@/state/store";
import { LIVE_RIBBON_MODES, PARAM_BY_ID } from "@/state/params";

const IDS = [
  "master.level",
  "master.tune",
  "master.polyphony",
  "porta.on",
  "porta.time",
  "gliss.on",
  "gliss.rate",
  "ribbon.mode",
  "ribbon.range",
];

const LIVE_MODES = new Set<string>(LIVE_RIBBON_MODES);

export function MasterPanel() {
  const patch = useSynthStore((s) => s.patch);
  const setParam = useSynthStore((s) => s.setParam);
  return (
    <Panel title="Master / Performance" accent="phosphor">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {IDS.map((id) => {
          const def = PARAM_BY_ID.get(id)!;
          const v = patch[id];
          return (
            <label key={id} className="panel-sunken flex flex-col gap-1 px-2 py-1.5 min-w-0">
              <span className="silkscreen truncate">{def.label}</span>
              {def.type === "bool" ? (
                <button
                  type="button"
                  onClick={() => setParam(id, !(v as boolean))}
                  className={`silkscreen rounded border px-2 py-0.5 text-[0.6rem] self-start ${
                    v
                      ? "border-[color:var(--phosphor)] text-[color:var(--phosphor)]"
                      : "border-[color:var(--hairline-strong)] text-[color:var(--silkscreen-dim)]"
                  }`}
                >
                  {v ? "ON" : "OFF"}
                </button>
              ) : def.type === "enum" ? (
                <>
                  <select
                    value={
                      id === "ribbon.mode" && !LIVE_MODES.has(String(v))
                        ? "continuous"
                        : (v as string)
                    }
                    onChange={(e) => setParam(id, e.target.value)}
                    className="readout bg-transparent text-sm border border-[color:var(--hairline)] rounded px-1 py-0.5"
                  >
                    {def.values!
                      .filter((val) => (id === "ribbon.mode" ? LIVE_MODES.has(val) : true))
                      .map((val) => (
                        <option key={val} value={val} className="bg-[color:var(--panel-raised)]">
                          {val}
                        </option>
                      ))}
                  </select>
                  {id === "ribbon.mode" && (
                    <span className="silkscreen text-[0.5rem] text-[color:var(--silkscreen-dim)]">
                      trigger mode disabled (pending)
                    </span>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="range"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={v as number}
                    onChange={(e) =>
                      setParam(id, def.type === "int" ? parseInt(e.target.value, 10) : parseFloat(e.target.value))
                    }
                    className="accent-[color:var(--phosphor)]"
                  />
                  <span className="readout text-[0.7rem]">
                    {(v as number).toFixed(def.step && def.step >= 1 ? 0 : 2)}
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
