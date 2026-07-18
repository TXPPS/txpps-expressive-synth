import { useEffect, useRef } from "react";

interface PerfStripProps {
  label: string;
  value: number; // -1..1 for pitch, 0..1 for mod
  onChange: (v: number) => void;
  onRelease?: () => void;
  bipolar?: boolean;
  accent?: string;
  /** Horizontal orientation: drag along X, min at the left, max at the
   *  right (bipolar center = zero in the middle). Default is vertical. */
  horizontal?: boolean;
}

export function PerfStrip({
  label,
  value,
  onChange,
  onRelease,
  bipolar = false,
  accent = "var(--tx-accent)",
  horizontal = false,
}: PerfStripProps) {
  const ref = useRef<HTMLDivElement>(null);
  // One owning pointerId per component instance; null when idle.
  const draggingPointerId = useRef<number | null>(null);

  const min = bipolar ? -1 : 0;
  const max = 1;
  const norm = (value - min) / (max - min);

  // Keep a ref to the latest callbacks so the always-on effect closure never
  // goes stale without needing to re-register listeners on every render.
  const onChangeRef = useRef(onChange);
  const onReleaseRef = useRef(onRelease);
  onChangeRef.current = onChange;
  onReleaseRef.current = onRelease;

  const computeValue = (clientX: number, clientY: number): number => {
    const el = ref.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const pct = horizontal
      ? (clientX - rect.left) / rect.width
      : 1 - (clientY - rect.top) / rect.height;
    const clamped = Math.max(0, Math.min(1, pct));
    return min + clamped * (max - min);
  };

  const endDrag = (pointerId: number) => {
    if (pointerId !== draggingPointerId.current) return;
    draggingPointerId.current = null;
    if (bipolar && onReleaseRef.current) onReleaseRef.current();
  };

  // Always-on global pointer listeners — gated by pointerId ownership.
  // Registering once avoids the re-register cycle that the old dragging-state
  // approach required and prevents any leak when dragging is interrupted.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== draggingPointerId.current) return;
      onChangeRef.current(computeValue(e.clientX, e.clientY));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — callbacks accessed via refs

  // Release drag on window blur or document hidden (system gesture, app-switch, etc.)
  useEffect(() => {
    const cancel = () => {
      if (draggingPointerId.current !== null) {
        draggingPointerId.current = null;
        if (bipolar && onReleaseRef.current) onReleaseRef.current();
      }
    };
    const onVisibility = () => { if (document.hidden) cancel(); };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [bipolar]);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.preventDefault();
        // Capture on the strip element so pointermove/up route here reliably.
        e.currentTarget.setPointerCapture(e.pointerId);
        draggingPointerId.current = e.pointerId;
        onChangeRef.current(computeValue(e.clientX, e.clientY));
      }}
      onLostPointerCapture={(e) => {
        // Browser revoked capture (system gesture, incoming call overlay, etc.)
        endDrag(e.pointerId);
      }}
      className={`relative flex items-center rounded-md touch-none select-none ${
        horizontal ? "flex-row justify-start" : "flex-col justify-end"
      }`}
      style={{
        background: "linear-gradient(180deg, #1a1a17 0%, #0d0d0b 100%)",
        border: "1px solid #2a2a26",
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
        width: "100%",
        height: "100%",
      }}
    >
      {horizontal ? (
        <div
          className="absolute top-1 bottom-1 rounded-sm"
          style={{
            left: `${norm * 100}%`,
            width: "3px",
            background: accent,
            boxShadow: `0 0 8px ${accent}`,
            transform: "translateX(-50%)",
          }}
        />
      ) : (
        <div
          className="absolute left-1 right-1 rounded-sm"
          style={{
            bottom: `${norm * 100}%`,
            height: "3px",
            background: accent,
            boxShadow: `0 0 8px ${accent}`,
            transform: "translateY(50%)",
          }}
        />
      )}
      <div
        className={`absolute text-[8px] uppercase tracking-widest text-tx-muted ${
          horizontal ? "left-2 top-1/2 -translate-y-1/2" : "bottom-1"
        }`}
      >
        {label}
      </div>
    </div>
  );
}
