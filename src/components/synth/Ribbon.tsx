import { useRef, useState } from "react";
import { useSynthStore } from "@/state/store";

/**
 * TXPPS Ribbon controller.
 *
 * M1: pointer-capture surface with visible tracking + mode readout. The
 * ribbon writes normalized position into transient state; M4 wires this to
 * the real portamento/glissando/trigger engine. Pointer-cancel and
 * pointer-leave both release cleanly so no stuck offsets can occur.
 */
export function Ribbon() {
  const [pos, setPos] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const mode = useSynthStore((s) => s.patch["ribbon.mode"] as string);

  const update = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setPos(x);
  };

  const release = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    // Return-to-center in continuous mode is the safe default.
    setPos(null);
  };

  return (
    <div
      ref={ref}
      className="relative w-full h-8 sm:h-10 rounded-md bg-[color:var(--ribbon)] border border-[color:var(--hairline-strong)] overflow-hidden select-none touch-none"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
        update(e);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      role="slider"
      aria-label="Ribbon controller"
    >
      <div className="absolute inset-y-0 left-1/2 w-px bg-[color:var(--hairline-strong)]" aria-hidden />
      {[0.25, 0.75].map((f) => (
        <div key={f} className="absolute inset-y-2 w-px bg-[color:var(--hairline)]" style={{ left: `${f * 100}%` }} aria-hidden />
      ))}
      {pos !== null && (
        <div
          className="absolute top-1 bottom-1 w-1 rounded-sm bg-[color:var(--phosphor)] shadow-[0_0_10px_var(--phosphor-dim)]"
          style={{ left: `calc(${pos * 100}% - 2px)` }}
        />
      )}
      <span className="silkscreen absolute left-2 top-1 text-[0.55rem]">RIBBON</span>
      <span className="silkscreen absolute right-2 top-1 text-[0.55rem] text-[color:var(--phosphor)]">
        {String(mode).toUpperCase()}
      </span>
    </div>
  );
}
