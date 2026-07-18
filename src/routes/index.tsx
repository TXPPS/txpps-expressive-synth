import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Knob } from "@/components/tx27/Knob";
import { Keyboard } from "@/components/tx27/Keyboard";
import { PerfStrip } from "@/components/tx27/PerfStrip";
import { AlgorithmView } from "@/components/tx27/AlgorithmView";
import { ALGORITHMS } from "@/lib/audio/algorithms";
import { INIT_PATCH, type Patch } from "@/lib/audio/types";
import type { ParameterValue, SynthEngine, SynthRuntimeStatus } from "@/lib/synth/contracts";
import { SynthRuntime } from "@/lib/synth/runtime";
import { setTx27Parameter, setTx27Parameters } from "@/lib/tx27/parameters";
import { TX27_PRODUCT } from "@/lib/tx27/productAdapter";
import { clonePatch, randomizePatch } from "@/lib/presets";
import { PatchLibrary } from "@/components/tx27/patch-library/PatchLibrary";
import { PatchSaveDialog } from "@/components/tx27/patch-library/PatchSaveDialog";
import { PatchConfirmDialog } from "@/components/tx27/patch-library/PatchConfirmDialog";
import { usePatchLibrary } from "@/components/tx27/patch-library/usePatchLibrary";
import { PresetLCD } from "@/components/tx27/PresetLCD";
import { TxSelect } from "@/components/tx27/TxSelect";
import { PresetQuickAccess } from "@/components/tx27/PresetQuickAccess";
import { SettingsDialog } from "@/components/tx27/SettingsDialog";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Tx27Settings,
} from "@/lib/settings";
import {
  initStartupDiagnostics,
  recordStartupError,
  recordStartupPhase,
} from "@/lib/startup-diagnostics";

// ── Audio initialization state machine ──────────────────────────────────────
// idle       — ARMED: app fully loaded and playable-looking, audio not yet
//              unlocked. This is the NORMAL launch state (mobile autoplay
//              policy forbids silent unlock) — never presented as an error,
//              no timeout runs, nothing starts until a genuine user gesture.
// starting   — a user gesture initiated engine creation/resume (bounded)
// recovering — rebuilding after a dead engine (closed context) was disposed
// ready      — context genuinely running
// suspended  — context suspended/interrupted (power off, background, lock);
//              the next gesture resumes it
// failed     — a GESTURE-STARTED bounded attempt failed; RETRY UI is shown,
//              the next gesture retries
type AudioInitState = "idle" | "starting" | "recovering" | "ready" | "suspended" | "failed";

/** Which user interaction initiated an audio start attempt (diagnostics). */
type StartGestureSource = "key" | "power" | "preset" | "play_mode" | "unknown";

/** Bounded overall audio init. engine.start() bounds each AudioContext await
 *  itself; this outer limit is defense for anything else so a later gesture
 *  can always retry (the in-flight promise is cleared on settle). */
const AUDIO_INIT_TIMEOUT_MS = 8000;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TXPPS TX27 — Mobile FM Synthesizer" },
      {
        name: "description",
        content:
          "Play TXPPS TX27 in the browser: four-operator FM, six routing algorithms, Vintage Circuit with AGE macro, chorus, delay, and three reverbs.",
      },
    ],
  }),
  component: TX27App,
});

// Computer keyboard mapping (2 octaves starting from C)
const KB_MAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ";": 16,
};

type Tab = "ops" | "algo" | "voice" | "mix" | "vintage" | "fx";

// Short labels keep six tabs on one phone-width row.
const TAB_LABELS: Record<Tab, string> = {
  ops: "OPS",
  algo: "ALGO",
  voice: "VOICE",
  mix: "MIX",
  vintage: "VINT",
  fx: "FX",
};

// Global bend-range choices (settings.ts). Full label for panels, compact for
// the PLAY-mode control bar.
const BEND_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `±${i + 1} ST`,
}));
const BEND_OPTIONS_COMPACT = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `±${i + 1}`,
}));

// ── UI modes ────────────────────────────────────────────────────────────────
// FULL = complete instrument, EDIT = synthesis editing without the keyboard,
// PLAY = dedicated performance screen. Not part of Patch — persisted separately.
type Tx27UiMode = "full" | "editor" | "performance";

const UI_MODE_KEY = "tx27-ui-mode";
const UI_MODE_LABELS: Record<Tx27UiMode, string> = {
  full: "FULL",
  editor: "EDIT",
  performance: "PLAY",
};

function loadUiMode(): Tx27UiMode {
  try {
    const v = localStorage.getItem(UI_MODE_KEY);
    if (v === "full" || v === "editor" || v === "performance") return v;
  } catch {
    /* noop */
  }
  return "full";
}

function TX27App() {
  const [powered, setPowered] = useState(false);
  const [patch, setPatchState] = useState<Patch>(() =>
    clonePatch(TX27_PRODUCT.factoryPresets[0]),
  );
  const [selectedOp, setSelectedOp] = useState(0);
  const [octave, setOctave] = useState(4);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [sustain, setSustain] = useState(false);
  const [pitchBend, setPitchBend] = useState(0); // -1..1
  const [modWheel, setModWheel] = useState(0);
  const [meter, setMeter] = useState(0);
  const [tab, setTab] = useState<Tab>("ops");
  // Always start as "full" so server and client render identically (avoids a
  // hydration mismatch); the persisted mode is applied right after mount.
  const [uiMode, setUiModeState] = useState<Tx27UiMode>("full");
  useEffect(() => {
    const saved = loadUiMode();
    if (saved !== "full") setUiModeState(saved);
  }, []);
  // Refs mirroring state, so switchUiMode can run side effects outside a
  // state-updater function (updaters must stay pure under Strict Mode).
  const uiModeRef = useRef(uiMode);
  uiModeRef.current = uiMode;
  const activeNotesRef = useRef(activeNotes);
  activeNotesRef.current = activeNotes;
  // True while the patch library overlay or one of its dialogs is open — the
  // computer-keyboard piano is suspended so typing never plays notes. A ref
  // (not state) so the global key handler needs no re-subscription.
  const uiBlockedRef = useRef(false);
  // Central LCD button — declared up here because the piano key handler below
  // must exempt it from Space-sustain, so native Space activation can open
  // the preset quick-access panel (keyboard-accessibility requirement).
  const lcdBtnRef = useRef<HTMLButtonElement | null>(null);

  // ── Workspace layout signals ─────────────────────────────────────────────
  // Both default to false so server and client render identically; the real
  // values apply right after mount (same pattern as the persisted UI mode).
  const [isPortrait, setIsPortrait] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false); // phone-class width
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

  const engineRef = useRef<SynthEngine<Patch> | null>(null);
  const runtimeRef = useRef<SynthRuntime<Patch> | null>(null);
  const runtimeUnsubscribeRef = useRef<(() => void) | null>(null);

  // ensureAudioReady is defined further down (it needs powerBusy state);
  // earlier handlers reach it through this ref.
  const ensureAudioReadyRef = useRef<((source?: StartGestureSource) => Promise<boolean>) | null>(
    null,
  );

  // ── Global performance settings (SETUP) ─────────────────────────────────
  // Bend range + confirm-preset-change live OUTSIDE the patch: they are
  // instrument-level preferences persisted in localStorage. Rendered with
  // defaults first (SSR-safe), real values applied right after mount.
  const [settings, setSettings] = useState<Tx27Settings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setupBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    setSettings(loadSettings());
  }, []);
  // Persist + push the bend range into the engine whenever settings change.
  // The first run (pre-load defaults) is skipped so stored settings are never
  // clobbered by the initial render.
  const settingsFirstRunRef = useRef(true);
  useEffect(() => {
    if (settingsFirstRunRef.current) {
      settingsFirstRunRef.current = false;
      return;
    }
    saveSettings(settings);
    engineRef.current?.setPitchBendRange(settings.bendRangeSemitones);
  }, [settings]);
  const updateSettings = useCallback((partial: Partial<Tx27Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  // Refs for audio-immediate pitch/mod updates; visual React state is throttled
  // to one update per animation frame to avoid flooding the render queue.
  const pitchBendRef = useRef(0);
  const modWheelRef = useRef(0);
  const pitchRafRef = useRef<number | null>(null);
  const modRafRef = useRef<number | null>(null);

  const setParameter = useCallback((id: string, value: ParameterValue) => {
    setPatchState((prev) => {
      const next = setTx27Parameter(prev, id, value);
      engineRef.current?.setParameter(id, value);
      return next;
    });
  }, []);

  const setParameters = useCallback((updates: Readonly<Record<string, ParameterValue>>) => {
    setPatchState((prev) => {
      const next = setTx27Parameters(prev, updates);
      engineRef.current?.loadState(next);
      return next;
    });
  }, []);

  // Performance controls: DSP update is immediate via engineRef; React visual
  // state is throttled to at most one update per animation frame.
  //
  // NOTE: the strips deliberately do NOT initiate audio startup. In PLAY
  // portrait they sit exactly where a thumb lands while gripping the phone,
  // and an incidental brush at launch used to fire a "gesture" start attempt
  // before the mobile audio session was warm — producing the STARTING →
  // AUDIO START FAILED sequence with no intentional interaction. Bend/mod
  // are meaningless without a sounding note anyway; audio arms on keys,
  // POWER, preset load, or PLAY-mode entry instead.
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

  const [powerBusy, setPowerBusy] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [audioState, setAudioState] = useState<AudioInitState>("idle");

  // Launch diagnostics (local-only; readable in SETUP → STARTUP DIAGNOSTICS).
  // A normal launch records app_loaded_armed and NOTHING audio-related —
  // audio work begins only when a genuine gesture arrives.
  useEffect(() => {
    initStartupDiagnostics();
    recordStartupPhase("app_loaded_armed");
  }, []);

  // First-note / first-attempt bookkeeping for the startup diagnostic trace.
  const firstNoteDiagRef = useRef({ queued: false, played: false });
  const firstStartRecordedRef = useRef(false);

  // Reflect REAL AudioContext state transitions (running/suspended/
  // interrupted/closed) into the UI, so POWER can never claim ON while the
  // context is actually suspended — backgrounding, screen lock, phone calls.
  const onRuntimeStatus = useCallback((status: SynthRuntimeStatus) => {
    recordStartupPhase("ctx:" + status.contextState);
    const running = status.phase === "ready" || status.contextState === "running";
    setPowered(running);
    if (running) {
      // A late resume after a timeout is authoritative: clear stale failure UI.
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

  // ── Centralized audio readiness ──────────────────────────────────────────
  // patchRef always mirrors the latest patch state so the readiness path can
  // apply the CURRENT patch regardless of when it was invoked (no stale
  // closure). Updated synchronously in loadPatch/init/randomize as well, so
  // an in-flight initialization always finishes with the newest patch.
  const patchRef = useRef(patch);
  patchRef.current = patch;
  // Single in-flight initialization promise — repeated calls (rapid preset
  // changes, key presses, control drags) all share the same promise, so the
  // engine is created exactly once and `powered` is settled exactly once.
  const readyPromiseRef = useRef<Promise<boolean> | null>(null);

  /** Idempotent audio readiness. Creates the engine and AudioContext if
   *  needed, resumes a suspended/interrupted context, disposes and REBUILDS
   *  a dead engine (closed context), applies the currently selected patch,
   *  and reflects the CONFIRMED engine state in `powered`/`audioState`.
   *
   *  Concurrency: all callers share one in-flight promise, so Strict Mode,
   *  POWER spam, and rapid gestures can never create duplicate engines. The
   *  whole attempt is BOUNDED — on failure or timeout the in-flight promise
   *  is cleared so the very next gesture retries cleanly. Because the first
   *  engine/resume step executes synchronously inside this call, invoking
   *  this from a pointer/keyboard handler satisfies mobile gesture policy.
   *  Resolves true when the engine is running. Never throws. */
  const ensureAudioReady = useCallback((source: StartGestureSource = "unknown"): Promise<boolean> => {
    if (engineRef.current?.isRunning()) return Promise.resolve(true);
    if (readyPromiseRef.current) return readyPromiseRef.current;
    const recovering = !!engineRef.current && !engineRef.current.isUsable();
    const resuming = !!engineRef.current && engineRef.current.isUsable();
    recordStartupPhase("gesture_start_attempt:" + source);
    if (!firstStartRecordedRef.current) {
      firstStartRecordedRef.current = true;
      if (source === "key") recordStartupPhase("key_first_start");
      else if (source === "power") recordStartupPhase("power_first_start");
    }
    if (recovering) recordStartupPhase("rebuild_attempt");
    else if (resuming) recordStartupPhase("resume_attempt");

    if (!runtimeRef.current) {
      runtimeRef.current = new SynthRuntime<Patch>({
        timeoutMs: AUDIO_INIT_TIMEOUT_MS,
        createEngine: () => {
          const engine = TX27_PRODUCT.createEngine(
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
        // Apply the latest patch — it may have changed while starting.
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
        console.error("TX27 audio initialization failed:", err);
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
  ensureAudioReadyRef.current = ensureAudioReady;

  const powerOn = useCallback(async () => {
    if (powerBusy) return;
    setPowerBusy(true);
    try {
      await ensureAudioReady("power");
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
      // Clear all performance UI state — voices were stopped in the engine.
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
      if (pitchRafRef.current !== null) cancelAnimationFrame(pitchRafRef.current);
      if (modRafRef.current !== null) cancelAnimationFrame(modRafRef.current);
    };
  }, []);

  // ── Mobile PWA lifecycle ─────────────────────────────────────────────────
  // ONE listener set for the app's lifetime (empty deps; live state reached
  // through refs and stable setters — never re-registered on rerenders).
  // Backgrounding/pagehide releases every held note and the sustain latch so
  // nothing can stick while the context is frozen. Returning re-syncs POWER
  // with the REAL context state — iOS may have suspended, interrupted, or
  // closed it while away. Resume itself happens on the next user gesture
  // (autoplay policy forbids it from these callbacks); a closed context is
  // detected there by ensureAudioReady and rebuilt. Patches, settings, and
  // localStorage are untouched.
  useEffect(() => {
    const releaseForBackground = () => {
      engineRef.current?.setSustain(false);
      setSustain(false);
      for (const n of activeNotesRef.current) engineRef.current?.noteOff(n);
      pendingNotesRef.current.clear();
      setActiveNotes(new Set());
    };
    const syncFromEngine = () => {
      const eng = engineRef.current;
      recordStartupPhase(
        "resync:" + (eng ? eng.getRuntimeStatus().contextState : "no-engine"),
      );
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
    const onPageShow = (e: PageTransitionEvent) => {
      recordStartupPhase(e.persisted ? "pageshow:bfcache" : "pageshow");
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

  // Output meter
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

  // Notes played before the engine is running (first musical gesture powers
  // the synth on). Kept in a ref so a noteOff arriving while power-up is in
  // flight can cancel its note and never leave it stuck.
  const pendingNotesRef = useRef<Map<number, number>>(new Map());

  const noteOn = useCallback(
    (note: number, vel = 0.9) => {
      const engine = engineRef.current;
      if (!engine || !engine.isRunning()) {
        // First intentional musical interaction: power on through the
        // authoritative engine lifecycle (this is a genuine user gesture, so
        // it satisfies iOS/Safari autoplay policies), then sound any notes
        // still held once the engine is confirmed running.
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
        void ensureAudioReady("key").then((ok) => {
          const eng = engineRef.current;
          if (!ok || !eng?.isRunning()) {
            // Init failed: drop pending notes and clear their highlights.
            // NOT silent — ensureAudioReady has set the failed state, so the
            // AUDIO START FAILED / RETRY banner is on screen.
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

  // Computer keyboard — registered regardless of power state so a mapped
  // key press can be the first gesture: it routes through noteOn, which
  // initializes audio and flushes the pending note (same as on-screen keys).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // Suspended while the library or a dialog is open (typing ≠ playing).
      // Note keyups below stay unguarded, so a note held across an overlay
      // opening still gets its noteOff — nothing can stick.
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
      // Space on the LCD's central button = native button activation (opens
      // quick access). Space-sustain still applies everywhere else.
      if (e.key === " " && t === lcdBtnRef.current) return;
      if (e.key === " ") {
        e.preventDefault();
        setSustain(true);
        engineRef.current?.setSustain(true);
        return;
      }
      if (e.key === "z") { setOctave((o) => Math.max(1, o - 1)); return; }
      if (e.key === "x") { setOctave((o) => Math.min(7, o + 1)); return; }
      const off = KB_MAP[e.key.toLowerCase()];
      if (off != null) noteOn(12 * (octave + 1) + off, 0.9);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") { setSustain(false); engineRef.current?.setSustain(false); return; }
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

  // Authoritative preset-application path. UI state and DSP are updated from
  // the same cloned patch; patchRef is set synchronously so an in-flight or
  // newly triggered initialization always finishes with THIS patch (rapid
  // preset changes simply overwrite patchRef — last one wins, no race).
  // Selecting a preset is a valid first gesture: audio initializes if needed.
  const applyPatch = useCallback(
    (p: Patch) => {
      const cloned = clonePatch(p);
      patchRef.current = cloned;
      setPatchState(cloned);
      const eng = engineRef.current;
      if (eng?.isRunning()) eng.loadState(cloned);
      else void ensureAudioReady("preset");
    },
    [ensureAudioReady],
  );

  // Release every sounding and pending note through the normal noteOff path
  // (engine, sustain system, and key highlights stay consistent). Runs right
  // before the library overlay opens so nothing is left stuck underneath it.
  const releaseAllNotes = useCallback(() => {
    for (const n of activeNotesRef.current) engineRef.current?.noteOff(n);
    pendingNotesRef.current.clear();
    setActiveNotes(new Set());
  }, []);

  // All preset/library state and behavior (factory + user entries, favorites,
  // recent, unsaved-change detection, dialogs, import/export) lives here.
  // The CONFIRM PRESET CHANGE setting reaches the library through a ref so
  // toggling it never re-renders or re-wires the library hook.
  const confirmDiscardRef = useRef(true);
  confirmDiscardRef.current = settings.confirmPresetChange;
  const library = usePatchLibrary({
    patch,
    applyPatch,
    uiModeRef,
    onBeforeOpen: releaseAllNotes,
    confirmDiscardRef,
  });
  // Quick-access panel state (anchored under the preset LCD). While it is
  // open the computer-keyboard piano is suspended, same as the full library —
  // keyups stay unguarded so a held note can never stick.
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);
  const presetSurfaceRef = useRef<HTMLDivElement | null>(null);
  uiBlockedRef.current =
    library.libraryOpen ||
    library.dialog.kind !== "none" ||
    quickAccessOpen ||
    settingsOpen;

  // INIT and RND are deliberate resets: silent (no discard prompt), and the
  // result reads UNSAVED in the LCD until stored via Save As.
  const initPatch = () => {
    const p = clonePatch(INIT_PATCH);
    applyPatch(p);
    library.markUnsaved(p);
  };
  const randomize = () => {
    const p = randomizePatch(patch);
    applyPatch(p);
    library.markUnsaved(p);
  };

  // A11y: focus returns to the LCD's central button (declared above with the
  // key-handler refs) when the full library or quick-access panel closes.
  const wasLibraryOpenRef = useRef(false);
  useEffect(() => {
    if (wasLibraryOpenRef.current && !library.libraryOpen) lcdBtnRef.current?.focus();
    wasLibraryOpenRef.current = library.libraryOpen;
  }, [library.libraryOpen]);
  const wasQuickAccessOpenRef = useRef(false);
  useEffect(() => {
    // When quick access closed because the full library opened from it, the
    // library's focus trap takes over; the LCD regains focus when THAT closes.
    if (wasQuickAccessOpenRef.current && !quickAccessOpen && !library.libraryOpen)
      lcdBtnRef.current?.focus();
    wasQuickAccessOpenRef.current = quickAccessOpen;
  }, [quickAccessOpen, library.libraryOpen]);
  // Same pattern for the SETUP dialog: focus returns to its opener.
  const wasSettingsOpenRef = useRef(false);
  useEffect(() => {
    if (wasSettingsOpenRef.current && !settingsOpen) setupBtnRef.current?.focus();
    wasSettingsOpenRef.current = settingsOpen;
  }, [settingsOpen]);

  // Switch UI mode. Before the Keyboard unmounts (entering EDIT), release
  // every pointer-owned note through the normal noteOff path so no note gets
  // stuck — engine, sustain system, and key highlights all stay consistent.
  // Engine, AudioContext, DSP, preset, bend range, pitch/MOD are untouched.
  const switchUiMode = useCallback((mode: Tx27UiMode) => {
    if (mode === uiModeRef.current) return;
    if (mode === "editor") {
      // Release notes through the normal path; sustain system handles held
      // sustain correctly. Then clear highlights.
      for (const n of activeNotesRef.current) engineRef.current?.noteOff(n);
      setActiveNotes(new Set());
    }
    if (mode === "performance") {
      // Entering Play mode is a valid first gesture for audio readiness.
      void ensureAudioReadyRef.current?.("play_mode");
    }
    try {
      localStorage.setItem(UI_MODE_KEY, mode);
    } catch {
      /* noop */
    }
    setUiModeState(mode);
  }, []);

  const panic = useCallback(() => {
    engineRef.current?.panic();            // stops voices, engine resets pitch bend
    setActiveNotes(new Set());             // clear key highlights
    pitchBendRef.current = 0;
    setPitchBend(0);                       // reset visual strip to centre
    if (pitchRafRef.current !== null) {
      cancelAnimationFrame(pitchRafRef.current);
      pitchRafRef.current = null;
    }
    // MOD wheel is intentionally NOT reset — it is a latching control.
  }, []);

  const vintageClass = patch.vintage.enabled && patch.vintage.age > 0.1 ? "vintage-active" : "";

  return (
    <div
      className={`h-[100dvh] w-full flex flex-col overflow-hidden ${vintageClass}`}
      style={{
        background:
          "radial-gradient(ellipse at top, #2a2724 0%, #16130f 80%), #0a0908",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* TOP BAR — logo, mode switch, power, panic. The patch display, meter
          and audio-error indicator live in the dedicated preset LCD below, so
          this row stays compact on every width. */}
      <header className="flex items-center gap-2 px-3 py-2 border-b border-black/60"
        style={{ background: "linear-gradient(180deg, #262320 0%, #1a1815 100%)" }}>
        <div className="flex flex-col shrink-0">
          <div className="text-[10px] tracking-[0.3em] text-tx-muted leading-none">TXPPS</div>
          <div className="text-base font-bold tracking-widest text-tx-cream leading-tight">TX27</div>
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
                  ? "READY" /* armed: launch state, first gesture unlocks audio */
                  : "POWER"}
        </button>
        <button className="tx-btn shrink-0" onClick={panic} style={{ color: "var(--tx-red)" }}>
          PANIC
        </button>
      </header>

      {/* AUDIO START FAILED — compact themed recovery strip. The rest of the
          instrument stays alive; RETRY runs the same guarded init path (which
          rebuilds a dead engine if needed). Never shown during normal use. */}
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

      {/* PRESET LCD — one integrated hardware display: ◀ patch-info ★ ▶ with
          the themed quick-access panel anchored beneath it (replaces the old
          native select + separate arrow/★/LIBRARY buttons). Row 2 keeps the
          patch actions (hidden in PLAY). All loading still goes through the
          guarded requestLoad path with stable preset IDs, so renames and
          deletes never shift the selection. */}
      <div className="px-2 py-1.5 border-b border-black/50 bg-tx-panel-dark flex flex-col gap-1">
        <div ref={presetSurfaceRef} className="relative">
          <PresetLCD
            library={library}
            patch={patch}
            audioError={audioError}
            meterSlot={uiMode !== "performance" ? <MeterBar value={meter} /> : undefined}
            quickAccessOpen={quickAccessOpen}
            onToggleQuickAccess={() => setQuickAccessOpen((o) => !o)}
            centerRef={lcdBtnRef}
          />
          {quickAccessOpen && (
            <PresetQuickAccess
              library={library}
              anchorRef={presetSurfaceRef}
              onSelect={(id) => {
                setQuickAccessOpen(false);
                library.requestLoad(id);
              }}
              onOpenLibrary={() => {
                setQuickAccessOpen(false);
                library.openLibrary();
              }}
              onClose={() => setQuickAccessOpen(false)}
            />
          )}
        </div>
        {uiMode !== "performance" && (
          <div className="flex items-center gap-1">
            <button className="tx-btn flex-1" onClick={library.beginSaveAs}>SAVE AS</button>
            <button
              className="tx-btn flex-1 disabled:opacity-40"
              onClick={() => library.activeId && library.beginRename(library.activeId)}
              disabled={!library.activeIsUser}
            >
              REN
            </button>
            <button
              className="tx-btn flex-1 disabled:opacity-40"
              onClick={() => library.activeId && library.beginDelete(library.activeId)}
              disabled={!library.activeIsUser}
            >
              DEL
            </button>
            <button className="tx-btn flex-1" onClick={initPatch}>INIT</button>
            <button className="tx-btn flex-1" onClick={randomize}>RND</button>
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
        {/* Tab strip - mobile */}
        <div className={`flex gap-1 px-2 py-1.5 md:hidden ${uiMode === "performance" ? "hidden" : ""}`}>
          {(["ops", "algo", "voice", "mix", "vintage", "fx"] as Tab[]).map((t) => (
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
          className={`flex-1 min-h-0 overflow-auto px-2 py-2 grid gap-2 md:grid-cols-12 md:grid-rows-[auto_auto] ${
            uiMode === "performance" ? "hidden md:hidden" : ""
          }`}
        >
          {/* Operators */}
          <section
            className={`tx-panel p-2 md:col-span-7 md:row-span-2 ${tab !== "ops" ? "hidden md:block" : ""}`}
          >
            <PanelTitle>OPERATORS</PanelTitle>
            <div className="flex gap-1 mb-2">
              {[0, 1, 2, 3].map((i) => (
                <button
                  key={i}
                  className={`tx-btn flex-1 ${selectedOp === i ? "tx-btn-active" : ""} ${!patch.operators[i].enabled ? "opacity-50" : ""}`}
                  onClick={() => setSelectedOp(i)}
                >
                  OP{i + 1}
                </button>
              ))}
            </div>
            <OperatorEditor
              op={patch.operators[selectedOp]}
              opIndex={selectedOp}
              onChange={(o) => {
                const updates: Record<string, ParameterValue> = {};
                for (const [key, value] of Object.entries(o)) {
                  if (value !== undefined) updates[`op${selectedOp + 1}.${key}`] = value;
                }
                setParameters(updates);
              }}
            />
            <div className="mt-3 text-[9px] tracking-[0.3em] text-tx-muted pb-1 border-b border-black/40">
              GLOBAL · ALL OPERATORS
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <Knob label="FM DEPTH" value={patch.fmDepth} min={0} max={1} onChange={(v) => setParameter("fm.depth", v)} format={(v) => (v * 100).toFixed(0)} />
              <Knob label="FEEDBACK" value={patch.feedback} min={0} max={0.8} onChange={(v) => setParameter("fm.feedback", v)} format={(v) => (v * 100).toFixed(0)} />
              <Knob label="VEL SENS" value={patch.velocitySens} min={0} max={1} onChange={(v) => setParameter("velocity.sensitivity", v)} format={(v) => (v * 100).toFixed(0)} />
              <Knob label="M.ATK" value={patch.masterAttack} min={0} max={1} onChange={(v) => setParameter("envelope.masterAttack", v)} format={(v) => v.toFixed(2)} />
            </div>
          </section>

          {/* Algorithm */}
          <section className={`tx-panel p-2 md:col-span-5 ${tab !== "algo" ? "hidden md:block" : ""}`}>
            <PanelTitle>ALGORITHM {patch.algorithm}</PanelTitle>
            <div className="flex gap-2 items-stretch">
              <div className="tx-lcd-box flex-1 aspect-square max-h-56">
                <AlgorithmView
                  id={patch.algorithm}
                  active={powered && activeNotes.size > 0}
                />
              </div>
              <div className="grid grid-cols-2 gap-1 flex-1">
                {ALGORITHMS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setParameter("algo", a.id)}
                    className={`tx-btn ${patch.algorithm === a.id ? "tx-btn-active" : ""}`}
                  >
                    {a.id}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[10px] text-tx-muted text-center mt-1 tracking-widest">
              {ALGORITHMS[patch.algorithm - 1].name}
            </div>
          </section>

          {/* VOICE — voice allocation, portamento, filter, performance prefs */}
          <section className={`tx-panel p-2 md:col-span-5 ${tab !== "voice" ? "hidden md:block" : ""}`}>
            <PanelTitle>VOICE · FILTER</PanelTitle>
            <div className="flex gap-1 mb-2">
              <button
                className={`tx-btn flex-1 ${patch.voiceMode === "poly" ? "tx-btn-active" : ""}`}
                onClick={() => setParameter("voice.mode", "poly")}
              >POLY</button>
              <button
                className={`tx-btn flex-1 ${patch.voiceMode === "mono" ? "tx-btn-active" : ""}`}
                onClick={() => setParameter("voice.mode", "mono")}
              >MONO</button>
              {([4, 8, 12] as const).map((n) => (
                <button
                  key={n}
                  className={`tx-btn flex-1 ${patch.polyphony === n ? "tx-btn-active" : ""}`}
                  onClick={() => setParameter("voice.polyphony", n)}
                >{n}V</button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="text-[10px] tracking-widest text-tx-muted shrink-0"
                title="Global setting — applies to every preset, never saved with patches"
              >
                BEND RANGE
              </div>
              <TxSelect
                value={settings.bendRangeSemitones}
                options={BEND_OPTIONS}
                onChange={(v) => updateSettings({ bendRangeSemitones: v })}
                className="flex-1 min-w-0 text-center"
                ariaLabel="Global pitch bend range in semitones"
              />
            </div>
            <div className="flex items-center gap-1 mb-2">
              <div className="text-[10px] tracking-widest text-tx-muted shrink-0 mr-1">GLIDE</div>
              {(
                [
                  ["off", "OFF", "No glide — notes start exactly at pitch"],
                  ["poly", "POLY", "Every new note glides from the last played pitch"],
                  ["mono", "LEGATO", "Mono legato — overlapping notes glide, one voice"],
                ] as const
              ).map(([mode, label, hint]) => (
                <button
                  key={mode}
                  className={`tx-btn flex-1 ${patch.glideMode === mode ? "tx-btn-active" : ""}`}
                  onClick={() => setParameter("glide.mode", mode)}
                  aria-pressed={patch.glideMode === mode}
                  title={hint}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Knob label="GLIDE" value={patch.glide} min={0} max={0.5} onChange={(v) => setParameter("glide.time", v)} format={(v) => v.toFixed(2)} />
              <Knob label="CUTOFF" taper="log" value={patch.filter.cutoff} min={80} max={18000} onChange={(v) => setParameter("filter.cutoff", v)} format={(v) => v < 1000 ? v.toFixed(0) : (v / 1000).toFixed(1) + "k"} />
              <Knob label="RESO" value={patch.filter.resonance} min={0} max={1} onChange={(v) => setParameter("filter.resonance", v)} format={(v) => (v * 100).toFixed(0)} />
            </div>
          </section>

          {/* Vintage */}
          <section className={`tx-panel p-2 md:col-span-7 ${tab !== "vintage" ? "hidden md:block" : ""}`}>
            <div className="flex items-center justify-between mb-2">
              <PanelTitle>VINTAGE CIRCUIT</PanelTitle>
              <button
                className={`tx-btn ${patch.vintage.enabled ? "tx-btn-active" : ""}`}
                onClick={() => setParameter("vintage.enabled", !patch.vintage.enabled)}
              >{patch.vintage.enabled ? "ON" : "OFF"}</button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range" min={0} max={1} step={0.001}
                value={patch.vintage.age}
                onChange={(e) => setParameter("vintage.age", Number(e.target.value))}
                className="flex-1 h-8 tx-range"
                // Dev-tooling instrumentation injects a phantom style prop on
                // this node in some environments, tripping a false-positive
                // hydration warning; server HTML is verified correct.
                suppressHydrationWarning
              />
              <div className="tx-lcd-box px-2 py-1 min-w-16 text-center">
                <div className="text-[8px] opacity-60 leading-none">AGE</div>
                <div className="text-lg font-bold leading-none">{Math.round(patch.vintage.age * 100)}%</div>
              </div>
            </div>
            <div className="text-[10px] text-tx-muted mt-1 tracking-widest text-center">
              {ageLabel(patch.vintage.age)}
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
                {(
                  [
                    ["WARMTH", "warmth"],
                    ["GRAIN", "grain"],
                    ["WEAR", "wear"],
                    ["DRIFT", "drift"],
                    ["NOISE", "noise"],
                    ["ST.AGE", "stereoAge"],
                    ["DRIVE", "drive"],
                  ] as const
                ).map(([label, key]) => (
                  <Knob
                    key={key}
                    label={label}
                    value={patch.vintage[key]}
                    min={0}
                    max={1}
                    onChange={(v) => setParameter(`vintage.${key}`, v)}
                    format={(v) => (v * 100).toFixed(0)}
                  />
                ))}
            </div>
          </section>

          {/* MIX — output level and FX send levels only. The send knobs are
              the same parameters as the wet/amount knobs on the FX page
              (single source of truth), surfaced here as a mixer view. */}
          <section className={`tx-panel p-2 md:col-span-5 ${tab !== "mix" ? "hidden md:block" : ""}`}>
            <PanelTitle>MIX · OUTPUT</PanelTitle>
            <div className="grid grid-cols-4 gap-2">
              <Knob label="VOLUME" value={patch.masterVolume} min={0} max={1} onChange={(v) => setParameter("master.volume", v)} format={(v) => (v * 100).toFixed(0)} />
              <div className={patch.chorus.enabled ? "" : "opacity-40"} title={patch.chorus.enabled ? undefined : "Chorus is OFF (FX page)"}>
                <Knob label="CHO SEND" value={patch.chorus.amount} min={0} max={1} onChange={(v) => setParameter("fx.chorus.amount", v)} format={(v) => (v * 100).toFixed(0)} />
              </div>
              <div className={patch.delay.enabled ? "" : "opacity-40"} title={patch.delay.enabled ? undefined : "Delay is OFF (FX page)"}>
                <Knob label="DLY SEND" value={patch.delay.mix} min={0} max={1} onChange={(v) => setParameter("fx.delay.mix", v)} format={(v) => (v * 100).toFixed(0)} />
              </div>
              <div className={patch.reverb.enabled ? "" : "opacity-40"} title={patch.reverb.enabled ? undefined : "Reverb is OFF (FX page)"}>
                <Knob label="REV SEND" value={patch.reverb.mix} min={0} max={1} onChange={(v) => setParameter("fx.reverb.mix", v)} format={(v) => (v * 100).toFixed(0)} />
              </div>
            </div>
            <div className="text-[9px] text-tx-muted mt-2 tracking-widest text-center">
              SENDS MIRROR THE FX PAGE WET LEVELS
            </div>
          </section>

          {/* FX */}
          <section className={`tx-panel p-2 md:col-span-12 ${tab !== "fx" ? "hidden md:block" : ""}`}>
            <PanelTitle>EFFECTS</PanelTitle>
            <div className="grid gap-2 md:grid-cols-3">
              {/* Chorus */}
              <div className="tx-panel p-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] tracking-widest text-tx-muted">CHORUS</div>
                  <button
                    className={`tx-btn ${patch.chorus.enabled ? "tx-btn-active" : ""}`}
                    onClick={() => setParameter("fx.chorus.enabled", !patch.chorus.enabled)}
                  >{patch.chorus.enabled ? "ON" : "OFF"}</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Knob label="AMT" value={patch.chorus.amount} min={0} max={1} onChange={(v) => setParameter("fx.chorus.amount", v)} format={(v) => (v * 100).toFixed(0)} />
                  <Knob label="RATE" value={patch.chorus.rate} min={0.05} max={8} onChange={(v) => setParameter("fx.chorus.rate", v)} format={(v) => v.toFixed(2)} />
                  <Knob label="DEPTH" value={patch.chorus.depth} min={0} max={0.01} step={0.0001} onChange={(v) => setParameter("fx.chorus.depth", v)} format={(v) => (v * 1000).toFixed(1)} />
                </div>
              </div>
              {/* Delay */}
              <div className="tx-panel p-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] tracking-widest text-tx-muted">DELAY</div>
                  <button
                    className={`tx-btn ${patch.delay.enabled ? "tx-btn-active" : ""}`}
                    onClick={() => setParameter("fx.delay.enabled", !patch.delay.enabled)}
                  >{patch.delay.enabled ? "ON" : "OFF"}</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Knob label="TIME" value={patch.delay.time} min={0.02} max={1.2} onChange={(v) => setParameter("fx.delay.time", v)} format={(v) => (v * 1000).toFixed(0)} />
                  <Knob label="FB" value={patch.delay.feedback} min={0} max={0.85} onChange={(v) => setParameter("fx.delay.feedback", v)} format={(v) => (v * 100).toFixed(0)} />
                  <Knob label="MIX" value={patch.delay.mix} min={0} max={1} onChange={(v) => setParameter("fx.delay.mix", v)} format={(v) => (v * 100).toFixed(0)} />
                </div>
              </div>
              {/* Reverb */}
              <div className="tx-panel p-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] tracking-widest text-tx-muted">REVERB</div>
                  <button
                    className={`tx-btn ${patch.reverb.enabled ? "tx-btn-active" : ""}`}
                    onClick={() => setParameter("fx.reverb.enabled", !patch.reverb.enabled)}
                  >{patch.reverb.enabled ? "ON" : "OFF"}</button>
                </div>
                <div className="flex gap-1 mb-2">
                  {(["digital", "hall", "glass"] as const).map((t) => (
                    <button
                      key={t}
                      className={`tx-btn flex-1 ${patch.reverb.type === t ? "tx-btn-active" : ""}`}
                      onClick={() => setParameter("fx.reverb.type", t)}
                    >{t === "digital" ? "DIG" : t === "hall" ? "HALL" : "GLASS"}</button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Knob label="MIX" value={patch.reverb.mix} min={0} max={1} onChange={(v) => setParameter("fx.reverb.mix", v)} format={(v) => (v * 100).toFixed(0)} />
                  <Knob label="SIZE" value={patch.reverb.size} min={0} max={1} onChange={(v) => setParameter("fx.reverb.size", v)} format={(v) => (v * 100).toFixed(0)} />
                  <Knob label="DECAY" value={patch.reverb.decay} min={0} max={1} onChange={(v) => setParameter("fx.reverb.decay", v)} format={(v) => (v * 100).toFixed(0)} />
                  <Knob label="PRE" value={patch.reverb.preDelay} min={0} max={0.2} onChange={(v) => setParameter("fx.reverb.preDelay", v)} format={(v) => (v * 1000).toFixed(0)} />
                  <Knob label="DAMP" value={patch.reverb.damping} min={0} max={1} onChange={(v) => setParameter("fx.reverb.damping", v)} format={(v) => (v * 100).toFixed(0)} />
                  <Knob label="WIDTH" value={patch.reverb.width} min={0} max={1} onChange={(v) => setParameter("fx.reverb.width", v)} format={(v) => (v * 100).toFixed(0)} />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* PERFORMANCE AREA — single Keyboard instance, shared by FULL and
            PLAY. Fully unmounted (no gap) in EDIT; pointer-owned notes are
            released in switchUiMode before this unmounts.

            Layout rules (documented in REFINEMENT-REPORT.md):
            · PLAY + phone portrait: vertical stack — compact control bar on
              top, then horizontal PITCH/MOD strips, then a half-height
              keyboard (min(15vh,125px)) anchored to the bottom so black keys
              stay in easy reach. minKeyWidth 34 → wide, comfortable keys.
            · PLAY otherwise: original side-column layout, minKeyWidth 30.
            · FULL + phone portrait: shorter keyboard (18vh, 110–170px) with
              minKeyWidth 30 → wider keys, reduced range, controls above stay
              usable.
            · FULL otherwise / desktop: original 26vh strip, minKeyWidth 24.
            The Keyboard itself measures its container and shows 14, 10 or 7
            white keys — the widest range that keeps keys ≥ minKeyWidth. */}
        {uiMode !== "editor" && (() => {
          const playPortrait = uiMode === "performance" && isPortrait && isNarrow;
          const fullPortrait = uiMode === "full" && isPortrait && isNarrow;
          const minKeyWidth =
            uiMode === "performance" ? (playPortrait ? 34 : 30) : fullPortrait ? 30 : 24;

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
              onPointerDown={() => { setSustain(true); engineRef.current?.setSustain(true); }}
              onPointerUp={() => { setSustain(false); engineRef.current?.setSustain(false); }}
              onPointerLeave={() => { if (sustain) { setSustain(false); engineRef.current?.setSustain(false); } }}
            >SUS</button>
          );

          return (
            <div
              className={`border-t border-black/60 bg-tx-panel-dark px-2 pt-2 pb-2 ${
                uiMode === "performance" ? "flex-1 min-h-0 flex flex-col" : "shrink-0"
              }`}
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
            >
              {playPortrait ? (
                /* PLAY · phone portrait — controls in one horizontal bar,
                   then horizontal PITCH and MOD strips, then the keyboard
                   anchored to the bottom (thumb zone). Height is roughly half
                   the old size (was min(30vh,250px)/180) so black keys sit
                   within easy thumb reach. */
                <div className="flex-1 min-h-0 flex flex-col gap-2" style={{ minHeight: 200 }}>
                  <div className="flex gap-1 shrink-0" style={{ height: 44 }}>
                    <button className="tx-btn flex-1" onClick={() => setOctave((o) => Math.max(1, o - 1))}>OCT −</button>
                    <div className="tx-lcd-box flex items-center justify-center px-3 text-xs">C{octave}</div>
                    <button className="tx-btn flex-1" onClick={() => setOctave((o) => Math.min(7, o + 1))}>OCT +</button>
                    {bendSelect}
                    {sustainBtn("flex-1")}
                  </div>
                  <div className="shrink-0" style={{ height: 40 }}>
                    <PerfStrip label="PITCH" value={pitchBend} bipolar horizontal onChange={handlePitchChange} onRelease={handlePitchRelease} />
                  </div>
                  <div className="shrink-0" style={{ height: 40 }}>
                    <PerfStrip label="MOD" value={modWheel} horizontal onChange={handleModChange} />
                  </div>
                  <div
                    className="mt-auto shrink-0"
                    style={{ height: "min(15vh, 125px)", minHeight: 90 }}
                  >
                    <Keyboard octave={octave} onNoteOn={noteOn} onNoteOff={noteOff} activeNotes={activeNotes} minKeyWidth={minKeyWidth} />
                  </div>
                </div>
              ) : (
                <div
                  className={`flex gap-2 items-stretch ${uiMode === "performance" ? "flex-1 min-h-0" : ""}`}
                  style={
                    uiMode === "performance"
                      ? { minHeight: 170 }
                      : fullPortrait
                        ? { height: "18vh", minHeight: 110, maxHeight: 170 }
                        : { height: "26vh", minHeight: 170, maxHeight: 260 }
                  }
                >
                  <div className="flex flex-col gap-1 shrink-0" style={{ width: 44 }}>
                    <div className="flex-1"><PerfStrip label="PITCH" value={pitchBend} bipolar onChange={handlePitchChange} onRelease={handlePitchRelease} /></div>
                    <div className="flex-1"><PerfStrip label="MOD" value={modWheel} onChange={handleModChange} /></div>
                  </div>
                  {/* Vertical stack: raise on top, lower below — matches how
                      pitch is spatially reasoned about on hardware. */}
                  <div className="flex flex-col gap-1 shrink-0" style={{ width: 60 }}>
                    <button className="tx-btn flex-1" onClick={() => setOctave((o) => Math.min(7, o + 1))}>OCT +</button>
                    <button className="tx-btn flex-1" onClick={() => setOctave((o) => Math.max(1, o - 1))}>OCT −</button>
                    <div className="tx-lcd-box text-center py-1 text-xs">C{octave}</div>
                    {uiMode === "performance" && bendSelect}
                    {sustainBtn("flex-1")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Keyboard octave={octave} onNoteOn={noteOn} onNoteOff={noteOff} activeNotes={activeNotes} minKeyWidth={minKeyWidth} />
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </main>

      {/* ── PATCH LIBRARY OVERLAY + THEMED DIALOGS ──────────────────────────
          Dialogs stack above the library (z-80 vs z-60) and are also
          reachable without it (SAVE AS / REN / DEL in the preset bar).
          No browser prompt()/confirm()/alert() anywhere. */}
      {library.libraryOpen && (
        <PatchLibrary controller={library} isNarrow={isNarrow} isPortrait={isPortrait} />
      )}
      {library.dialog.kind === "saveAs" && (
        <PatchSaveDialog
          mode="save"
          defaults={library.saveDefaults}
          suggestedTags={library.allTags}
          onSubmit={library.submitSaveAs}
          onCancel={library.cancelDialog}
        />
      )}
      {library.dialog.kind === "rename" && (
        <PatchSaveDialog
          mode="rename"
          defaults={{
            ...library.saveDefaults,
            name: library.getEntry(library.dialog.id)?.meta.name ?? "",
          }}
          suggestedTags={[]}
          onSubmit={(f) => library.submitRename(f.name)}
          onCancel={library.cancelDialog}
        />
      )}
      {library.dialog.kind === "confirmDelete" && (
        <PatchConfirmDialog
          title="DELETE PRESET"
          message={`DELETE "${(library.getEntry(library.dialog.id)?.meta.name ?? "").toUpperCase()}"? THIS CANNOT BE UNDONE.`}
          onCancel={library.cancelDialog}
          actions={[
            { label: "CANCEL", onSelect: library.cancelDialog },
            { label: "DELETE", tone: "danger", onSelect: library.confirmDelete },
          ]}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {library.dialog.kind === "confirmDiscard" && (
        <PatchConfirmDialog
          title="UNSAVED CHANGES"
          message={`"${patch.name.toUpperCase()}" HAS UNSAVED CHANGES. LOAD "${(
            library.getEntry(library.dialog.targetId)?.meta.name ?? ""
          ).toUpperCase()}" ANYWAY?`}
          onCancel={library.cancelDialog}
          actions={[
            { label: "CANCEL", onSelect: library.cancelDialog },
            { label: "SAVE AS…", onSelect: library.discardToSaveAs },
            { label: "DISCARD", tone: "danger", onSelect: library.confirmDiscard },
          ]}
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

function MeterBar({ value }: { value: number }) {
  const segs = 8;
  const on = Math.round(value * segs * 1.4);
  return (
    <div className="flex gap-[2px] shrink-0">
      {Array.from({ length: segs }).map((_, i) => {
        const active = i < on;
        const isHigh = i >= segs - 2;
        return (
          <div
            key={i}
            style={{
              width: 3,
              height: 14,
              background: active ? (isHigh ? "var(--tx-red)" : "var(--tx-lcd)") : "rgba(255,255,255,0.06)",
              boxShadow: active ? `0 0 4px ${isHigh ? "var(--tx-red)" : "var(--tx-lcd)"}` : "none",
              borderRadius: 1,
            }}
          />
        );
      })}
    </div>
  );
}

function OperatorEditor({
  op,
  opIndex,
  onChange,
}: {
  op: Patch["operators"][number];
  opIndex: number;
  onChange: (o: Partial<Patch["operators"][number]>) => void;
}) {
  return (
    <div>
      <div className="flex gap-1 mb-2 items-center">
        <div className="text-[9px] tracking-[0.3em] text-tx-muted flex-1">
          OP{opIndex + 1} · THIS OPERATOR ONLY
        </div>
        <button
          className={`tx-btn ${op.enabled ? "tx-btn-active" : ""}`}
          onClick={() => onChange({ enabled: !op.enabled })}
        >{op.enabled ? "ON" : "MUTE"}</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Knob label="RATIO" value={op.ratio} min={0.25} max={16} step={0.01} onChange={(v) => onChange({ ratio: v })} format={(v) => v.toFixed(2)} />
        <Knob label="DETUNE" value={op.detune} min={-50} max={50} step={0.5} onChange={(v) => onChange({ detune: v })} format={(v) => v.toFixed(0)} />
        <Knob label="LEVEL" value={op.level} min={0} max={1} onChange={(v) => onChange({ level: v })} format={(v) => (v * 100).toFixed(0)} />
        <Knob label="ATK" value={op.attack} min={0.001} max={4} onChange={(v) => onChange({ attack: v })} format={(v) => v.toFixed(2)} />
        <Knob label="DEC" value={op.decay} min={0.01} max={4} onChange={(v) => onChange({ decay: v })} format={(v) => v.toFixed(2)} />
        <Knob label="SUS" value={op.sustain} min={0} max={1} onChange={(v) => onChange({ sustain: v })} format={(v) => (v * 100).toFixed(0)} />
        <Knob label="REL" value={op.release} min={0.01} max={4} onChange={(v) => onChange({ release: v })} format={(v) => v.toFixed(2)} />
      </div>
    </div>
  );
}

function ageLabel(age: number): string {
  if (age <= 0.25) return "NEW OLD STOCK";
  if (age <= 0.6) return "CLASSIC DIGITAL";
  if (age <= 0.85) return "WELL USED";
  return "WORN MEMORY";
}
