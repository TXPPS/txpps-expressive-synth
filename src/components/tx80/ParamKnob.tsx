import { Knob } from "@/components/tx27/Knob";
import { getTx80ParameterDefinition } from "@/lib/tx80/parameters";

/** Registry-bound knob: minimum, maximum and step come from the
 *  authoritative TX-80 parameter definition — never from the call site.
 *  Label and value formatting are presentation-only concerns. */
export function ParamKnob({
  id,
  value,
  onChange,
  label,
  format,
  taper,
  size,
}: {
  id: string;
  value: number;
  onChange: (id: string, value: number) => void;
  label: string;
  format?: (v: number) => string;
  taper?: "linear" | "log";
  size?: number;
}) {
  const def = getTx80ParameterDefinition(id);
  return (
    <Knob
      label={label}
      value={value}
      min={def.minimum ?? 0}
      max={def.maximum ?? 1}
      step={def.step}
      onChange={(v) => onChange(id, v)}
      format={format}
      taper={taper}
      size={size}
    />
  );
}
