/**
 * useAudioEngine — the ONLY bridge between the TX-80 application and the
 * audio runtime. As of Gate 2 it drives the transplanted synth-core stack:
 *
 *   Zustand store (authoritative UI params, src/state/params.ts ids)
 *     → src/synth-core/mapping.ts (id/vocabulary/unit translation)
 *       → TX80ProductEngine (SynthEngine<Tx80Patch>)
 *         → TX80Engine (dual-layer voices, allocator, FX, limiter)
 *           → one AudioContext → destination
 *
 * The retiring Milestone-2 engine in src/audio/ is QUARANTINED: nothing
 * imports it anymore (see docs/TX80_GATE2_RUNTIME_SWITCHOVER.md).
 *
 * Lifecycle: explicit states from SynthRuntime (idle | starting |
 * recovering | ready | suspended | failed | disposed), mapped onto the
 * store's audioStatus. Activation begins synchronously inside the user
 * gesture; every await is bounded; a failed attempt is retryable on the
 * next gesture (the old initializeAttempted latch is gone).
 *
 * Note ownership: the UI layer owns press identity (one entry per
 * pointerId in the Keyboard); the engine owns per-press instance counts
 * with LIFO same-note release and unique per-voice generation ids. Notes
 * played before the context is running are queued in SynthRuntime's
 * pending map and flushed on ready — a noteOff during startup cancels its
 * pending note, so a fast cold tap can neither stick nor ghost.
 */

import { useCallback, useEffect, useRef } from "react";
import { useSynthStore, type AudioStatus } from "@/state/store";
import type { PatchValues } from "@/state/params";
import { SynthRuntime } from "@/synth-core/runtime/runtime";
import type { SynthRuntimeStatus } from "@/synth-core/runtime/contracts";
import { TX80ProductEngine } from "@/synth-core/tx80/productAdapter";
import { setTx80Parameters } from "@/synth-core/tx80/parameters";
import { cloneTx80Patch, TX80_INIT_PATCH, type Tx80Patch } from "@/synth-core/tx80/types";
import { mapPatchToEngine, mapUiParamToEngine } from "@/synth-core/mapping";
import { diagError, diagInfo, diagWarn } from "@/lib/diagnostics/buffer";
import { getRuntimeDiagSnapshot, patchRuntimeDiag } from "@/lib/diagnostics/runtime";
import { loadTx80Settings } from "@/synth-core/tx80/storage";

/** Full UI patch → complete engine patch (engine-only ids keep their
 *  engine defaults; unmapped UI ids are intentionally dropped). */
export function buildEnginePatch(ui: PatchValues): Tx80Patch {
  return setTx80Parameters(cloneTx80Patch(TX80_INIT_PATCH), mapPatchToEngine(ui));
}

function toAudioStatus(status: SynthRuntimeStatus): AudioStatus {
  switch (status.phase) {
    case "ready":
      return "running";
    case "starting":
    case "recovering":
      return "starting";
    case "suspended":
      return "suspended";
    case "failed":
      return "failed";
    default:
      return "idle";
  }
}

// ── Development-only invariants (Phase 5) ──────────────────────────────────
// Counts real AudioContext constructions and asserts the singleton rule.
// Installed once per page, only in dev; production ships no wrapper and no
// logging. The read-only __TX80_DIAG hook below exists in all modes (it is
// how the e2e suite observes the runtime) and never mutates engine state.
let contextsCreated = 0;
function installDevContextGuard(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const w = window as unknown as { __tx80CtxGuard?: boolean };
  if (w.__tx80CtxGuard) return;
  w.__tx80CtxGuard = true;
  const Orig = window.AudioContext;
  if (!Orig) return;
  const Wrapped = function (this: AudioContext, ...args: unknown[]) {
    contextsCreated++;
    if (contextsCreated > 1) {
      console.error(
        `[TX80 DEV ASSERT] ${contextsCreated} AudioContexts constructed — the runtime must own exactly one.`,
      );
    }
    return new (Orig as unknown as new (...a: unknown[]) => AudioContext)(...args);
  };
  Wrapped.prototype = Orig.prototype;
  (window as unknown as { AudioContext: unknown }).AudioContext = Wrapped;
}

interface Tx80Diag {
  phase: string;
  contextState: string;
  running: boolean;
  activeVoices: number;
  pendingNotes: number;
  uiHeldPresses: number;
  contextsCreated: number;
  enginesCreated: number;
  engineId: string | null;
}

export function useAudioEngine() {
  const patch = useSynthStore((s) => s.patch);
  const sustainPedal = useSynthStore((s) => s.sustainPedal);
  const pitchBend = useSynthStore((s) => s.pitchBend);
  const modWheel = useSynthStore((s) => s.modWheel);
  const panicToken = useSynthStore((s) => s.panicToken);
  const setAudioStatus = useSynthStore((s) => s.setAudioStatus);

  const runtimeRef = useRef<SynthRuntime<Tx80Patch> | null>(null);
  const engineRef = useRef<TX80ProductEngine | null>(null);
  const runtimeUnsubRef = useRef<(() => void) | null>(null);
  const enginesCreatedRef = useRef(0);
  const phaseRef = useRef<string>("idle");

  const patchRef = useRef(patch);
  patchRef.current = patch;
  const sustainRef = useRef(sustainPedal);
  sustainRef.current = sustainPedal;
  const pitchBendRef = useRef(pitchBend);
  pitchBendRef.current = pitchBend;
  const modWheelRef = useRef(modWheel);
  modWheelRef.current = modWheel;

  // Mirror of live presses (midi → count) the hook has forwarded but not yet
  // released — used only for blur/visibility cleanup. Press identity itself
  // lives in the Keyboard (per pointerId) and in the engine (per instance).
  const heldRef = useRef<Map<number, number>>(new Map());

  const onRuntimeStatus = useCallback(
    (status: SynthRuntimeStatus) => {
      phaseRef.current = status.phase;
      setAudioStatus(toAudioStatus(status));
      patchRuntimeDiag({ audioPhase: status.phase, contextState: status.contextState });
      diagInfo("AUDIO", `runtime phase=${status.phase}`, { context: status.contextState });
      if (status.phase === "ready") {
        const engine = engineRef.current;
        engine?.loadState(buildEnginePatch(patchRef.current));
        engine?.setSustain(sustainRef.current);
        engine?.setPitchBend(pitchBendRef.current);
        engine?.setModulation(modWheelRef.current);
        try {
          engine?.setPitchBendRange(loadTx80Settings().bendRangeSemitones);
        } catch {
          /* settings unavailable */
        }
        const diag = engine?.getDiagnostics();
        patchRuntimeDiag({
          contextState: diag?.contextState ?? status.contextState,
          activeVoices: diag?.activeVoices ?? 0,
          enginesCreated: enginesCreatedRef.current,
          contextsCreated,
        });
        diagInfo("AUDIO", "engine ready");
      }
      if (status.phase === "failed") {
        diagError("AUDIO", "runtime failed", {
          message: status.error?.message?.slice(0, 200) ?? "unknown",
        });
      }
    },
    [setAudioStatus],
  );

  /** Lazily construct the runtime. No AudioContext exists until the first
   *  activation gesture reaches SynthRuntime.activate()/playNote(). */
  const ensureRuntime = useCallback((): SynthRuntime<Tx80Patch> => {
    if (runtimeRef.current) return runtimeRef.current;
    installDevContextGuard();
    const runtime = new SynthRuntime<Tx80Patch>({
      createEngine: () => {
        const engine = new TX80ProductEngine(buildEnginePatch(patchRef.current));
        engineRef.current = engine;
        enginesCreatedRef.current++;
        return engine;
      },
    });
    runtimeUnsubRef.current = runtime.subscribe(onRuntimeStatus);
    runtimeRef.current = runtime;
    return runtime;
  }, [onRuntimeStatus]);

  // Enable-pill / explicit activation. Retryable: SynthRuntime clears its
  // in-flight promise on settle, so the next gesture attempts again.
  const initialize = useCallback(() => {
    diagInfo("AUDIO", "activate requested");
    void ensureRuntime()
      .activate()
      .catch((err) => {
        diagError("AUDIO", "activate failed", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }, [ensureRuntime]);

  const handleNoteOn = useCallback(
    (midi: number, velocity: number) => {
      heldRef.current.set(midi, (heldRef.current.get(midi) ?? 0) + 1);
      patchRuntimeDiag({
        lastNoteOn: midi,
        pointerOwners: heldRef.current.size,
      });
      void ensureRuntime().playNote(midi, velocity);
    },
    [ensureRuntime],
  );

  const handleNoteOff = useCallback((midi: number) => {
    const count = heldRef.current.get(midi) ?? 0;
    if (count > 1) heldRef.current.set(midi, count - 1);
    else heldRef.current.delete(midi);
    patchRuntimeDiag({
      lastNoteOff: midi,
      pointerOwners: heldRef.current.size,
    });
    runtimeRef.current?.releaseNote(midi);
  }, []);

  // ── Authoritative parameter routing (store → mapping → engine) ──────────
  const prevPatchRef = useRef<PatchValues | null>(null);
  useEffect(() => {
    const prev = prevPatchRef.current;
    prevPatchRef.current = patch;
    const engine = engineRef.current;
    if (!engine || !engine.isUsable()) return;
    if (prev === null || prev === patch) return;
    const changed = Object.keys(patch).filter((id) => patch[id] !== prev[id]);
    if (changed.length === 0) return;
    if (changed.length > 24) {
      engine.loadState(buildEnginePatch(patch));
      diagInfo("PATCH", "preset-scale load", { changed: changed.length });
      return;
    }
    for (const uiId of changed) {
      const updates = mapUiParamToEngine(uiId, patch[uiId], patch);
      if (Object.keys(updates).length === 0) {
        diagWarn("PATCH", `unmapped or lossy param ${uiId}`, { value: String(patch[uiId]) });
      }
      for (const [engineId, value] of Object.entries(updates)) {
        engine.setParameter(engineId, value);
      }
      patchRuntimeDiag({ lastParamId: uiId });
    }
    patchRuntimeDiag({
      portaOn: patch["porta.on"] === true,
      glissOn: patch["gliss.on"] === true,
      ribbonRange: Number(patch["ribbon.range"] ?? 12),
      ribbonMode: String(patch["ribbon.mode"] ?? "continuous"),
      masterLevel: Number(patch["master.level"] ?? 0.75),
      maxPolyphony: Number(patch["master.polyphony"] ?? 8),
    });
  }, [patch]);

  // Sustain pedal (store toggle → engine ownership with per-note counts).
  useEffect(() => {
    engineRef.current?.setSustain(sustainPedal);
    patchRuntimeDiag({ sustain: sustainPedal });
    diagInfo("INPUT", `sustain=${sustainPedal}`);
  }, [sustainPedal]);

  // Pitch bend / mod wheel (performance transients → engine).
  useEffect(() => {
    engineRef.current?.setPitchBend(pitchBend);
    patchRuntimeDiag({ pitchBend });
  }, [pitchBend]);

  useEffect(() => {
    engineRef.current?.setModulation(modWheel);
    patchRuntimeDiag({ modWheel });
  }, [modWheel]);

  const handleRibbonPosition = useCallback((norm: number) => {
    engineRef.current?.setRibbonPosition(norm);
  }, []);

  const handleRibbonRelease = useCallback(() => {
    engineRef.current?.releaseRibbon();
  }, []);

  // Panic: engine voices, pending notes, and the hook's press mirror.
  useEffect(() => {
    if (panicToken === 0) return;
    heldRef.current.clear();
    runtimeRef.current?.panic();
    engineRef.current?.releaseRibbon();
    const snap = engineRef.current?.getDiagnostics();
    patchRuntimeDiag({
      panicCount: panicToken,
      pointerOwners: 0,
      activeVoices: snap?.activeVoices ?? 0,
      ribbonOwned: false,
      ribbonValue: null,
    });
    diagWarn("AUDIO", "panic", { token: panicToken });
  }, [panicToken]);

  // Blur / hidden: release every forwarded press (and lift engine sustain so
  // deferred notes actually fade); restore the user's sustain state on
  // return. The Keyboard's own pointer handlers stay untouched — a later
  // pointerup for an already-released press is a harmless no-op downstream.
  useEffect(() => {
    const releaseAll = (reason: "blur" | "visibility") => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      engineRef.current?.setSustain(false);
      for (const [midi, count] of heldRef.current) {
        for (let i = 0; i < count; i++) runtime.releaseNote(midi);
      }
      heldRef.current.clear();
      const cur = getRuntimeDiagSnapshot();
      if (reason === "blur") {
        patchRuntimeDiag({ blurCleanupCount: cur.blurCleanupCount + 1, pointerOwners: 0 });
      } else {
        patchRuntimeDiag({
          visibilityCleanupCount: cur.visibilityCleanupCount + 1,
          pointerOwners: 0,
        });
      }
      diagInfo("INPUT", `cleanup:${reason}`);
    };
    const onVisibility = () => {
      if (document.hidden) releaseAll("visibility");
      else engineRef.current?.setSustain(sustainRef.current);
    };
    const onBlur = () => releaseAll("blur");
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);

    const w = window as unknown as {
      __TX80_SET_BEND_RANGE?: (n: number) => void;
    };
    w.__TX80_SET_BEND_RANGE = (n: number) => {
      engineRef.current?.setPitchBendRange(n);
      diagInfo("SYSTEM", `bendRange=${n}`);
    };

    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      delete w.__TX80_SET_BEND_RANGE;
    };
  }, []);

  // Read-only diagnostics for tests and support (never mutates state).
  useEffect(() => {
    const w = window as unknown as {
      __TX80_DIAG?: () => Tx80Diag;
      __TX80_PEAK?: () => number;
    };
    w.__TX80_DIAG = () => {
      const engine = engineRef.current;
      const diag = engine?.getDiagnostics();
      const runtime = runtimeRef.current;
      const pending =
        runtime && "pendingNotes" in runtime
          ? (runtime as unknown as { pendingNotes: Map<number, number> }).pendingNotes.size
          : 0;
      let uiHeld = 0;
      for (const c of heldRef.current.values()) uiHeld += c;
      return {
        phase: phaseRef.current,
        contextState: diag?.contextState ?? "none",
        running: diag?.running ?? false,
        activeVoices: diag?.activeVoices ?? 0,
        pendingNotes: pending,
        uiHeldPresses: uiHeld,
        contextsCreated,
        enginesCreated: enginesCreatedRef.current,
        engineId: diag?.engineId ?? null,
      };
    };
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

  // Unmount: dispose the runtime (closes the context). Route-level hook —
  // this runs on real page teardown only.
  useEffect(() => {
    const held = heldRef.current;
    return () => {
      runtimeUnsubRef.current?.();
      runtimeUnsubRef.current = null;
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
      engineRef.current = null;
      held.clear();
    };
  }, []);

  return {
    initialize,
    handleNoteOn,
    handleNoteOff,
    handleRibbonPosition,
    handleRibbonRelease,
  };
}
