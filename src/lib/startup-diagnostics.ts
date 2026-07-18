/**
 * Startup diagnostics — LOCAL ONLY.
 *
 * Records a compact trace of one launch (phases, audio state transitions,
 * first error) in localStorage so an intermittent cold-launch failure on a
 * physical phone can be read back afterwards from SETUP → STARTUP DIAGNOSTICS.
 *
 * Privacy/scope rules: no personal data, no URLs beyond the app itself, no
 * network transmission of any kind, bounded size, silent on storage failure.
 * The previous launch's record is kept under a `-prev` key so a launch that
 * crashed can still be inspected on the next successful one.
 */

export interface StartupDiag {
  build: string;
  startedAt: string;
  /** "standalone" when launched from the installed PWA icon. */
  mode: "standalone" | "browser";
  online: boolean;
  swController: boolean;
  /** [ms since launch, phase label] — capped. */
  phases: Array<[number, string]>;
  error?: { name: string; message: string; stack?: string };
}

const KEY = "tx27-startup-diag";
const PREV_KEY = "tx27-startup-diag-prev";
const MAX_PHASES = 48;

let current: StartupDiag | null = null;
let t0 = 0;
let listenersAttached = false;

declare const __TX27_BUILD_ID__: string;

function persist(): void {
  try {
    if (current) localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage full/blocked — diagnostics are best-effort */
  }
}

/** Begin a launch record. Rotates the previous launch's record to -prev.
 *  Safe to call once per page load, client-side only. */
export function initStartupDiagnostics(): void {
  if (typeof window === "undefined" || current) return;
  try {
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(PREV_KEY, prev);
  } catch {
    /* noop */
  }
  t0 = Date.now();
  let build = "unknown";
  try {
    build = __TX27_BUILD_ID__;
  } catch {
    /* define missing in dev tooling */
  }
  current = {
    build,
    startedAt: new Date(t0).toISOString(),
    mode: window.matchMedia?.("(display-mode: standalone)")?.matches
      ? "standalone"
      : "browser",
    online: navigator.onLine,
    swController: !!navigator.serviceWorker?.controller,
    phases: [[0, "boot"]],
  };
  persist();
  if (!listenersAttached) {
    listenersAttached = true;
    // Passive capture of the first fatal-looking error. Never rethrows,
    // never reports anywhere — storage only.
    window.addEventListener("error", (e) => {
      recordStartupError(e.error ?? e.message);
    });
    window.addEventListener("unhandledrejection", (e) => {
      recordStartupError(e.reason);
    });
  }
}

/** Append one phase marker (e.g. "audio:starting", "ctx:running"). */
export function recordStartupPhase(phase: string): void {
  if (!current) return;
  if (current.phases.length >= MAX_PHASES) return;
  current.phases.push([Date.now() - t0, phase]);
  persist();
}

/** Record the first error of this launch (later ones are ignored — the first
 *  is almost always the root cause; keeps the record small and stable). */
export function recordStartupError(err: unknown): void {
  if (!current || current.error) return;
  const e = err instanceof Error ? err : new Error(String(err));
  current.error = {
    name: e.name || "Error",
    message: (e.message || "").slice(0, 200),
    stack: e.stack ? e.stack.split("\n").slice(0, 4).join("\n").slice(0, 400) : undefined,
  };
  recordStartupPhase("error:" + current.error.name);
}

/** Read records for the SETUP readout. */
export function readStartupDiagnostics(): { current: StartupDiag | null; previous: StartupDiag | null } {
  const read = (k: string): StartupDiag | null => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? (JSON.parse(raw) as StartupDiag) : null;
    } catch {
      return null;
    }
  };
  return { current: read(KEY), previous: read(PREV_KEY) };
}

/** Compact single-record text for the LCD readout. */
export function formatDiag(d: StartupDiag | null): string {
  if (!d) return "NO RECORD";
  const lines = [
    `${d.startedAt} · ${d.build} · ${d.mode.toUpperCase()} · ${d.online ? "ONLINE" : "OFFLINE"} · SW ${d.swController ? "CTRL" : "NONE"}`,
    d.phases.map(([ms, p]) => `${(ms / 1000).toFixed(1)}s ${p}`).join(" → "),
  ];
  if (d.error) lines.push(`ERR ${d.error.name}: ${d.error.message}`);
  return lines.join("\n");
}
