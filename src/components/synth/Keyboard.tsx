import { useMemo, useRef, useState, useEffect } from "react";
import { useSynthStore } from "@/state/store";
import { patchRuntimeDiag } from "@/lib/diagnostics/runtime";
import { diagInfo } from "@/lib/diagnostics/buffer";

/**
 * TXPPS on-screen keyboard.
 *
 * M1: visual playable keys with genuine multitouch pointer tracking (each
 * pointer ID tracks its own active note; release paths — pointerup, cancel,
 * leaving all keys — release the matching note). Note-on / note-off callbacks
 * currently only light the key + push into a "played" set. M2 wires
 * `onNoteOn` / `onNoteOff` to the audio engine's voice allocator.
 *
 * Adaptive range:
 *   phone portrait   → 1.5 octaves
 *   phone landscape  → 2.5 octaves
 *   tablet / desktop → 3-4 octaves
 * The user can shift with OCT- / OCT+ buttons.
 */

interface Props {
  onNoteOn?: (midi: number, velocity: number) => void;
  onNoteOff?: (midi: number) => void;
}

const WHITE_INDICES = [0, 2, 4, 5, 7, 9, 11];
const BLACK_INDICES = [1, 3, 6, 8, 10];

function isBlack(midi: number) {
  return BLACK_INDICES.includes(midi % 12);
}

export function Keyboard({ onNoteOn, onNoteOff }: Props) {
  const panicToken = useSynthStore((s) => s.panicToken);
  const sustainPedal = useSynthStore((s) => s.sustainPedal);
  const setSustainPedal = useSynthStore((s) => s.setSustainPedal);
  const [octave, setOctave] = useState(4); // starting C
  const [whiteCount, setWhiteCount] = useState(14);
  const pointerNotes = useRef<Map<number, number>>(new Map());
  const [active, setActive] = useState<Set<number>>(new Set());

  useEffect(() => {
    patchRuntimeDiag({ octave });
  }, [octave]);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const landscape = w > h;
      if (w < 480) setWhiteCount(landscape ? 14 : 10);
      else if (w < 900) setWhiteCount(landscape ? 21 : 14);
      else if (w < 1400) setWhiteCount(21);
      else setWhiteCount(28);
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);

  // Compute midi note list — whiteCount white keys starting at C(octave)
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

  // Panic → release all
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

  return (
    <div className="flex items-stretch gap-2 min-w-0">
      <div className="flex flex-col gap-1 shrink-0 w-14 sm:w-16">
        <button
          onClick={() => setOctave((o) => Math.min(8, o + 1))}
          className="panel-sunken silkscreen-strong px-2 py-1 rounded text-[0.6rem]"
          aria-label="Octave up"
        >
          OCT +
        </button>
        <button
          onClick={() => setOctave((o) => Math.max(0, o - 1))}
          className="panel-sunken silkscreen-strong px-2 py-1 rounded text-[0.6rem]"
          aria-label="Octave down"
        >
          OCT -
        </button>
        <div className="panel-sunken silkscreen-strong px-2 py-1 rounded text-[0.6rem] text-[color:var(--phosphor)] text-center">
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
      <div
        className="tx80-perf-surface relative flex-1 min-w-0 h-28 sm:h-36 md:h-40 rounded-md overflow-hidden select-none touch-none bg-[color:var(--panel-sunken)]"
        style={{ WebkitUserSelect: "none" }}
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
          } catch {}
          release(e.pointerId);
        }}
        onPointerCancel={(e) => release(e.pointerId)}
        onLostPointerCapture={(e) => release(e.pointerId)}
      >
        {/* White key row */}
        <div className="absolute inset-0 flex">
          {whites.map((midi) => (
            <div
              key={midi}
              data-midi={midi}
              className={`flex-1 border-r border-[color:var(--hairline)] last:border-r-0 bg-[color:var(--key-white)] flex items-end justify-center pb-1 ${
                active.has(midi) ? "brightness-90 bg-[color:var(--phosphor-dim)]" : ""
              }`}
              style={{
                boxShadow: "inset 0 -8px 8px -6px rgba(0,0,0,0.45)",
              }}
            >
              {midi % 12 === 0 && (
                <span className="text-[0.6rem] font-mono text-[color:var(--panel-sunken)]/70">
                  C{Math.floor(midi / 12) - 1}
                </span>
              )}
            </div>
          ))}
        </div>
        {/* Black key overlay */}
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
    </div>
  );
}
