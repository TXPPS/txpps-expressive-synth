import { useRef, useState } from "react";
import { useSynthStore } from "@/state/store";

interface Props {
  onPosition?: (norm: number) => void;
  onRelease?: () => void;
}

/**
 * TXPPS Ribbon controller.
 *
 * Position is normalized −1..1 relative to the first touch (engine contract).
 * Visual indicator tracks absolute finger X for immediate feedback.
 * Primary pointer owns the gesture; additional touches are ignored until release.
 */
export function Ribbon({ onPosition, onRelease }: Props) {
  const [pos, setPos] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const mode = useSynthStore((s) => s.patch["ribbon.mode"] as string);
  const primaryId = useRef<number | null>(null);
  const originX = useRef(0);

  const toEngineNorm = (clientX: number, width: number) => {
    // Half-ribbon travel = full range (±1). Smooth, no jump from first touch.
    const delta = clientX - originX.current;
    const half = Math.max(width * 0.5, 1);
    return Math.max(-1, Math.min(1, delta / half));
  };

  const toVisual = (clientX: number, left: number, width: number) =>
    Math.max(0, Math.min(1, (clientX - left) / width));

  const update = (e: React.PointerEvent<HTMLDivElement>) => {
    if (primaryId.current !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setPos(toVisual(e.clientX, rect.left, rect.width));
    onPosition?.(toEngineNorm(e.clientX, rect.width));
  };

  const release = (e: React.PointerEvent<HTMLDivElement>) => {
    if (primaryId.current !== e.pointerId) return;
    primaryId.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    setPos(null);
    onRelease?.();
  };

  const modeLabel =
    mode === "continuous" ? "PITCH" : String(mode).toUpperCase();

  return (
    <div
      ref={ref}
      className="relative w-full h-8 sm:h-10 rounded-md bg-[color:var(--ribbon)] border border-[color:var(--hairline-strong)] overflow-hidden select-none touch-none"
      onPointerDown={(e) => {
        if (primaryId.current !== null) return;
        primaryId.current = e.pointerId;
        originX.current = e.clientX;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        setPos(toVisual(e.clientX, rect.left, rect.width));
        onPosition?.(0); // first touch = center (no jump)
      }}
      onPointerMove={update}
      onPointerUp={release}
      onPointerCancel={release}
      role="slider"
      aria-label="Ribbon controller"
      aria-valuemin={-1}
      aria-valuemax={1}
    >
      <div className="absolute inset-y-0 left-1/2 w-px bg-[color:var(--hairline-strong)]" aria-hidden />
      {[0.25, 0.75].map((f) => (
        <div
          key={f}
          className="absolute inset-y-2 w-px bg-[color:var(--hairline)]"
          style={{ left: `${f * 100}%` }}
          aria-hidden
        />
      ))}
      {pos !== null && (
        <div
          className="absolute top-1 bottom-1 w-1 rounded-sm bg-[color:var(--phosphor)] shadow-[0_0_10px_var(--phosphor-dim)]"
          style={{ left: `calc(${pos * 100}% - 2px)` }}
        />
      )}
      <span className="silkscreen absolute left-2 top-1 text-[0.55rem]">RIBBON</span>
      <span className="silkscreen absolute right-2 top-1 text-[0.55rem] text-[color:var(--phosphor)]">
        {modeLabel}
      </span>
    </div>
  );
}
