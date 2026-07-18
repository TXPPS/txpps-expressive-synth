import { useSynthStore } from "@/state/store";
import { useRef } from "react";

/**
 * Vertical pitch and mod strips + sustain button.
 * M1: pointer-driven UI wired to real transient store state.
 * M2/M4: engine reads these values for pitch bend / mod / sustain.
 */
export function PerformanceStrip() {
  const { pitchBend, modWheel, sustainPedal, setPitchBend, setModWheel, setSustainPedal } = useSynthStore();
  return (
    <div className="flex sm:flex-col gap-2 items-stretch">
      <VerticalStrip
        label="PITCH"
        value={pitchBend}
        min={-1}
        max={1}
        centered
        onChange={setPitchBend}
        onRelease={() => setPitchBend(0)}
      />
      <VerticalStrip
        label="MOD"
        value={modWheel}
        min={0}
        max={1}
        onChange={setModWheel}
      />
      <button
        onClick={() => setSustainPedal(!sustainPedal)}
        className={`panel-sunken silkscreen-strong px-2 py-1 rounded text-[0.65rem] ${
          sustainPedal
            ? "text-[color:var(--phosphor)] border-[color:var(--phosphor)]"
            : "text-[color:var(--silkscreen-dim)]"
        }`}
        aria-pressed={sustainPedal}
      >
        SUS
      </button>
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
      className="panel-sunken relative w-8 sm:w-10 h-16 sm:h-24 rounded-md flex flex-col items-center justify-end select-none touch-none"
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
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
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
      <span className="silkscreen absolute -bottom-4 text-[0.55rem] left-1/2 -translate-x-1/2">
        {label}
      </span>
    </div>
  );
}
