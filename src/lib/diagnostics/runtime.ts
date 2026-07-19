/**
 * Session diagnostics snapshot + global error mirroring into the event buffer.
 */

import { diagError, diagInfo, diagWarn } from "./buffer";
import { getBuildInfo } from "./buildInfo";

export interface RuntimeDiagSnapshot {
  audioPhase: string;
  contextState: string;
  sampleRate: number | null;
  baseLatency: number | null;
  outputLatency: number | null;
  activeVoices: number;
  maxPolyphony: number;
  sustain: boolean;
  masterLevel: number;
  contextsCreated: number;
  enginesCreated: number;
  panicCount: number;
  lastNoteOn: number | null;
  lastNoteOff: number | null;
  pointerOwners: number;
  keyboardOwners: number;
  octave: number;
  pitchBend: number;
  modWheel: number;
  ribbonMode: string;
  ribbonValue: number | null;
  ribbonOwned: boolean;
  portaOn: boolean;
  glissOn: boolean;
  ribbonRange: number;
  pointerCancelCount: number;
  lostCaptureCount: number;
  blurCleanupCount: number;
  visibilityCleanupCount: number;
  currentPatchId: string | null;
  currentPatchName: string | null;
  patchSource: string | null;
  uiMode: string;
  lastParamId: string | null;
  midiAvailable: boolean | null;
  online: boolean;
  visibility: string;
  viewport: string;
  dpr: number;
  orientation: string;
  touch: boolean;
  reducedMotion: boolean;
  swController: boolean;
  standalone: boolean;
  oldEngineLoaded: boolean;
}

const snapshot: RuntimeDiagSnapshot = {
  audioPhase: "idle",
  contextState: "none",
  sampleRate: null,
  baseLatency: null,
  outputLatency: null,
  activeVoices: 0,
  maxPolyphony: 8,
  sustain: false,
  masterLevel: 0.75,
  contextsCreated: 0,
  enginesCreated: 0,
  panicCount: 0,
  lastNoteOn: null,
  lastNoteOff: null,
  pointerOwners: 0,
  keyboardOwners: 0,
  octave: 4,
  pitchBend: 0,
  modWheel: 0,
  ribbonMode: "continuous",
  ribbonValue: null,
  ribbonOwned: false,
  portaOn: false,
  glissOn: false,
  ribbonRange: 12,
  pointerCancelCount: 0,
  lostCaptureCount: 0,
  blurCleanupCount: 0,
  visibilityCleanupCount: 0,
  currentPatchId: null,
  currentPatchName: null,
  patchSource: null,
  uiMode: "full",
  lastParamId: null,
  midiAvailable: null,
  online: true,
  visibility: "visible",
  viewport: "0x0",
  dpr: 1,
  orientation: "unknown",
  touch: false,
  reducedMotion: false,
  swController: false,
  standalone: false,
  oldEngineLoaded: false,
};

let captureInstalled = false;

export function getRuntimeDiagSnapshot(): RuntimeDiagSnapshot {
  return { ...snapshot };
}

export function patchRuntimeDiag(partial: Partial<RuntimeDiagSnapshot>): void {
  Object.assign(snapshot, partial);
}

export function installDiagnosticCapture(): void {
  if (typeof window === "undefined" || captureInstalled) return;
  captureInstalled = true;

  const build = getBuildInfo();
  diagInfo("BUILD", "session start", {
    version: build.version,
    commit: build.commit,
    branch: build.branch,
    env: build.env,
  });

  const refreshBrowser = () => {
    snapshot.online = navigator.onLine;
    snapshot.visibility = document.visibilityState;
    snapshot.viewport = `${window.innerWidth}x${window.innerHeight}`;
    snapshot.dpr = window.devicePixelRatio || 1;
    snapshot.orientation = window.innerWidth > window.innerHeight ? "landscape" : "portrait";
    snapshot.touch = navigator.maxTouchPoints > 0;
    snapshot.reducedMotion = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    snapshot.swController = !!navigator.serviceWorker?.controller;
    snapshot.standalone = !!window.matchMedia?.("(display-mode: standalone)")?.matches;
    snapshot.midiAvailable = typeof navigator.requestMIDIAccess === "function";
  };
  refreshBrowser();

  window.addEventListener("online", () => {
    snapshot.online = true;
    diagInfo("BROWSER", "online");
  });
  window.addEventListener("offline", () => {
    snapshot.online = false;
    diagWarn("BROWSER", "offline");
  });
  document.addEventListener("visibilitychange", () => {
    snapshot.visibility = document.visibilityState;
    diagInfo("BROWSER", `visibility=${document.visibilityState}`);
  });
  window.addEventListener("resize", () => {
    snapshot.viewport = `${window.innerWidth}x${window.innerHeight}`;
    snapshot.orientation = window.innerWidth > window.innerHeight ? "landscape" : "portrait";
  });

  window.addEventListener("error", (e) => {
    const msg =
      e.error instanceof Error ? e.error.message : String(e.message || e.error || "error");
    diagError("ERROR", msg, { source: e.filename || "window", line: e.lineno ?? null });
    if (import.meta.env.DEV) console.error("[TX-80]", e.error ?? e.message);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
    diagError("ERROR", `unhandledrejection: ${reason}`);
    if (import.meta.env.DEV) console.error("[TX-80] unhandledrejection", e.reason);
  });

  // Assert old engine quarantine once DOM is ready.
  queueMicrotask(() => {
    try {
      // Dynamic presence check without importing the quarantined module.
      const w = window as unknown as { __TX80_OLD_AUDIO__?: unknown };
      snapshot.oldEngineLoaded = !!w.__TX80_OLD_AUDIO__;
      if (snapshot.oldEngineLoaded) {
        diagError("AUDIO", "old src/audio engine unexpectedly loaded");
      } else {
        diagInfo("AUDIO", "old src/audio remains quarantined");
      }
    } catch {
      /* noop */
    }
  });
}

export function formatSessionSummary(): string {
  const b = getBuildInfo();
  const s = getRuntimeDiagSnapshot();
  return [
    "=== TXPPS TX-80 SESSION SUMMARY ===",
    formatBuildBlock(b),
    "",
    "AUDIO",
    `phase=${s.audioPhase} ctx=${s.contextState} voices=${s.activeVoices}/${s.maxPolyphony}`,
    `sustain=${s.sustain} master=${s.masterLevel} sampleRate=${s.sampleRate ?? "n/a"}`,
    `contextsCreated=${s.contextsCreated} enginesCreated=${s.enginesCreated} panic=${s.panicCount}`,
    `lastNoteOn=${s.lastNoteOn ?? "-"} lastNoteOff=${s.lastNoteOff ?? "-"}`,
    "",
    "INPUT",
    `pointers=${s.pointerOwners} keys=${s.keyboardOwners} octave=C${s.octave}`,
    `pitch=${s.pitchBend.toFixed(3)} mod=${s.modWheel.toFixed(3)}`,
    `ribbon mode=${s.ribbonMode} value=${s.ribbonValue ?? "null"} owned=${s.ribbonOwned} range=${s.ribbonRange}`,
    `porta=${s.portaOn} gliss=${s.glissOn}`,
    `pointercancel=${s.pointerCancelCount} lostcapture=${s.lostCaptureCount} blur=${s.blurCleanupCount} vis=${s.visibilityCleanupCount}`,
    "",
    "PATCH",
    `id=${s.currentPatchId ?? "-"} name=${s.currentPatchName ?? "-"} source=${s.patchSource ?? "-"}`,
    `uiMode=${s.uiMode} lastParam=${s.lastParamId ?? "-"}`,
    "",
    "BROWSER",
    `viewport=${s.viewport} dpr=${s.dpr} orient=${s.orientation} touch=${s.touch}`,
    `online=${s.online} visibility=${s.visibility} sw=${s.swController} standalone=${s.standalone}`,
    `midiAvailable=${s.midiAvailable} reducedMotion=${s.reducedMotion}`,
    `oldEngineLoaded=${s.oldEngineLoaded}`,
    "=== END ===",
  ].join("\n");
}

function formatBuildBlock(b: ReturnType<typeof getBuildInfo>): string {
  return [
    "BUILD",
    `product=${b.product} version=${b.version}`,
    `commit=${b.commit} branch=${b.branch}`,
    `builtAt=${b.builtAt} env=${b.env}`,
  ].join("\n");
}
