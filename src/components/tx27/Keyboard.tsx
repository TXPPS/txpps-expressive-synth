import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface KeyboardProps {
  octave: number;
  onNoteOn: (note: number, velocity: number) => void;
  onNoteOff: (note: number) => void;
  activeNotes: Set<number>;
  /** Minimum comfortable white-key width in px. The keyboard measures its
   *  own container (ResizeObserver) and shows the widest musically sensible
   *  range (7, 10 or 14 white keys) whose keys stay at or above this width.
   *  Defaults to 24 (desktop density). */
  minKeyWidth?: number;
}

const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
// White-key positions (within an octave) that have a black key to their right.
const HAS_BLACK_AFTER = new Set([0, 1, 3, 4, 5]);
// Musically sensible visible ranges, in white keys:
// 7 = one octave (C..B), 10 = C..E of the next octave, 14 = two octaves.
const RANGE_STEPS = [14, 10, 7] as const;

export function Keyboard({
  octave,
  onNoteOn,
  onNoteOff,
  activeNotes,
  minKeyWidth = 24,
}: KeyboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerNotes = useRef<Map<number, number>>(new Map());
  const [, force] = useState(0);
  const [whiteCount, setWhiteCount] = useState<number>(14);

  const startNote = 12 * (octave + 1); // MIDI note for C

  // Latest onNoteOff without re-running release effects on identity changes.
  const onNoteOffRef = useRef(onNoteOff);
  onNoteOffRef.current = onNoteOff;

  const releaseAllPointerNotes = () => {
    for (const n of pointerNotes.current.values()) onNoteOffRef.current(n);
    pointerNotes.current.clear();
    force((v) => v + 1);
  };

  // ── Container-based sizing ──────────────────────────────────────────────
  // Measure the real container width (not window.innerWidth) and pick the
  // widest range whose white keys stay >= minKeyWidth.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      let count: number = RANGE_STEPS[RANGE_STEPS.length - 1];
      for (const c of RANGE_STEPS) {
        if (w / c >= minKeyWidth) {
          count = c;
          break;
        }
      }
      setWhiteCount(count);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minKeyWidth]);

  // Release pointer-owned notes whenever the visible range changes (octave
  // shift, resize, orientation change, workspace switch) so a key that moves
  // or disappears under a finger can never leave a stuck note.
  const prevRangeRef = useRef<{ start: number; count: number } | null>(null);
  useEffect(() => {
    const prev = prevRangeRef.current;
    if (prev && (prev.start !== startNote || prev.count !== whiteCount)) {
      releaseAllPointerNotes();
    }
    prevRangeRef.current = { start: startNote, count: whiteCount };
  }, [startNote, whiteCount]);

  // Release everything on visibility change / blur.
  useEffect(() => {
    const releaseAll = () => releaseAllPointerNotes();
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", releaseAll);
    return () => {
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", releaseAll);
    };
  }, []);

  // ── Key geometry ────────────────────────────────────────────────────────
  const whiteKeys: number[] = [];
  for (let wi = 0; wi < whiteCount; wi++) {
    whiteKeys.push(startNote + 12 * Math.floor(wi / 7) + WHITE_OFFSETS[wi % 7]);
  }
  const blackKeys: Array<{ note: number; leftPct: number }> = [];
  for (let wi = 0; wi < whiteCount - 1; wi++) {
    if (!HAS_BLACK_AFTER.has(wi % 7)) continue;
    blackKeys.push({
      note: whiteKeys[wi] + 1,
      leftPct: ((wi + 1) / whiteCount) * 100,
    });
  }

  // ── Pointer interaction (unchanged semantics) ───────────────────────────
  const noteAtPoint = (clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (!el) return null;
    const keyEl = el.closest("[data-note]") as HTMLElement | null;
    if (!keyEl) return null;
    return Number(keyEl.dataset.note);
  };

  const handleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const note = noteAtPoint(e.clientX, e.clientY);
    if (note == null) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointerNotes.current.set(e.pointerId, note);
    onNoteOn(note, 0.85);
    force((v) => v + 1);
  };
  const handleMove = (e: React.PointerEvent) => {
    if (!pointerNotes.current.has(e.pointerId)) return;
    e.preventDefault();
    const prev = pointerNotes.current.get(e.pointerId)!;
    const note = noteAtPoint(e.clientX, e.clientY);
    if (note != null && note !== prev) {
      onNoteOff(prev);
      pointerNotes.current.set(e.pointerId, note);
      onNoteOn(note, 0.85);
      force((v) => v + 1);
    }
  };
  const handleUp = (e: React.PointerEvent) => {
    const note = pointerNotes.current.get(e.pointerId);
    if (note != null) {
      onNoteOff(note);
      pointerNotes.current.delete(e.pointerId);
      force((v) => v + 1);
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onLostPointerCapture={handleUp}
      onPointerLeave={handleUp}
      className="relative w-full select-none touch-none"
      style={{ height: "100%" }}
    >
      <div className="relative flex h-full w-full">
        {whiteKeys.map((n) => {
          const active = activeNotes.has(n);
          return (
            <div
              key={n}
              data-note={n}
              className="flex-1 border-r border-black/40 rounded-b transition-colors"
              style={{
                background: active
                  ? "linear-gradient(180deg, #d9d3b8 0%, #b8b09a 100%)"
                  : "linear-gradient(180deg, #f4efd8 0%, #d8d2b6 100%)",
                boxShadow: active
                  ? "inset 0 4px 8px rgba(0,0,0,0.3)"
                  : "inset 0 -6px 8px rgba(0,0,0,0.15)",
              }}
            />
          );
        })}
      </div>
      {/* Black keys overlay */}
      <div className="pointer-events-none absolute inset-0">
        <div className="relative flex h-[60%] w-full">
          {blackKeys.map(({ note, leftPct }) => {
            const active = activeNotes.has(note);
            return (
              <div
                key={note}
                data-note={note}
                className="pointer-events-auto absolute -translate-x-1/2 rounded-b-md"
                style={{
                  left: `${leftPct}%`,
                  width: `${(100 / whiteCount) * 0.62}%`,
                  height: "100%",
                  background: active
                    ? "linear-gradient(180deg, #333 0%, #1a1a1a 100%)"
                    : "linear-gradient(180deg, #1a1a1a 0%, #050505 100%)",
                  boxShadow: active
                    ? "inset 0 4px 6px rgba(0,0,0,0.7)"
                    : "0 3px 4px rgba(0,0,0,0.5), inset 0 -4px 4px rgba(255,255,255,0.08)",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
