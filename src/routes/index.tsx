import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard } from "@/components/tx27/Keyboard";
import { PerfStrip } from "@/components/tx27/PerfStrip";
import { TxSelect } from "@/components/tx27/TxSelect";
import { PatchConfirmDialog } from "@/components/tx27/patch-library/PatchConfirmDialog";
import { LayerPanel } from "@/components/tx80/LayerPanel";
import { ParamKnob } from "@/components/tx80/ParamKnob";
import { Ribbon } from "@/components/tx80/Ribbon";
import { Tx80SaveDialog, Tx80SetupDialog } from "@/components/tx80/Tx80Dialogs";
import { useTx80Presets } from "@/components/tx80/useTx80Presets";
import type { ParameterValue, SynthRuntimeStatus } from "@/lib/synth/contracts";
import { SynthRuntime } from "@/lib/synth/runtime";
import { Tx80Midi, type Tx80MidiStatus } from "@/lib/tx80/midi";
import { setTx80Parameter, setTx80Parameters } from "@/lib/tx80/parameters";
import { TX80_PRODUCT, TX80ProductEngine } from "@/lib/tx80/productAdapter";
import {
  loadTx80Settings,
  loadTx80UiMode,
  saveTx80Settings,
  saveTx80UiMode,
  TX80_DEFAULT_SETTINGS,
  type Tx80Settings,
  type Tx80UiMode,
} from "@/lib/tx80/storage";
import {
  initStartupDiagnostics,
  recordStartupError,
  recordStartupPhase,
} from "@/lib/startup-diagnostics";
import { cloneTx80Patch, TX80_INIT_PATCH, type Tx80Patch } from "@/lib/tx80/types";

// ── Audio initialization state machine (same discipline as TX27) ────────────
// idle       — ARMED: app fully loaded, audio not yet unlocked (normal launch
//              state under mobile autoplay policy — never an error).
// starting   — a user gesture initiated engine creation/resume (bounded)
// recovering — rebuilding after a dead engine (closed context) was disposed
// ready      — context genuinely running
// suspended  — context suspended/interrupted; the next gesture resumes it
// failed     — a gesture-started bounded attempt failed; RETRY UI is shown
type AudioInitState = "idle" | "starting" | "recovering" | "ready" | "suspended" | "failed";

const AUDIO_INIT_TIMEOUT_MS = 8000;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TXPPS TX-80 — Dual-Layer Performance Synthesizer" },
      {
        name: "description",
        content:
          "Play TXPPS TX-80 in the browser: two independent synthesis layers, ribbon controller, portamento and true glissando, dual LFOs, chorus, delay and reverb.",
      },
    ],
  }),
  component: TX80App,
});

// Computer keyboard mapping (2 octaves starting from C)
const KB_MAP: Record<string, number> = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
  o: 13,
  l: 14,
  p: 15,
  ";": 16,
};

type Tab = "l1" | "l2" | "perf" | "mod" | "fx" | "out";

const TAB_LABELS: Record<Tab, string> = {
  l1: "L·I",
  l2: "L·II",
  perf: "PERF",
  mod: "MOD",
  fx: "FX",
  out: "OUT",
};

const UI_MODE_LABELS: Record<Tx80UiMode, string> = {
  full: "FULL",
  editor: "EDIT",
  performance: "PLAY",
};

const BEND_OPTIONS_COMPACT = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `±${i + 1}`,
}));

const RIBBON_RANGE_OPTIONS = [2, 5, 7, 12, 24].map((v) => ({ value: v, label: `±${v} ST` }));

const LFO_DEST_OPTIONS = [
  { value: "off", label: "OFF" },
  { value: "pitch", label: "PITCH" },
  { value: "filter", label: "FILTER" },
  { value: "amp", label: "AMP" },
  { value: "pw", label: "PW" },
  { value: "pan", label: "PAN" },
  { value: "balance", label: "BALANCE" },
] as const;

function pct(v: number): string {
  return (v * 100).toFixed(0);
}

function TX80App() {
  const [powered, setPowered] = useState(false);
  const [patch, setPatchState] = useState<Tx80Patch>(() =>
    cloneTx80Patch(TX80_PRODUCT.factoryPresets[0].patch),
  );
  const [octave, setOctave] = useState(4);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [sustain, setSustain] = useState(false);
  const [pitchBend, setPitchBend] = useState(0);
  const [modWheel, setModWheel] = useState(0);
  const [meter, setMeter] = useState(0);
  const [tab, setTab] = useState<Tab>("l1");
  // Start as "full" so server and client render identically; the persisted
  // mode is applied right after mount (avoids hydration mismatch).
  const [uiMode, setUiModeState] = useState<Tx80UiMode>("full");
  useEffect(() => {
    const saved = loadTx80UiMode();
    if (saved !== "full") setUiModeState(saved);
  }, []);
  const uiModeRef = useRef(uiMode);
  uiModeRef.current = uiMode;
  const activeNotesRef = useRef(activeNotes);
  activeNotesRef.current = activeNotes;
  const uiBlockedRef = useRef(false);

  // ── Workspace layout signals (SSR-safe defaults) ────────────────────────
  const [isPortrait, setIsPortrait] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const pq = window.matchMedia("(orientation: portrait)");
    const nq = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      setIsPortrait(pq.matches);
      setIsNarrow(nq.matches);
    };
    apply();
    pq.addEventListener("change", apply);
    nq.addEventListener("change", apply);
    return () => {
      pq.removeEventListener("change", apply);
      nq.removeEventListener("change", apply);
    };
  }, []);

  const engineRef = useRef<TX80ProductEngine | null>(null);
  const runtimeRef = useRef<SynthRuntime<Tx80Patch> | null>(null);
  const runtimeUnsubscribeRef = useRef<(() => void) | null>(null);

  // ── Global performance settings ─────────────────────────────────────────
  const [settings, setSettings] = useState<Tx80Settings>(TX80_DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setupBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    setSettings(loadTx80Settings());
  }, []);
  const settingsFirstRunRef = useRef(true);
  useEffect(() => {
    if (settingsFirstRunRef.current) {
      settingsFirstRunRef.current = false;
      return;
    }
    saveTx80Settings(settings);
    engineRef.current?.setPitchBendRange(settings.bendRangeSemitones);
  }, [settings]);
  const updateSettings = useCallback((partial: Partial<Tx80Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  // ── Parameter binding (authoritative registry → state + engine) ─────────
  const setParameter = useCallback((id: string, value: ParameterValue) => {
    setPatchState((prev) => {
      const next = setTx80Parameter(prev, id, value);
      engineRef.current?.setParameter(id, value);
      return next;
    });
  }, []);

  const setParameters = useCallback((updates: Readonly<Record<string, ParameterValue>>) => {
    setPatchState((prev) => {
      const next = setTx80Parameters(prev, updates);
      engineRef.current?.loadState(next);
      return next;
    });
  }, []);

  // ── Pitch/mod strips: immediate DSP, frame-throttled visuals ───────────
  const pitchBendRef = useRef(0);
  const modWheelRef = useRef(0);
  const pitchRafRef = useRef<number | null>(null);
  const modRafRef = useRef<number | null>(null);

  const handlePitchChange = useCallback((v: number) => {
    engineRef.current?.setPitchBend(v);
    pitchBendRef.current = v;
    if (pitchRafRef.current === null) {
      pitchRafRef.current = requestAnimationFrame(() => {
        setPitchBend(pitchBendRef.current);
        pitchRafRef.current = null;
      });
    }
  }, []);

  const handlePitchRelease = useCallback(() => {
    engineRef.current?.setPitchBend(0);
    pitchBendRef.current = 0;
    setPitchBend(0);
    if (pitchRafRef.current !== null) {
      cancelAnimationFrame(pitchRafRef.current);
      pitchRafRef.current = null;
    }
  }, []);

  const handleModChange = useCallback((v: number) => {
    engineRef.current?.setModulation(v);
    modWheelRef.current = v;
    if (modRafRef.current === null) {
      modRafRef.current = requestAnimationFrame(() => {
        setModWheel(modWheelRef.current);
        modRafRef.current = null;
      });
    }
  }, []);

  // Ribbon: engine owns the audible mapping (mode/range from the patch).
  // Like the strips, the ribbon does NOT initiate audio startup — it is
  // meaningless without a sounding note and sits in the thumb zone.
  const handleRibbonMove = useCallback((norm: number) => {
    engineRef.current?.setRibbonPosition(norm);
  }, []);
  const handleRibbonRelease = useCallback(() => {
    engineRef.current?.releaseRibbon();
  }, []);

  const [powerBusy, setPowerBusy] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [audioState, setAudioState] = useState<AudioInitState>("idle");

  // Launch diagnostics (local-only). A normal launch records app_loaded_armed
  // and NOTHING audio-related — audio work begins only on a genuine gesture.
  useEffect(() => {
    initStartupDiagnostics();
    recordStartupPhase("app_loaded_armed");
  }, []);

  // Read-only diagnostics hook for automated verification (browser e2e reads
  // voice counts and analyser peak; nothing here can mutate engine state).
  useEffect(() => {
    const w = window as unknown as {
      __TX80_DIAG?: () => unknown;
      __TX80_PEAK?: () => number;
    };
    w.__TX80_DIAG = () => engineRef.current?.getDiagnostics() ?? null;
    w.__TX80_PEAK = () => {
      const analyser = engineRef.current?.getAnalyser();
      if (!analyser) return -1;
      const buf = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      return peak;
    };
    return () => {
      delete w.__TX80_DIAG;
      delete w.__TX80_PEAK;
    };
  }, []);
  const firstNoteDiagRef = useRef({ queued: false, played: false });

  const onRuntimeStatus = useCallback((status: SynthRuntimeStatus) => {
    recordStartupPhase("ctx:" + status.contextState);
    const running = status.phase === "ready" || status.contextState === "running";
    setPowered(running);
    if (running) {
      setAudioError(false);
      setAudioState("ready");
      return;
    }
    if (
      status.phase === "starting" ||
      status.phase === "recovering" ||
      status.phase === "failed" ||
      status.phase === "suspended"
    ) {
      setAudioState(status.phase);
      if (status.phase === "failed") setAudioError(true);
    }
  }, []);

  // ── Centralized audio readiness (single in-flight promise) ─────────────
  const patchRef = useRef(patch);
  patchRef.current = patch;
  const readyPromiseRef = useRef<Promise<boolean> | null>(null);

  const ensureAudioReady = useCallback((): Promise<boolean> => {
    if (engineRef.current?.isRunning()) return Promise.resolve(true);
    if (readyPromiseRef.current) return readyPromiseRef.current;
    recordStartupPhase("gesture_start_attempt");

    if (!runtimeRef.current) {
      runtimeRef.current = new SynthRuntime<Tx80Patch>({
        timeoutMs: AUDIO_INIT_TIMEOUT_MS,
        createEngine: () => {
          const engine = new TX80ProductEngine(
            patchRef.current,
            settingsRef.current.bendRangeSemitones,
          );
          engineRef.current = engine;
          return engine;
        },
      });
      runtimeUnsubscribeRef.current = runtimeRef.current.subscribe(onRuntimeStatus);
    }
    const runtime = runtimeRef.current;

    const p = (async () => {
      try {
        const running = await runtime.activate();
        engineRef.current?.loadState(patchRef.current);
        setAudioError(!running);
        setAudioState(running ? "ready" : "failed");
        recordStartupPhase(running ? "ready" : "failed");
        if (!running) {
          const error = runtime.getStatus().error;
          if (error) recordStartupError(error);
        }
        return running;
      } catch (err) {
        console.error("TX-80 audio initialization failed:", err);
        recordStartupError(err);
        setAudioError(true);
        setAudioState("failed");
        recordStartupPhase("failed");
        return false;
      } finally {
        readyPromiseRef.current = null;
        setPowered(engineRef.current?.isRunning() ?? false);
      }
    })();
    readyPromiseRef.current = p;
    return p;
  }, [onRuntimeStatus]);
  const ensureAudioReadyRef = useRef(ensureAudioReady);
  ensureAudioReadyRef.current = ensureAudioReady;

  const powerOn = useCallback(async () => {
    if (powerBusy) return;
    setPowerBusy(true);
    try {
      await ensureAudioReady();
    } finally {
      setPowerBusy(false);
    }
  }, [ensureAudioReady, powerBusy]);

  const powerOff = useCallback(async () => {
    if (powerBusy) return;
    setPowerBusy(true);
    try {
      await runtimeRef.current?.stop();
    } finally {
      setActiveNotes(new Set());
      setSustain(false);
      pitchBendRef.current = 0;
      setPitchBend(0);
      if (pitchRafRef.current !== null) {
        cancelAnimationFrame(pitchRafRef.current);
        pitchRafRef.current = null;
      }
      setPowered(engineRef.current?.isRunning() ?? false);
      setPowerBusy(false);
    }
  }, [powerBusy]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runtimeUnsubscribeRef.current?.();
      runtimeUnsubscribeRef.current = null;
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
      engineRef.current = null;
      midiRef.current?.disable();
      midiRef.current = null;
      if (pitchRafRef.current !== null) cancelAnimationFrame(pitchRafRef.current);
      if (modRafRef.current !== null) cancelAnimationFrame(modRafRef.current);
    };
  }, []);

  // ── Mobile/PWA lifecycle: release notes on background, resync on return ─
  useEffect(() => {
    const releaseForBackground = () => {
      engineRef.current?.setSustain(false);
      setSustain(false);
      for (const n of activeNotesRef.current) engineRef.current?.noteOff(n);
      pendingNotesRef.current.clear();
      setActiveNotes(new Set());
      engineRef.current?.releaseRibbon();
    };
    const syncFromEngine = () => {
      const eng = engineRef.current;
      const running = !!eng?.isRunning();
      setPowered(running);
      setAudioState((prev) => {
        if (running) return "ready";
        if (!eng) return prev === "failed" ? prev : "idle";
        if (prev === "starting" || prev === "recovering" || prev === "failed") return prev;
        return "suspended";
      });
    };
    const onVisibility = () => {
      if (document.hidden) {
        recordStartupPhase("hidden");
        releaseForBackground();
      } else {
        recordStartupPhase("visible");
        syncFromEngine();
      }
    };
    const onPageHide = () => {
      recordStartupPhase("pagehide");
      releaseForBackground();
    };
    const onPageShow = () => {
      recordStartupPhase("pageshow");
      syncFromEngine();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // Output meter — reads the REAL analyser at the master output.
  useEffect(() => {
    if (!powered) return;
    let raf = 0;
    const analyser = engineRef.current?.getAnalyser();
    if (!analyser) return;
    const buf = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      setMeter(peak);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [powered]);

  // ── Notes (first musical gesture powers the synth on) ──────────────────
  const pendingNotesRef = useRef<Map<number, number>>(new Map());

  const noteOn = useCallback(
    (note: number, vel = 0.9) => {
      const engine = engineRef.current;
      if (!engine || !engine.isRunning()) {
        pendingNotesRef.current.set(note, vel);
        if (!firstNoteDiagRef.current.queued) {
          firstNoteDiagRef.current.queued = true;
          recordStartupPhase("first-note:queued");
        }
        setActiveNotes((s) => {
          const n = new Set(s);
          n.add(note);
          return n;
        });
        void ensureAudioReady().then((ok) => {
          const eng = engineRef.current;
          if (!ok || !eng?.isRunning()) {
            recordStartupPhase("first-note:dropped");
            const failed = new Set(pendingNotesRef.current.keys());
            pendingNotesRef.current.clear();
            setActiveNotes((s) => {
              const n = new Set(s);
              for (const k of failed) n.delete(k);
              return n;
            });
            return;
          }
          for (const [n, v] of pendingNotesRef.current) eng.noteOn(n, v);
          pendingNotesRef.current.clear();
          if (!firstNoteDiagRef.current.played) {
            firstNoteDiagRef.current.played = true;
            recordStartupPhase("first-note:flushed");
          }
        });
        return;
      }
      engine.noteOn(note, vel);
      if (!firstNoteDiagRef.current.played) {
        firstNoteDiagRef.current.played = true;
        recordStartupPhase("first-note:direct");
      }
      setActiveNotes((s) => {
        const n = new Set(s);
        n.add(note);
        return n;
      });
    },
    [ensureAudioReady],
  );

  const noteOff = useCallback((note: number) => {
    pendingNotesRef.current.delete(note);
    engineRef.current?.noteOff(note);
    setActiveNotes((s) => {
      const n = new Set(s);
      n.delete(note);
      return n;
    });
  }, []);

  const noteOnRef = useRef(noteOn);
  noteOnRef.current = noteOn;
  const noteOffRef = useRef(noteOff);
  noteOffRef.current = noteOff;

  // Computer keyboard piano (suspended while dialogs are open; keyups stay
  // unguarded so a note held across a dialog opening can never stick).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (uiBlockedRef.current) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;
      if (e.key === " ") {
        e.preventDefault();
        setSustain(true);
        engineRef.current?.setSustain(true);
        return;
      }
      if (e.key === "z") {
        setOctave((o) => Math.max(1, o - 1));
        return;
      }
      if (e.key === "x") {
        setOctave((o) => Math.min(7, o + 1));
        return;
      }
      const off = KB_MAP[e.key.toLowerCase()];
      if (off != null) noteOn(12 * (octave + 1) + off, 0.9);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") {
        setSustain(false);
        engineRef.current?.setSustain(false);
        return;
      }
      const off = KB_MAP[e.key.toLowerCase()];
      if (off != null) noteOff(12 * (octave + 1) + off);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [octave, noteOn, noteOff]);

  // Authoritative preset-application path. Held notes are released through
  // the normal noteOff path first so a patch change can never leave a voice
  // sounding with a stale layer configuration.
  const applyPatch = useCallback(
    (p: Tx80Patch) => {
      for (const n of activeNotesRef.current) engineRef.current?.noteOff(n);
      pendingNotesRef.current.clear();
      setActiveNotes(new Set());
      const cloned = cloneTx80Patch(p);
      patchRef.current = cloned;
      setPatchState(cloned);
      const eng = engineRef.current;
      if (eng?.isRunning()) eng.loadState(cloned);
      else void ensureAudioReady();
    },
    [ensureAudioReady],
  );

  const releaseAllNotes = useCallback(() => {
    for (const n of activeNotesRef.current) engineRef.current?.noteOff(n);
    pendingNotesRef.current.clear();
    setActiveNotes(new Set());
  }, []);

  const confirmDiscardRef = useRef(true);
  confirmDiscardRef.current = settings.confirmPresetChange;
  const presets = useTx80Presets({ patch, applyPatch, confirmDiscardRef });

  uiBlockedRef.current = presets.dialog.kind !== "none" || settingsOpen;

  const initPatch = () => {
    const p = cloneTx80Patch(TX80_INIT_PATCH);
    applyPatch(p);
    presets.markUnsaved(p);
  };

  // ── MIDI (guarded; created only on explicit enable) ────────────────────
  const midiRef = useRef<Tx80Midi | null>(null);
  const [midiStatus, setMidiStatus] = useState<Tx80MidiStatus>({ state: "idle" });
  const enableMidi = useCallback(() => {
    if (!midiRef.current) {
      midiRef.current = new Tx80Midi({
        noteOn: (n, v) => noteOnRef.current(n, v),
        noteOff: (n) => noteOffRef.current(n),
        sustain: (down) => {
          setSustain(down);
          engineRef.current?.setSustain(down);
        },
        pitchBend: (norm) => {
          engineRef.current?.setPitchBend(norm);
          setPitchBend(norm);
        },
        modWheel: (norm) => {
          engineRef.current?.setModulation(norm);
          setModWheel(norm);
        },
        allNotesOff: () => {
          for (const n of activeNotesRef.current) engineRef.current?.noteOff(n);
          pendingNotesRef.current.clear();
          setActiveNotes(new Set());
          engineRef.current?.setSustain(false);
          setSustain(false);
        },
      });
      midiRef.current.subscribe(setMidiStatus);
    }
    void midiRef.current.enable();
  }, []);
  const disableMidi = useCallback(() => {
    midiRef.current?.disable();
  }, []);

  // Switch UI mode; release pointer-owned notes before the keyboard unmounts.
  const switchUiMode = useCallback((mode: Tx80UiMode) => {
    if (mode === uiModeRef.current) return;
    if (mode === "editor") {
      for (const n of activeNotesRef.current) engineRef.current?.noteOff(n);
      setActiveNotes(new Set());
    }
    if (mode === "performance") {
      void ensureAudioReadyRef.current?.();
    }
    saveTx80UiMode(mode);
    setUiModeState(mode);
  }, []);

  const panic = useCallback(() => {
    engineRef.current?.panic(); // stops voices, recentres bend + ribbon
    pendingNotesRef.current.clear();
    setActiveNotes(new Set());
    setSustain(false);
    pitchBendRef.current = 0;
    setPitchBend(0);
    if (pitchRafRef.current !== null) {
      cancelAnimationFrame(pitchRafRef.current);
      pitchRafRef.current = null;
    }
  }, []);

  const activeName = presets.activeEntry?.name ?? patch.name;
  const activeIndex = Math.max(
    0,
    presets.entries.findIndex((e) => e.id === presets.activeId),
  );

  return (
    <div
      className="h-[100dvh] w-full flex flex-col overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at top, #262320 0%, #131110 80%), #0a0908",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* TOP BAR */}
      <header
        className="flex items-center gap-2 px-3 py-2 border-b border-black/60"
        style={{ background: "linear-gradient(180deg, #23201d 0%, #171512 100%)" }}
      >
        <div className="flex flex-col shrink-0">
          <div className="text-[10px] tracking-[0.3em] text-tx-muted leading-none">TXPPS</div>
          <div className="text-base font-bold tracking-widest text-tx-cream leading-tight">
            TX-80
          </div>
          <div className="text-[7px] tracking-[0.2em] text-tx-muted leading-none">v1.0.0</div>
        </div>
        <div className="flex gap-[2px] shrink-0 ml-auto" role="group" aria-label="Interface mode">
          {(["full", "editor", "performance"] as const).map((m) => (
            <button
              key={m}
              className={`tx-btn px-1.5 ${uiMode === m ? "tx-btn-active" : ""}`}
              onClick={() => switchUiMode(m)}
            >
              {UI_MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <button
          className={`tx-btn shrink-0 ${powered ? "tx-btn-active" : ""}`}
          onClick={powered ? powerOff : powerOn}
          disabled={powerBusy}
          aria-label={powered ? "Power off" : "Power on"}
          style={
            audioState === "failed"
              ? { color: "var(--tx-red)", borderColor: "var(--tx-red)" }
              : undefined
          }
        >
          {audioState === "starting" || audioState === "recovering"
            ? "STARTING"
            : audioState === "failed"
              ? "RETRY"
              : powered
                ? "● ON"
                : audioState === "idle"
                  ? "READY"
                  : "POWER"}
        </button>
        <button className="tx-btn shrink-0" onClick={panic} style={{ color: "var(--tx-red)" }}>
          PANIC
        </button>
      </header>

      {/* AUDIO START FAILED recovery strip */}
      {audioState === "failed" && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-black/60 bg-tx-panel-dark">
          <span className="text-[9px] tracking-widest min-w-0" style={{ color: "var(--tx-red)" }}>
            AUDIO START FAILED — TAP RETRY TO RECONNECT THE AUDIO ENGINE.
          </span>
          <button
            className="tx-btn ml-auto shrink-0"
            style={{ color: "var(--tx-red)", borderColor: "var(--tx-red)" }}
            onClick={powerOn}
            disabled={powerBusy}
          >
            RETRY AUDIO
          </button>
        </div>
      )}

      {/* PRESET LCD + actions */}
      <div className="px-2 py-1.5 border-b border-black/50 bg-tx-panel-dark flex flex-col gap-1">
        <div className="flex items-stretch gap-1">
          <button
            className="tx-btn px-2.5 shrink-0"
            onClick={() => presets.step(-1)}
            aria-label="Previous preset"
          >
            ◀
          </button>
          <div className="tx-lcd-box flex-1 min-w-0 px-2.5 py-1 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[8px] opacity-60 leading-none tracking-[0.25em]">PATCH</div>
              <div
                className="text-sm font-bold tracking-wider truncate leading-tight"
                data-testid="tx80-patch-name"
              >
                {activeName}
                {presets.unsaved && <span className="opacity-70 text-[9px] ml-2">● UNSAVED</span>}
              </div>
              <div className="text-[8px] opacity-60 leading-none tracking-widest">
                {activeIndex + 1}/{presets.entries.length} ·{" "}
                {presets.activeIsUser ? "USER" : "TXPPS FACTORY"} · POLY {patch.polyphony}
                {audioError ? " · AUDIO ERR" : ""}
              </div>
            </div>
            <MeterBar value={meter} />
          </div>
          <button
            className="tx-btn px-2.5 shrink-0"
            onClick={() => presets.step(1)}
            aria-label="Next preset"
          >
            ▶
          </button>
        </div>
        {uiMode !== "performance" && (
          <div className="flex items-center gap-1">
            <button className="tx-btn flex-1" onClick={presets.beginSaveAs}>
              SAVE AS
            </button>
            <button
              className="tx-btn flex-1 disabled:opacity-40"
              onClick={() => presets.activeId && presets.beginRename(presets.activeId)}
              disabled={!presets.activeIsUser}
            >
              REN
            </button>
            <button
              className="tx-btn flex-1 disabled:opacity-40"
              onClick={() => presets.activeId && presets.beginDelete(presets.activeId)}
              disabled={!presets.activeIsUser}
            >
              DEL
            </button>
            <button className="tx-btn flex-1" onClick={initPatch}>
              INIT
            </button>
            <button
              ref={setupBtnRef}
              className="tx-btn flex-1"
              onClick={() => setSettingsOpen(true)}
              aria-haspopup="dialog"
            >
              SETUP
            </button>
          </div>
        )}
      </div>

      {/* MAIN AREA */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* Tab strip — phone */}
        <div
          className={`flex gap-1 px-2 py-1.5 md:hidden ${uiMode === "performance" ? "hidden" : ""}`}
        >
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              className={`tx-btn flex-1 px-1 ${tab === t ? "tx-btn-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <div
          className={`flex-1 min-h-0 overflow-auto px-2 py-2 grid gap-2 md:grid-cols-12 content-start ${
            uiMode === "performance" ? "hidden md:hidden" : ""
          }`}
        >
          {/* LAYER I */}
          <section
            className={`tx-panel p-2 md:col-span-6 ${tab !== "l1" ? "hidden md:block" : ""}`}
          >
            <LayerPanel index={0} layer={patch.layers[0]} setParameter={setParameter} />
          </section>

          {/* LAYER II */}
          <section
            className={`tx-panel p-2 md:col-span-6 ${tab !== "l2" ? "hidden md:block" : ""}`}
          >
            <LayerPanel index={1} layer={patch.layers[1]} setParameter={setParameter} />
          </section>

          {/* PERFORMANCE — voice allocation, travel, ribbon behavior */}
          <section
            className={`tx-panel p-2 md:col-span-4 ${tab !== "perf" ? "hidden md:block" : ""}`}
          >
            <PanelTitle>VOICE · TRAVEL · RIBBON</PanelTitle>
            <div className="flex gap-1 mb-2">
              <button
                className={`tx-btn flex-1 ${patch.voiceMode === "poly" ? "tx-btn-active" : ""}`}
                onClick={() => setParameter("voice.mode", "poly")}
              >
                POLY
              </button>
              <button
                className={`tx-btn flex-1 ${patch.voiceMode === "solo" ? "tx-btn-active" : ""}`}
                onClick={() => setParameter("voice.mode", "solo")}
              >
                SOLO
              </button>
              {([4, 8, 12, 16] as const).map((n) => (
                <button
                  key={n}
                  className={`tx-btn flex-1 px-1 ${patch.polyphony === n ? "tx-btn-active" : ""}`}
                  onClick={() => setParameter("voice.polyphony", n)}
                >
                  {n}V
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 mb-2">
              <div className="text-[10px] tracking-widest text-tx-muted shrink-0 mr-1">TRAVEL</div>
              {(
                [
                  ["off", "OFF", "Notes start exactly at pitch"],
                  ["porta", "PORTA", "Portamento — smooth continuous glide with exact arrival"],
                  ["gliss", "GLISS", "Glissando — discrete chromatic semitone steps"],
                ] as const
              ).map(([mode, label, hint]) => (
                <button
                  key={mode}
                  className={`tx-btn flex-1 ${patch.pitchTravel.mode === mode ? "tx-btn-active" : ""}`}
                  onClick={() => setParameter("pitch.mode", mode)}
                  aria-pressed={patch.pitchTravel.mode === mode}
                  title={hint}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <ParamKnob
                id="pitch.time"
                label="TIME"
                value={patch.pitchTravel.time}
                onChange={setParameter}
                format={(v) => v.toFixed(2)}
              />
              <ParamKnob
                id="velocity.sensitivity"
                label="VEL SENS"
                value={patch.velocitySens}
                onChange={setParameter}
                format={pct}
              />
            </div>
            <div className="flex items-center gap-1 mb-2">
              <div className="text-[10px] tracking-widest text-tx-muted shrink-0 mr-1">RIBBON</div>
              {(
                [
                  ["pitch", "PITCH", "Continuous bend, springs back to centre"],
                  ["gliss", "GLISS", "Stepped semitones, springs back to centre"],
                  ["hold", "HOLD", "Continuous bend, holds its last value"],
                ] as const
              ).map(([mode, label, hint]) => (
                <button
                  key={mode}
                  className={`tx-btn flex-1 ${patch.ribbon.mode === mode ? "tx-btn-active" : ""}`}
                  onClick={() => setParameter("ribbon.mode", mode)}
                  aria-pressed={patch.ribbon.mode === mode}
                  title={hint}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[10px] tracking-widest text-tx-muted shrink-0">RANGE</div>
              <TxSelect
                value={patch.ribbon.range}
                options={RIBBON_RANGE_OPTIONS}
                onChange={(v) => setParameter("ribbon.range", v)}
                className="flex-1 min-w-0 text-center"
                ariaLabel="Ribbon range in semitones"
              />
            </div>
          </section>

          {/* MODULATION — two LFOs */}
          <section
            className={`tx-panel p-2 md:col-span-4 ${tab !== "mod" ? "hidden md:block" : ""}`}
          >
            <PanelTitle>MODULATION</PanelTitle>
            {(
              [
                ["A", patch.lfoA],
                ["B", patch.lfoB],
              ] as const
            ).map(([which, lfo]) => (
              <div key={which} className={which === "A" ? "mb-3" : ""}>
                <div className="flex items-center gap-1 mb-1">
                  <div className="text-[9px] tracking-[0.3em] text-tx-muted shrink-0">
                    LFO {which}
                  </div>
                  <div className="flex gap-1 flex-1">
                    {(["sine", "triangle", "square", "saw"] as const).map((w) => (
                      <button
                        key={w}
                        className={`tx-btn flex-1 px-0.5 ${lfo.wave === w ? "tx-btn-active" : ""}`}
                        onClick={() => setParameter(`lfo${which}.wave`, w)}
                      >
                        {w === "sine"
                          ? "SIN"
                          : w === "triangle"
                            ? "TRI"
                            : w === "square"
                              ? "SQR"
                              : "SAW"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <ParamKnob
                      id={`lfo${which}.rate`}
                      label="RATE"
                      taper="log"
                      value={lfo.rate}
                      onChange={setParameter}
                      format={(v) => v.toFixed(2)}
                    />
                    <ParamKnob
                      id={`lfo${which}.depth`}
                      label="DEPTH"
                      value={lfo.depth}
                      onChange={setParameter}
                      format={pct}
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-28 shrink-0">
                    <div className="text-[8px] tracking-[0.25em] text-tx-muted text-center">
                      DEST
                    </div>
                    <TxSelect
                      value={lfo.destination}
                      options={LFO_DEST_OPTIONS as unknown as { value: string; label: string }[]}
                      onChange={(v) => setParameter(`lfo${which}.dest`, v)}
                      className="text-center"
                      ariaLabel={`LFO ${which} destination`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* OUTPUT */}
          <section
            className={`tx-panel p-2 md:col-span-4 ${tab !== "out" ? "hidden md:block" : ""}`}
          >
            <PanelTitle>MASTER OUTPUT</PanelTitle>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <ParamKnob
                id="master.volume"
                label="VOLUME"
                value={patch.master.volume}
                onChange={setParameter}
                format={pct}
              />
              <ParamKnob
                id="master.balance"
                label="BALANCE"
                value={patch.master.balance}
                onChange={setParameter}
                format={(v) =>
                  Math.abs(v) < 0.005
                    ? "C"
                    : v < 0
                      ? `I ${Math.round(-v * 100)}`
                      : `II ${Math.round(v * 100)}`
                }
              />
            </div>
            <div className="tx-lcd-box px-2 py-2 flex items-center gap-2">
              <div className="text-[8px] opacity-60 tracking-[0.25em] shrink-0">OUT</div>
              <div className="flex-1">
                <MeterBar value={meter} wide />
              </div>
            </div>
            <div className="text-[9px] text-tx-muted mt-2 tracking-widest text-center">
              SAFETY LIMITER ALWAYS ENGAGED AT THE MASTER STAGE
            </div>
          </section>

          {/* FX */}
          <section
            className={`tx-panel p-2 md:col-span-12 ${tab !== "fx" ? "hidden md:block" : ""}`}
          >
            <PanelTitle>EFFECTS · CHORUS → DELAY → REVERB</PanelTitle>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="tx-panel p-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] tracking-widest text-tx-muted">CHORUS</div>
                  <button
                    className={`tx-btn ${patch.chorus.enabled ? "tx-btn-active" : ""}`}
                    onClick={() => setParameter("fx.chorus.enabled", !patch.chorus.enabled)}
                  >
                    {patch.chorus.enabled ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ParamKnob
                    id="fx.chorus.amount"
                    label="AMT"
                    value={patch.chorus.amount}
                    onChange={setParameter}
                    format={pct}
                  />
                  <ParamKnob
                    id="fx.chorus.rate"
                    label="RATE"
                    value={patch.chorus.rate}
                    onChange={setParameter}
                    format={(v) => v.toFixed(2)}
                  />
                  <ParamKnob
                    id="fx.chorus.depth"
                    label="DEPTH"
                    value={patch.chorus.depth}
                    onChange={setParameter}
                    format={(v) => (v * 1000).toFixed(1)}
                  />
                </div>
              </div>
              <div className="tx-panel p-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] tracking-widest text-tx-muted">DELAY</div>
                  <button
                    className={`tx-btn ${patch.delay.enabled ? "tx-btn-active" : ""}`}
                    onClick={() => setParameter("fx.delay.enabled", !patch.delay.enabled)}
                  >
                    {patch.delay.enabled ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ParamKnob
                    id="fx.delay.time"
                    label="TIME"
                    value={patch.delay.time}
                    onChange={setParameter}
                    format={(v) => (v * 1000).toFixed(0)}
                  />
                  <ParamKnob
                    id="fx.delay.feedback"
                    label="FB"
                    value={patch.delay.feedback}
                    onChange={setParameter}
                    format={pct}
                  />
                  <ParamKnob
                    id="fx.delay.mix"
                    label="MIX"
                    value={patch.delay.mix}
                    onChange={setParameter}
                    format={pct}
                  />
                </div>
              </div>
              <div className="tx-panel p-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] tracking-widest text-tx-muted">REVERB</div>
                  <button
                    className={`tx-btn ${patch.reverb.enabled ? "tx-btn-active" : ""}`}
                    onClick={() => setParameter("fx.reverb.enabled", !patch.reverb.enabled)}
                  >
                    {patch.reverb.enabled ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="flex gap-1 mb-2">
                  {(["digital", "hall", "glass"] as const).map((t) => (
                    <button
                      key={t}
                      className={`tx-btn flex-1 ${patch.reverb.type === t ? "tx-btn-active" : ""}`}
                      onClick={() => setParameter("fx.reverb.type", t)}
                    >
                      {t === "digital" ? "DIG" : t === "hall" ? "HALL" : "GLASS"}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ParamKnob
                    id="fx.reverb.mix"
                    label="MIX"
                    value={patch.reverb.mix}
                    onChange={setParameter}
                    format={pct}
                  />
                  <ParamKnob
                    id="fx.reverb.size"
                    label="SIZE"
                    value={patch.reverb.size}
                    onChange={setParameter}
                    format={pct}
                  />
                  <ParamKnob
                    id="fx.reverb.decay"
                    label="DECAY"
                    value={patch.reverb.decay}
                    onChange={setParameter}
                    format={pct}
                  />
                  <ParamKnob
                    id="fx.reverb.preDelay"
                    label="PRE"
                    value={patch.reverb.preDelay}
                    onChange={setParameter}
                    format={(v) => (v * 1000).toFixed(0)}
                  />
                  <ParamKnob
                    id="fx.reverb.damping"
                    label="DAMP"
                    value={patch.reverb.damping}
                    onChange={setParameter}
                    format={pct}
                  />
                  <ParamKnob
                    id="fx.reverb.width"
                    label="WIDTH"
                    value={patch.reverb.width}
                    onChange={setParameter}
                    format={pct}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* PERFORMANCE AREA — ribbon + keyboard, shared by FULL and PLAY. */}
        {uiMode !== "editor" &&
          (() => {
            const playPortrait = uiMode === "performance" && isPortrait && isNarrow;
            const fullPortrait = uiMode === "full" && isPortrait && isNarrow;
            const minKeyWidth =
              uiMode === "performance" ? (playPortrait ? 34 : 30) : fullPortrait ? 30 : 24;

            const ribbonLabel = `RIBBON · ${patch.ribbon.mode.toUpperCase()} ±${patch.ribbon.range}`;
            const ribbonEl = (
              <Ribbon
                onMove={handleRibbonMove}
                onRelease={handleRibbonRelease}
                label={ribbonLabel}
                stepped={patch.ribbon.mode === "gliss"}
                range={patch.ribbon.range}
              />
            );

            const bendSelect = (
              <TxSelect
                value={settings.bendRangeSemitones}
                options={BEND_OPTIONS_COMPACT}
                onChange={(v) => updateSettings({ bendRangeSemitones: v })}
                className="text-center"
                style={{ minHeight: 34 }}
                ariaLabel="Global pitch bend range in semitones"
              />
            );

            const sustainBtn = (extra = "") => (
              <button
                className={`tx-btn ${extra} ${sustain ? "tx-btn-active" : ""}`}
                onPointerDown={() => {
                  setSustain(true);
                  engineRef.current?.setSustain(true);
                }}
                onPointerUp={() => {
                  setSustain(false);
                  engineRef.current?.setSustain(false);
                }}
                onPointerLeave={() => {
                  if (sustain) {
                    setSustain(false);
                    engineRef.current?.setSustain(false);
                  }
                }}
              >
                SUS
              </button>
            );

            return (
              <div
                className={`border-t border-black/60 bg-tx-panel-dark px-2 pt-2 pb-2 ${
                  uiMode === "performance" ? "flex-1 min-h-0 flex flex-col" : "shrink-0"
                }`}
                style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
              >
                {playPortrait ? (
                  <div className="flex-1 min-h-0 flex flex-col gap-2" style={{ minHeight: 230 }}>
                    <div className="flex gap-1 shrink-0" style={{ height: 44 }}>
                      <button
                        className="tx-btn flex-1"
                        onClick={() => setOctave((o) => Math.max(1, o - 1))}
                      >
                        OCT −
                      </button>
                      <div className="tx-lcd-box flex items-center justify-center px-3 text-xs">
                        C{octave}
                      </div>
                      <button
                        className="tx-btn flex-1"
                        onClick={() => setOctave((o) => Math.min(7, o + 1))}
                      >
                        OCT +
                      </button>
                      {bendSelect}
                      {sustainBtn("flex-1")}
                    </div>
                    <div className="shrink-0" style={{ height: 36 }}>
                      <PerfStrip
                        label="PITCH"
                        value={pitchBend}
                        bipolar
                        horizontal
                        onChange={handlePitchChange}
                        onRelease={handlePitchRelease}
                      />
                    </div>
                    <div className="shrink-0" style={{ height: 36 }}>
                      <PerfStrip
                        label="MOD"
                        value={modWheel}
                        horizontal
                        onChange={handleModChange}
                      />
                    </div>
                    <div className="shrink-0" style={{ height: 56 }}>
                      {ribbonEl}
                    </div>
                    <div
                      className="mt-auto shrink-0"
                      style={{ height: "min(24vh, 220px)", minHeight: 90 }}
                    >
                      <Keyboard
                        octave={octave}
                        onNoteOn={noteOn}
                        onNoteOff={noteOff}
                        activeNotes={activeNotes}
                        minKeyWidth={minKeyWidth}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className={`flex flex-col gap-2 ${uiMode === "performance" ? "flex-1 min-h-0" : ""}`}
                    style={
                      uiMode === "performance"
                        ? { minHeight: 210 }
                        : fullPortrait
                          ? { height: "24vh", minHeight: 150, maxHeight: 220 }
                          : { height: "30vh", minHeight: 210, maxHeight: 300 }
                    }
                  >
                    <div className="shrink-0" style={{ height: 40 }}>
                      {ribbonEl}
                    </div>
                    <div className="flex-1 min-h-0 flex gap-2 items-stretch">
                      <div className="flex flex-col gap-1 shrink-0" style={{ width: 44 }}>
                        <div className="flex-1">
                          <PerfStrip
                            label="PITCH"
                            value={pitchBend}
                            bipolar
                            onChange={handlePitchChange}
                            onRelease={handlePitchRelease}
                          />
                        </div>
                        <div className="flex-1">
                          <PerfStrip label="MOD" value={modWheel} onChange={handleModChange} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0" style={{ width: 60 }}>
                        <button
                          className="tx-btn flex-1"
                          onClick={() => setOctave((o) => Math.min(7, o + 1))}
                        >
                          OCT +
                        </button>
                        <button
                          className="tx-btn flex-1"
                          onClick={() => setOctave((o) => Math.max(1, o - 1))}
                        >
                          OCT −
                        </button>
                        <div className="tx-lcd-box text-center py-1 text-xs">C{octave}</div>
                        {uiMode === "performance" && bendSelect}
                        {sustainBtn("flex-1")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Keyboard
                          octave={octave}
                          onNoteOn={noteOn}
                          onNoteOff={noteOff}
                          activeNotes={activeNotes}
                          minKeyWidth={minKeyWidth}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
      </main>

      {/* DIALOGS */}
      {presets.dialog.kind === "saveAs" && (
        <Tx80SaveDialog
          title="SAVE PRESET AS"
          initialName={presets.unsaved ? patch.name : `${patch.name} 2`}
          submitLabel="SAVE"
          onSubmit={presets.submitSaveAs}
          onCancel={presets.cancelDialog}
        />
      )}
      {presets.dialog.kind === "rename" && (
        <Tx80SaveDialog
          title="RENAME PRESET"
          initialName={presets.getEntry(presets.dialog.id)?.name ?? ""}
          submitLabel="RENAME"
          onSubmit={presets.submitRename}
          onCancel={presets.cancelDialog}
        />
      )}
      {presets.dialog.kind === "confirmDelete" && (
        <PatchConfirmDialog
          title="DELETE PRESET"
          message={`DELETE "${(presets.getEntry(presets.dialog.id)?.name ?? "").toUpperCase()}"? THIS CANNOT BE UNDONE.`}
          onCancel={presets.cancelDialog}
          actions={[
            { label: "CANCEL", onSelect: presets.cancelDialog },
            { label: "DELETE", tone: "danger", onSelect: presets.confirmDelete },
          ]}
        />
      )}
      {presets.dialog.kind === "confirmDiscard" && (
        <PatchConfirmDialog
          title="UNSAVED CHANGES"
          message={`"${patch.name.toUpperCase()}" HAS UNSAVED CHANGES. LOAD "${(
            presets.getEntry(presets.dialog.targetId)?.name ?? ""
          ).toUpperCase()}" ANYWAY?`}
          onCancel={presets.cancelDialog}
          actions={[
            { label: "CANCEL", onSelect: presets.cancelDialog },
            { label: "DISCARD", tone: "danger", onSelect: presets.confirmDiscard },
          ]}
        />
      )}
      {settingsOpen && (
        <Tx80SetupDialog
          settings={settings}
          onChange={updateSettings}
          midiStatus={midiStatus}
          onEnableMidi={enableMidi}
          onDisableMidi={disableMidi}
          storageOk={presets.storageOk}
          onClose={() => {
            setSettingsOpen(false);
            setupBtnRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] tracking-[0.3em] text-tx-muted mb-2 pb-1 border-b border-black/40">
      {children}
    </div>
  );
}

function MeterBar({ value, wide = false }: { value: number; wide?: boolean }) {
  const segs = wide ? 16 : 8;
  const on = Math.round(value * segs * 1.4);
  return (
    <div className={`flex gap-[2px] ${wide ? "w-full" : "shrink-0"}`}>
      {Array.from({ length: segs }).map((_, i) => {
        const active = i < on;
        const isHigh = i >= segs - 2;
        return (
          <div
            key={i}
            className={wide ? "flex-1" : ""}
            style={{
              width: wide ? undefined : 3,
              height: 14,
              background: active
                ? isHigh
                  ? "var(--tx-red)"
                  : "var(--tx-lcd)"
                : "rgba(255,255,255,0.06)",
              boxShadow: active ? `0 0 4px ${isHigh ? "var(--tx-red)" : "var(--tx-lcd)"}` : "none",
              borderRadius: 1,
            }}
          />
        );
      })}
    </div>
  );
}
