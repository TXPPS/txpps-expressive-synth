import { Panel } from "./Panel";
import { useSynthStore } from "@/state/store";
import { PARAM_BY_ID } from "@/state/params";

const FX = [
  { name: "Chorus", ids: ["fx.chorus.on", "fx.chorus.rate", "fx.chorus.depth", "fx.chorus.mix"] },
  { name: "Delay", ids: ["fx.delay.on", "fx.delay.time", "fx.delay.fb", "fx.delay.mix"] },
  { name: "Reverb", ids: ["fx.reverb.on", "fx.reverb.size", "fx.reverb.mix"] },
];

export function FxPanel() {
  const patch = useSynthStore((s) => s.patch);
  const setParam = useSynthStore((s) => s.setParam);
  return (
    <Panel title="Effects" subtitle="CH → DLY → REV" accent="amber">
      <div className="space-y-2">
        {FX.map((fx) => {
          const onId = fx.ids[0];
          const on = patch[onId] as boolean;
          return (
            <div key={fx.name} className="panel-sunken p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="silkscreen-strong">{fx.name}</span>
                <button
                  onClick={() => setParam(onId, !on)}
                  className={`silkscreen rounded border px-1.5 py-0.5 text-[0.6rem] ${
                    on
                      ? "border-[color:var(--phosphor)] text-[color:var(--phosphor)]"
                      : "border-[color:var(--hairline-strong)] text-[color:var(--silkscreen-dim)]"
                  }`}
                >
                  {on ? "ON" : "OFF"}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {fx.ids.slice(1).map((id) => {
                  const def = PARAM_BY_ID.get(id)!;
                  const v = patch[id] as number;
                  return (
                    <label key={id} className="flex flex-col min-w-0">
                      <span className="silkscreen truncate">{def.label}</span>
                      <input
                        type="range"
                        min={def.min}
                        max={def.max}
                        step={def.step}
                        value={v}
                        onChange={(e) => setParam(id, parseFloat(e.target.value))}
                        className="accent-[color:var(--amber)]"
                      />
                      <span className="readout text-[0.65rem] text-[color:var(--amber)]">
                        {v.toFixed(2)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
