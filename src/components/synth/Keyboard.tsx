import { useMemo, useRef, useState, useEffect } from "react";
import { useSynthStore } from "@/state/store";
import { patchRuntimeDiag } from "@/lib/diagnostics/runtime";
import { diagInfo } from "@/lib/diagnostics/buffer";

/**
 * TXPPS on-screen keyboard — multitouch ownership preserved.
 * Side octave/sustain controls are optional so PerformanceDock can rearrange.
 */

interface Props {
  onNoteOn?: (midi: number, velocity: number) => void;
  onNoteOff?: (midi: number) => void;
  /** When false, only the key bed is rendered (dock owns octave/sustain). */
  showSideControls?: boolean;
  /** Preferred minimum white-key CSS width; drives visible range. */
  minKeyWidth?: number;
  /** Explicit white-key count override (takes precedence over auto). */
  whiteKeyCount?: number;
  /** Height class for the key bed */
  heightClass?: string;
  className?: string;
}

const WHITE_INDICES = [0, 2, 4, 5, 7, 9, 11];
const BLACK_INDICES = [1, 3, 6, 8, 10];

function isBlack(midi: number) {
  return BLACK_INDICES.includes(midi % 12);
}

export function Keyboard({
  onNoteOn,
  onNoteOff,
  showSideControls = true,
  minKeyWidth = 24,
  whiteKeyCount,
  heightClass = "h-28 sm:h-36 md:h-40",
  className = "",
}: Props) {
  const panicToken = useSynthStore((s) => s.panicToken);
  const sustainPedal = useSynthStore((s) => s.sustainPedal);
  const setSustainPedal = useSynthStore((s) => s.setSustainPedal);
  const octave = useSynthStore((s) => s.keyboardOctave);
  const setKeyboardOctave = useSynthStore((s) => s.setKeyboardOctave);
  const [autoWhiteCount, setAutoWhiteCount] = useState(14);
  const pointerNotes = useRef<Map<number, number>>(new Map());
  const [active, setActive] = useState<Set<number>>(new Set());
  const bedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    patchRuntimeDiag({ octave });
  }, [octave]);

  useEffect(() => {
    const compute = () => {
      const bed = bedRef.current;
      const w = bed?.clientWidth || window.innerWidth;
      const h = window.innerHeight;
      const landscape = window.innerWidth > h;
      const byMin = Math.max(7, Math.floor(w / Math.max(minKeyWidth, 18)));
      let fallback: number;
      if (w < 480) fallback = landscape ? 14 : 10;
      else if (w < 900) fallback = landscape ? 21 : 14;
      else if (w < 1400) fallback = 21;
      else fallback = 28;
      setAutoWhiteCount(Math.min(byMin, fallback));
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    const el = bedRef.current;
    const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(compute) : null;
    if (el && ro) ro.observe(el);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
      ro?.disconnect();
    };
  }, [minKeyWidth]);

  useEffect(() => {
    const onOrient = () => {
      for (const midi of pointerNotes.current.values()) onNoteOff?.(midi);
      pointerNotes.current.clear();
      setActive(new Set());
      patchRuntimeDiag({ keyboardOwners: 0 });
      diagInfo("INPUT", "keyboard orientation cleanup");
    };
    window.addEventListener("orientationchange", onOrient);
    return () => window.removeEventListener("orientationchange", onOrient);
  }, [onNoteOff]);

  const whiteCount = whiteKeyCount ?? autoWhiteCount;

  const notes = useMemo(() => {
    const out: number[] = [];
    let white = 0;
    let midi = octave * 12;
    while (white < whiteCount) {
      out.push(midi);
      if (WHITE_INDICES.includes(midi % 12)) white++;
      midi++;
      if (midi > 127) break;
    }
    return out;
  }, [octave, whiteCount]);

  const syncOwners = () => {
    patchRuntimeDiag({ keyboardOwners: pointerNotes.current.size });
  };

  const trigger = (midi: number, pointerId: number) => {
    const prev = pointerNotes.current.get(pointerId);
    if (prev === midi) return;
    if (prev !== undefined) {
      onNoteOff?.(prev);
      setActive((s) => {
        const n = new Set(s);
        n.delete(prev);
        return n;
      });
    }
    pointerNotes.current.set(pointerId, midi);
    syncOwners();
    onNoteOn?.(midi, 0.8);
    setActive((s) => new Set(s).add(midi));
  };

  const release = (pointerId: number) => {
    const midi = pointerNotes.current.get(pointerId);
    if (midi === undefined) return;
    pointerNotes.current.delete(pointerId);
    syncOwners();
    onNoteOff?.(midi);
    setActive((s) => {
      const n = new Set(s);
      n.delete(midi);
      return n;
    });
  };

  useEffect(() => {
    if (panicToken === 0) return;
    for (const midi of pointerNotes.current.values()) onNoteOff?.(midi);
    pointerNotes.current.clear();
    syncOwners();
    setActive(new Set());
    diagInfo("INPUT", "keyboard panic clear");
  }, [panicToken, onNoteOff]);

  const findNoteFromPoint = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const midiStr =
      el.getAttribute("data-midi") ?? el.closest("[data-midi]")?.getAttribute("data-midi");
    return midiStr ? parseInt(midiStr, 10) : null;
  };

  const whites = notes.filter((n) => !isBlack(n));

  const sideControls = (
    <div className="flex flex-col gap-1 shrink-0 w-14 sm:w-16">
      <button
        type="button"
        onClick={() => setKeyboardOctave(Math.min(8, octave + 1))}
        className="panel-sunken silkscreen-strong px-2 py-1 rounded text-[0.6rem] min-h-11"
        aria-label="Octave up"
      >
        OCT +
      </button>
      <button
        type="button"
        onClick={() => setKeyboardOctave(Math.max(0, octave - 1))}
        className="panel-sunken silkscreen-strong px-2 py-1 rounded text-[0.6rem] min-h-11"
        aria-label="Octave down"
      >
        OCT -
      </button>
      <div
        className="panel-sunken silkscreen-strong px-2 py-1 rounded text-[0.6rem] text-[color:var(--phosphor)] text-center"
        aria-live="polite"
      >
        C{octave}
      </div>
      <button
        type="button"
        onClick={() => setSustainPedal(!sustainPedal)}
        className={`mt-auto panel-sunken silkscreen-strong flex-1 min-h-[2.75rem] sm:min-h-[3.25rem] rounded-md text-[0.7rem] sm:text-xs tracking-wide border ${
          sustainPedal
            ? "text-[color:var(--phosphor)] border-[color:var(--phosphor)] shadow-[0_0_12px_-2px_var(--phosphor-dim)]"
            : "text-[color:var(--silkscreen)] border-[color:var(--hairline-strong)]"
        }`}
        aria-pressed={sustainPedal}
        aria-label="Sustain"
      >
        SUSTAIN
      </button>
    </div>
  );

  const keyBed = (
    <div
      ref={bedRef}
      className={`tx80-perf-surface relative flex-1 min-w-0 ${heightClass} rounded-md overflow-hidden select-none touch-none bg-[color:var(--panel-sunken)]`}
      style={{ WebkitUserSelect: "none" }}
      data-tx80-keyboard="true"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const m = findNoteFromPoint(e.clientX, e.clientY);
        if (m !== null) trigger(m, e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
        const m = findNoteFromPoint(e.clientX, e.clientY);
        if (m !== null) trigger(m, e.pointerId);
      }}
      onPointerUp={(e) => {
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
        release(e.pointerId);
      }}
      onPointerCancel={(e) => release(e.pointerId)}
      onLostPointerCapture={(e) => release(e.pointerId)}
    >
      <div className="absolute inset-0 flex">
        {whites.map((midi) => (
          <div
            key={midi}
            data-midi={midi}
            className={`flex-1 border-r border-[color:var(--hairline)] last:border-r-0 bg-[color:var(--key-white)] flex items-end justify-center pb-1 ${
              active.has(midi) ? "brightness-90 bg-[color:var(--phosphor-dim)]" : ""
            }`}
            style={{ boxShadow: "inset 0 -8px 8px -6px rgba(0,0,0,0.45)" }}
          >
            {midi % 12 === 0 && (
              <span className="text-[0.6rem] font-mono text-[color:var(--panel-sunken)]/70">
                C{Math.floor(midi / 12) - 1}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex pointer-events-none">
        {whites.map((wMidi, i) => {
          const nextIsBlack = isBlack(wMidi + 1);
          return (
            <div key={`b-${wMidi}`} className="flex-1 relative">
              {nextIsBlack && i < whites.length - 1 && (
                <div
                  data-midi={wMidi + 1}
                  className={`pointer-events-auto absolute top-0 right-[-30%] w-[60%] h-[62%] rounded-b-md ${
                    active.has(wMidi + 1)
                      ? "bg-[color:var(--phosphor-dim)]"
                      : "bg-[color:var(--key-black)]"
                  }`}
                  style={{
                    boxShadow:
                      "0 4px 6px -2px rgba(0,0,0,0.6), inset 0 -3px 2px -1px rgba(255,255,255,0.05)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`flex items-stretch gap-2 min-w-0 ${className}`} data-tx80-keyboard-root="true">
      {showSideControls && sideControls}
      {keyBed}
    </div>
  );
}

/** Compact octave / sustain column for PerformanceDock layouts. */
export function OctaveSustainColumn({
  className = "",
  horizontal = false,
}: {
  className?: string;
  horizontal?: boolean;
}) {
  const sustainPedal = useSynthStore((s) => s.sustainPedal);
  const setSustainPedal = useSynthStore((s) => s.setSustainPedal);
  const octave = useSynthStore((s) => s.keyboardOctave);
  const setKeyboardOctave = useSynthStore((s) => s.setKeyboardOctave);

  const sustainCls = `panel-sunken silkscreen-strong min-h-11 rounded-md text-[0.6rem] tracking-wide border ${
    sustainPedal
      ? "text-[color:var(--phosphor)] border-[color:var(--phosphor)]"
      : "text-[color:var(--silkscreen)] border-[color:var(--hairline-strong)]"
  }`;

  if (horizontal) {
    return (
      <div className={`flex gap-1 items-stretch shrink-0 ${className}`} style={{ height: 44 }}>
        <button
          type="button"
          onClick={() => setKeyboardOctave(Math.max(0, octave - 1))}
          className="panel-sunken silkscreen-strong flex-1 px-1 rounded text-[0.55rem] min-h-11"
          aria-label="Octave down"
        >
          OCT −
        </button>
        <div className="panel-sunken silkscreen-strong px-2 rounded text-[0.55rem] text-[color:var(--phosphor)] flex items-center">
          C{octave}
        </div>
        <button
          type="button"
          onClick={() => setKeyboardOctave(Math.min(8, octave + 1))}
          className="panel-sunken silkscreen-strong flex-1 px-1 rounded text-[0.55rem] min-h-11"
          aria-label="Octave up"
        >
          OCT +
        </button>
        <button
          type="button"
          onClick={() => setSustainPedal(!sustainPedal)}
          className={`${sustainCls} flex-1 px-2`}
          aria-pressed={sustainPedal}
          aria-label="Sustain"
        >
          SUSTAIN
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 shrink-0 w-[3.25rem] sm:w-16 ${className}`}>
      <button
        type="button"
        onClick={() => setKeyboardOctave(Math.min(8, octave + 1))}
        className="panel-sunken silkscreen-strong px-1 py-1 rounded text-[0.55rem] min-h-11"
        aria-label="Octave up"
      >
        OCT +
      </button>
      <button
        type="button"
        onClick={() => setKeyboardOctave(Math.max(0, octave - 1))}
        className="panel-sunken silkscreen-strong px-1 py-1 rounded text-[0.55rem] min-h-11"
        aria-label="Octave down"
      >
        OCT -
      </button>
      <div className="panel-sunken silkscreen-strong px-1 py-1 rounded text-[0.55rem] text-[color:var(--phosphor)] text-center">
        C{octave}
      </div>
      <button
        type="button"
        onClick={() => setSustainPedal(!sustainPedal)}
        className={`mt-auto ${sustainCls} flex-1`}
        aria-pressed={sustainPedal}
        aria-label="Sustain"
      >
        SUSTAIN
      </button>
    </div>
  );
}
