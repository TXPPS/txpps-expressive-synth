import { useSynthStore } from "@/state/store";
import { useRef, type ReactNode } from "react";

/**
 * Vertical pitch and mod wheels.
 * Sustain lives beside the octave column (see Keyboard) for a large,
 * reachable performance target under the C# readout.
 */
export function PerformanceStrip() {
  const { pitchBend, modWheel, setPitchBend, setModWheel } = useSynthStore();
  return (
    <div className="flex gap-3 sm:gap-4 items-end shrink-0 pr-1">
      <WheelColumn label="PITCH">
        <VerticalStrip
          label="PITCH"
          value={pitchBend}
          min={-1}
          max={1}
          centered
          onChange={setPitchBend}
          onRelease={() => setPitchBend(0)}
        />
      </WheelColumn>
      <WheelColumn label="MOD">
        <VerticalStrip label="MOD" value={modWheel} min={0} max={1} onChange={setModWheel} />
      </WheelColumn>
    </div>
  );
}

function WheelColumn({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {children}
      <span className="silkscreen text-[0.55rem] sm:text-[0.6rem] tracking-wide text-center w-full">
        {label}
      </span>
    </div>
  );
}

function VerticalStrip({
  label,
  value,
  min,
  max,
  centered,
  onChange,
  onRelease,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  centered?: boolean;
  onChange: (v: number) => void;
  onRelease?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div
      ref={ref}
      className="panel-sunken relative w-9 sm:w-11 h-[4.5rem] sm:h-28 rounded-md flex flex-col items-center justify-end select-none touch-none tx80-perf-surface"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        const p = 1 - (e.clientY - rect.top) / rect.height;
        onChange(min + Math.max(0, Math.min(1, p)) * (max - min));
      }}
      onPointerMove={(e) => {
        if (!(e.buttons & 1) && e.pointerType !== "touch") return;
        if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const p = 1 - (e.clientY - rect.top) / rect.height;
        onChange(min + Math.max(0, Math.min(1, p)) * (max - min));
      }}
      onPointerUp={(e) => {
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        if (onRelease) onRelease();
      }}
      onPointerCancel={() => onRelease?.()}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div
        className="absolute left-1 right-1 rounded-sm bg-[color:var(--phosphor)] shadow-[0_0_8px_var(--phosphor-dim)]"
        style={{
          height: centered ? "3px" : `${pct}%`,
          bottom: centered ? `calc(${pct}% - 1.5px)` : 0,
        }}
      />
    </div>
  );
}
