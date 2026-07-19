import { useSynthStore } from "@/state/store";
import type { ReactNode } from "react";

/**
 * Pitch / mod performance controls.
 * Fill-height vertical strips map the full column for precise travel.
 */

export function PerformanceStrip({
  orientation = "vertical",
  className = "",
  fillHeight = false,
}: {
  orientation?: "vertical" | "horizontal";
  className?: string;
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

  return (
    <div
      data-tx80-perf-wheels="vertical"
      className={`flex gap-2 sm:gap-3 shrink-0 ${fillHeight ? "h-full min-h-0 self-stretch items-stretch" : "items-end"} ${className}`}
    >
      <WheelColumn label="PITCH" fill={fillHeight}>
        <VerticalStrip
          label="PITCH"
          value={pitchBend}
          min={-1}
          max={1}
          centered
          fill={fillHeight}
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
          fill={fillHeight}
          onChange={setModWheel}
        />
      </WheelColumn>
    </div>
  );
}

/** Individual pitch column for CSS-grid dock layouts. */
export function PitchColumn({ className = "" }: { className?: string }) {
  const pitchBend = useSynthStore((s) => s.pitchBend);
  const setPitchBend = useSynthStore((s) => s.setPitchBend);
  return (
    <WheelColumn label="PITCH" fill className={className}>
      <VerticalStrip
        label="PITCH"
        value={pitchBend}
        min={-1}
        max={1}
        centered
        fill
        onChange={setPitchBend}
        onRelease={() => setPitchBend(0)}
      />
    </WheelColumn>
  );
}

/** Individual mod column for CSS-grid dock layouts. */
export function ModColumn({ className = "" }: { className?: string }) {
  const modWheel = useSynthStore((s) => s.modWheel);
  const setModWheel = useSynthStore((s) => s.setModWheel);
  return (
    <WheelColumn label="MOD" fill className={className}>
      <VerticalStrip label="MOD" value={modWheel} min={0} max={1} fill onChange={setModWheel} />
    </WheelColumn>
  );
}

function WheelColumn({
  label,
  children,
  fill,
  className = "",
}: {
  label: string;
  children: ReactNode;
  fill?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center min-h-0 ${fill ? "h-full gap-0" : "gap-1"} ${className}`}
      data-tx80-wheel-col={label.toLowerCase()}
    >
      {/*
        Fill mode: strip occupies the entire column (TX27). Label is painted
        inside the strip — never a separate row that pushes the track down or
        shortens pointer travel under the ribbon.
      */}
      <div className={`w-full min-h-0 ${fill ? "flex-1 relative h-full" : ""}`}>{children}</div>
      {!fill && (
        <span className="silkscreen text-[0.55rem] sm:text-[0.6rem] tracking-wide text-center w-full shrink-0">
          {label}
        </span>
      )}
    </div>
  );
}

function VerticalStrip({
  label,
  value,
  min,
  max,
  centered,
  fill,
  onChange,
  onRelease,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  centered?: boolean;
  fill?: boolean;
  onChange: (v: number) => void;
  onRelease?: () => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  const track = (
    <div
      data-tx80-wheel={label.toLowerCase()}
      className={`panel-sunken relative rounded-md flex flex-col items-center justify-end select-none touch-none tx80-perf-surface ${
        fill
          ? "h-full w-full min-h-0"
          : "w-10 sm:w-12 h-[7.5rem] sm:h-[10.5rem] md:h-[12rem]"
      }`}
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
      {fill && (
        <span
          className="silkscreen absolute bottom-1 left-0 right-0 text-center text-[0.5rem] sm:text-[0.55rem] tracking-wide pointer-events-none text-[color:var(--silkscreen-dim)]"
          aria-hidden
        >
          {label}
        </span>
      )}
    </div>
  );

  if (fill) {
    return (
      <div className="absolute inset-0 flex justify-center min-h-0" data-tx80-wheel-fill="true">
        <div className="h-full w-[var(--tx80-side-control-width,2.75rem)] max-w-full">{track}</div>
      </div>
    );
  }
  return track;
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
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="silkscreen text-[0.55rem] w-10 shrink-0">{label}</span>
      <div
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
