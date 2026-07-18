import { useEffect, useRef, useState } from "react";

interface RibbonProps {
  /** Report normalized position −1..1 relative to the first touch point. */
  onMove: (norm: number) => void;
  /** Pointer lifted / cancelled — engine decides spring-back vs hold. */
  onRelease: () => void;
  /** Display label, e.g. mode + range. */
  label: string;
  /** Stepped visual mode (glissando) renders semitone cells. */
  stepped?: boolean;
  /** ± semitone range (visual only — engine owns the audible mapping). */
  range: number;
}

/** TX-80 ribbon controller.
 *
 *  · Pointer capture on the strip; ONE owning pointer (first wins — a second
 *    simultaneous touch is ignored until the first lifts).
 *  · The first touch is the reference origin: bending is RELATIVE to where
 *    the finger lands, so touching never jumps the pitch.
 *  · Dragging past the visual bounds clamps to ±1 and keeps tracking.
 *  · pointerup / pointercancel / lostpointercapture / blur / hidden all
 *    release, so no gesture can leave a stale offset behind.
 */
export function Ribbon({ onMove, onRelease, label, stepped = false, range }: RibbonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const owningPointer = useRef<number | null>(null);
  const originX = useRef(0);
  const [visual, setVisual] = useState<number | null>(null); // −1..1 or idle
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef(0);

  const onMoveRef = useRef(onMove);
  const onReleaseRef = useRef(onRelease);
  onMoveRef.current = onMove;
  onReleaseRef.current = onRelease;

  const publish = (norm: number) => {
    onMoveRef.current(norm);
    pendingRef.current = norm;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        setVisual(pendingRef.current);
        rafRef.current = null;
      });
    }
  };

  const computeNorm = (clientX: number): number => {
    const el = ref.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const half = Math.max(1, rect.width / 2);
    return Math.max(-1, Math.min(1, (clientX - originX.current) / half));
  };

  const endDrag = (pointerId: number | null) => {
    if (pointerId !== null && pointerId !== owningPointer.current) return;
    if (owningPointer.current === null) return;
    owningPointer.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setVisual(null);
    onReleaseRef.current();
  };

  // Global listeners gated by pointer ownership (same pattern as PerfStrip).
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== owningPointer.current) return;
      publish(computeNorm(e.clientX));
    };
    const onUp = (e: PointerEvent) => endDrag(e.pointerId);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  // Release on blur / hidden (system gesture, call overlay, rotation quirks).
  useEffect(() => {
    const cancel = () => endDrag(owningPointer.current);
    const onVisibility = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const cells = stepped ? Math.min(24, range) * 2 : 0;

  return (
    <div
      ref={ref}
      data-testid="tx80-ribbon"
      onPointerDown={(e) => {
        if (owningPointer.current !== null) return; // one owner at a time
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        owningPointer.current = e.pointerId;
        originX.current = e.clientX;
        publish(0);
      }}
      onLostPointerCapture={(e) => endDrag(e.pointerId)}
      className="relative h-full w-full touch-none select-none rounded-md overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #171512 0%, #0b0a08 100%)",
        border: "1px solid #2e2b27",
        boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6)",
      }}
    >
      {/* Stepped-mode semitone cells */}
      {stepped && (
        <div className="absolute inset-0 flex pointer-events-none">
          {Array.from({ length: cells }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-white/5" />
          ))}
        </div>
      )}
      {/* Centre line */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{ left: "50%", width: 1, background: "rgba(255,255,255,0.14)" }}
      />
      {/* Active position marker (relative to origin, drawn from centre) */}
      {visual !== null && (
        <div
          className="absolute top-1 bottom-1 pointer-events-none rounded-sm"
          style={{
            left: `${50 + visual * 50}%`,
            width: 4,
            transform: "translateX(-50%)",
            background: "var(--tx-accent)",
            boxShadow: "0 0 10px var(--tx-accent)",
          }}
        />
      )}
      {visual !== null && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none opacity-30"
          style={{
            left: visual >= 0 ? "50%" : `${50 + visual * 50}%`,
            width: `${Math.abs(visual) * 50}%`,
            background: "var(--tx-accent-dim)",
          }}
        />
      )}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] uppercase tracking-[0.25em] text-tx-muted pointer-events-none">
        {label}
      </div>
    </div>
  );
}
