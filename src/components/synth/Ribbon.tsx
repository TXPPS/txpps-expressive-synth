import { useEffect, useRef, useState } from "react";
import { useSynthStore } from "@/state/store";
import { diagInfo, diagWarn } from "@/lib/diagnostics/buffer";
import { getRuntimeDiagSnapshot, patchRuntimeDiag } from "@/lib/diagnostics/runtime";

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
  const [engineNorm, setEngineNorm] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const mode = useSynthStore((s) => s.patch["ribbon.mode"] as string);
  const range = useSynthStore((s) => s.patch["ribbon.range"] as number);
  const panicToken = useSynthStore((s) => s.panicToken);
  const primaryId = useRef<number | null>(null);
  const originX = useRef(0);
  const onReleaseRef = useRef(onRelease);
  onReleaseRef.current = onRelease;

  const clearOwnership = (reason: string) => {
    primaryId.current = null;
    setPos(null);
    setEngineNorm(null);
    patchRuntimeDiag({ ribbonOwned: false, ribbonValue: null });
    onReleaseRef.current?.();
    diagInfo("INPUT", `ribbon release (${reason})`);
  };

  useEffect(() => {
    if (panicToken === 0) return;
    if (primaryId.current !== null) {
      try {
        ref.current?.releasePointerCapture(primaryId.current);
      } catch {
        /* already released */
      }
    }
    clearOwnership("panic");
  }, [panicToken]);

  useEffect(() => {
    patchRuntimeDiag({ ribbonMode: mode, ribbonRange: Number(range) || 12 });
    if (primaryId.current !== null) {
      diagWarn("INPUT", "ribbon mode changed while owned — releasing");
      try {
        ref.current?.releasePointerCapture(primaryId.current);
      } catch {
        /* noop */
      }
      clearOwnership("mode-change");
    }
  }, [mode, range]);

  const toEngineNorm = (clientX: number, width: number) => {
    const delta = clientX - originX.current;
    const half = Math.max(width * 0.5, 1);
    return Math.max(-1, Math.min(1, delta / half));
  };

  const toVisual = (clientX: number, left: number, width: number) =>
    Math.max(0, Math.min(1, (clientX - left) / width));

  const update = (e: React.PointerEvent<HTMLDivElement>) => {
    if (primaryId.current !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const visual = toVisual(e.clientX, rect.left, rect.width);
    const norm = toEngineNorm(e.clientX, rect.width);
    setPos(visual);
    setEngineNorm(norm);
    patchRuntimeDiag({ ribbonValue: norm, ribbonOwned: true });
    onPosition?.(norm);
  };

  const release = (e: React.PointerEvent<HTMLDivElement>, reason: string) => {
    if (primaryId.current !== e.pointerId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    clearOwnership(reason);
  };

  const modeLabel = mode === "continuous" ? "PITCH" : String(mode).toUpperCase();

  return (
    <div
      ref={ref}
      className="tx80-perf-surface relative w-full h-8 sm:h-10 rounded-md bg-[color:var(--ribbon)] border border-[color:var(--hairline-strong)] overflow-hidden select-none"
      onPointerDown={(e) => {
        if (primaryId.current !== null) return;
        e.preventDefault();
        primaryId.current = e.pointerId;
        originX.current = e.clientX;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        setPos(toVisual(e.clientX, rect.left, rect.width));
        setEngineNorm(0);
        patchRuntimeDiag({ ribbonOwned: true, ribbonValue: 0, ribbonMode: mode });
        onPosition?.(0);
        diagInfo("INPUT", "ribbon capture", { mode, range });
      }}
      onPointerMove={update}
      onPointerUp={(e) => release(e, "pointerup")}
      onPointerCancel={(e) => {
        const snap = getRuntimeDiagSnapshot();
        patchRuntimeDiag({ pointerCancelCount: snap.pointerCancelCount + 1 });
        release(e, "pointercancel");
      }}
      onLostPointerCapture={(e) => {
        if (primaryId.current !== e.pointerId) return;
        const snap = getRuntimeDiagSnapshot();
        patchRuntimeDiag({ lostCaptureCount: snap.lostCaptureCount + 1 });
        clearOwnership("lostpointercapture");
      }}
      role="slider"
      aria-label="Ribbon controller"
      aria-valuemin={-1}
      aria-valuemax={1}
      aria-valuenow={engineNorm ?? 0}
      draggable={false}
    >
      <div
        className="absolute inset-y-0 left-1/2 w-px bg-[color:var(--hairline-strong)]"
        aria-hidden
      />
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
      <span className="silkscreen absolute left-2 top-1 text-[0.55rem] pointer-events-none">
        RIBBON
      </span>
      <span className="silkscreen absolute right-2 top-1 text-[0.55rem] text-[color:var(--phosphor)] pointer-events-none">
        {modeLabel}
        {engineNorm !== null ? ` ${engineNorm >= 0 ? "+" : ""}${engineNorm.toFixed(2)}` : ""}
      </span>
    </div>
  );
}
