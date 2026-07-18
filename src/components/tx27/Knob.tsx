import { useCallback, useEffect, useRef } from "react";

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  size?: number;
  accent?: string;
  /** "log" maps knob position exponentially (equal rotation = equal musical
   *  interval) — right for frequency-type params like filter cutoff, where a
   *  linear taper crams everything audible into the first fraction of travel.
   *  Requires min > 0; falls back to linear otherwise. Default "linear". */
  taper?: "linear" | "log";
}

export function Knob({
  label,
  value,
  min,
  max,
  step = 0.001,
  onChange,
  format,
  size = 52,
  accent = "var(--tx-accent)",
  taper = "linear",
}: KnobProps) {
  const ref = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startV = useRef(0);
  // One owning pointerId per knob instance; null when idle.
  const draggingPointerId = useRef<number | null>(null);

  const range = max - min;
  const isLog = taper === "log" && min > 0;
  // Position (0..1) ↔ value mapping; all drag math runs in position space so
  // log knobs feel uniform across their whole travel.
  const norm = Math.max(
    0,
    Math.min(
      1,
      isLog
        ? Math.log(Math.max(min, value) / min) / Math.log(max / min)
        : (value - min) / range,
    ),
  );
  const angle = -135 + norm * 270;

  // Keep a ref to the latest onChange so the always-on effect closure never
  // captures a stale version without re-registering listeners each render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const endDrag = (pointerId: number) => {
    if (pointerId !== draggingPointerId.current) return;
    draggingPointerId.current = null;
  };

  // Always-on global pointer listeners — gated by pointerId ownership.
  // Only the pointer that set draggingPointerId drives the knob; all others
  // are ignored, enabling simultaneous independent use of multiple knobs and
  // the keyboard without cross-talk.
  useEffect(() => {
    const logDrag = taper === "log" && min > 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== draggingPointerId.current) return;
      const dy = startY.current - e.clientY;
      const scale = e.shiftKey ? 400 : 150;
      let next: number;
      if (logDrag) {
        const startPos =
          Math.log(Math.max(min, startV.current) / min) / Math.log(max / min);
        const pos = Math.max(0, Math.min(1, startPos + dy / scale));
        next = min * Math.pow(max / min, pos);
      } else {
        next = startV.current + (dy / scale) * range;
      }
      if (step) next = Math.round(next / step) * step;
      next = Math.max(min, Math.min(max, next));
      onChangeRef.current(next);
    };
    const onUp = (e: PointerEvent) => endDrag(e.pointerId);
    const onCancel = (e: PointerEvent) => endDrag(e.pointerId);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [min, max, range, step, taper]); // onChange accessed via ref; dragging via ref

  // Release drag on window blur or document hidden (system gesture, app-switch)
  useEffect(() => {
    const cancel = () => { draggingPointerId.current = null; };
    const onVisibility = () => { if (document.hidden) cancel(); };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      // Capture on the knob element so pointermove/up are always delivered
      // to this element regardless of where the pointer travels.
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingPointerId.current = e.pointerId;
      startY.current = e.clientY;
      startV.current = value;
    },
    [value],
  );

  const onDouble = () => {
    // Reset to mid-travel: arithmetic midpoint for linear knobs, geometric
    // midpoint for log knobs (e.g. cutoff 80–18k → ~1.2 kHz, the musical middle).
    let mid = isLog ? min * Math.pow(max / min, 0.5) : min + range / 2;
    if (step) mid = Math.round(mid / step) * step;
    onChange(Math.max(min, Math.min(max, mid)));
  };

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onLostPointerCapture={(e) => {
          // Browser revoked capture (system gesture, incoming call overlay, etc.)
          endDrag(e.pointerId);
        }}
        onDoubleClick={onDouble}
        className="relative touch-none"
        style={{ width: size, height: size }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, #3a3a38, #1a1a19 70%, #0a0a09)",
            boxShadow:
              "inset 0 -2px 4px rgba(0,0,0,0.6), inset 0 2px 2px rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.4)",
          }}
        />
        <div
          className="absolute inset-2 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, #2a2a28, #111110)",
            transform: `rotate(${angle}deg)`,
          }}
        >
          <div
            className="absolute left-1/2 top-1 h-[35%] w-[2px] -translate-x-1/2 rounded-full"
            style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
          />
        </div>
      </div>
      <div className="text-[9px] uppercase tracking-wider text-tx-muted leading-tight text-center">
        {label}
      </div>
      <div className="text-[10px] font-mono text-tx-lcd leading-none">
        {format ? format(value) : value.toFixed(2)}
      </div>
    </div>
  );
}
