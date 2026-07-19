import { useSynthStore } from "@/state/store";
import { useRef, type ReactNode } from "react";

/**
 * Pitch / mod performance controls.
 * Vertical strips fill the dock column height (TX27 landscape proportion).
 * Horizontal remains available for compact bars when explicitly requested.
 */
export function PerformanceStrip({
  orientation = "vertical",
  className = "",
  fillHeight = false,
}: {
  orientation?: "vertical" | "horizontal";
  className?: string;
  /** When true, vertical wheels stretch to 100% of parent height. */
  fillHeight?: boolean;
}) {
  const { pitchBend, modWheel, setPitchBend, setModWheel } = useSynthStore();

  if (orientation === "horizontal") {
    return (
      <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
        <HorizontalStrip
          label="PITCH"
          value={pitchBend}
          min={-1}
          max={1}
          centered
          onChange={setPitchBend}
          onRelease={() => setPitchBend(0)}
        />
        <HorizontalStrip label="MOD" value={modWheel} min={0} max={1} onChange={setModWheel} />
      </div>
    );
  }

  const wheelH = fillHeight
    ? "h-full min-h-[8rem] sm:min-h-[10rem]"
    : "h-[7.5rem] sm:h-[10.5rem] md:h-[12rem]";

  return (
    <div
      data-tx80-perf-wheels="vertical"
      className={`flex gap-2 sm:gap-3 items-stretch shrink-0 ${fillHeight ? "h-full self-stretch" : "items-end"} ${className}`}
    >
      <WheelColumn label="PITCH" fill={fillHeight}>
        <VerticalStrip
          label="PITCH"
          value={pitchBend}
          min={-1}
          max={1}
          centered
          heightClass={wheelH}
          onChange={setPitchBend}
          onRelease={() => setPitchBend(0)}
        />
      </WheelColumn>
      <WheelColumn label="MOD" fill={fillHeight}>
        <VerticalStrip
          label="MOD"
          value={modWheel}
          min={0}
          max={1}
          heightClass={wheelH}
          onChange={setModWheel}
        />
      </WheelColumn>
    </div>
  );
}

function WheelColumn({
  label,
  children,
  fill,
}: {
  label: string;
  children: ReactNode;
  fill?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-1 ${fill ? "h-full min-h-0" : ""}`}>
      <div className={fill ? "flex-1 min-h-0 w-full flex" : ""}>{children}</div>
      <span className="silkscreen text-[0.55rem] sm:text-[0.6rem] tracking-wide text-center w-full shrink-0">
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
  heightClass,
  onChange,
  onRelease,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  centered?: boolean;
  heightClass: string;
  onChange: (v: number) => void;
  onRelease?: () => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div
      data-tx80-wheel={label.toLowerCase()}
      className={`panel-sunken relative w-10 sm:w-12 ${heightClass} rounded-md flex flex-col items-center justify-end select-none touch-none tx80-perf-surface`}
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
        onRelease?.();
      }}
      onPointerCancel={() => onRelease?.()}
      onLostPointerCapture={() => onRelease?.()}
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

function HorizontalStrip({
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
    <div className="flex items-center gap-2 min-w-0">
      <span className="silkscreen text-[0.55rem] w-10 shrink-0">{label}</span>
      <div
        ref={ref}
        data-tx80-wheel={label.toLowerCase()}
        className="panel-sunken relative flex-1 min-w-0 h-11 rounded-md select-none touch-none tx80-perf-surface"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const rect = e.currentTarget.getBoundingClientRect();
          const p = (e.clientX - rect.left) / rect.width;
          onChange(min + Math.max(0, Math.min(1, p)) * (max - min));
        }}
        onPointerMove={(e) => {
          if (!(e.buttons & 1) && e.pointerType !== "touch") return;
          if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const p = (e.clientX - rect.left) / rect.width;
          onChange(min + Math.max(0, Math.min(1, p)) * (max - min));
        }}
        onPointerUp={(e) => {
          try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          } catch {
            /* already released */
          }
          onRelease?.();
        }}
        onPointerCancel={() => onRelease?.()}
        onLostPointerCapture={() => onRelease?.()}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div
          className="absolute top-1 bottom-1 rounded-sm bg-[color:var(--phosphor)] shadow-[0_0_8px_var(--phosphor-dim)]"
          style={{
            width: centered ? "3px" : `${pct}%`,
            left: centered ? `calc(${pct}% - 1.5px)` : 0,
          }}
        />
      </div>
    </div>
  );
}
