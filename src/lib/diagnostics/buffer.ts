/**
 * TX-80 bounded diagnostic event buffer.
 *
 * Local in-memory only — never transmitted. Caps growth, redacts secrets,
 * and stays off the audio render path (no per-sample logging).
 */

export type DiagSeverity = "INFO" | "WARN" | "ERROR" | "DEBUG";

export type DiagSubsystem =
  "BUILD" | "BROWSER" | "AUDIO" | "INPUT" | "PATCH" | "MIDI" | "SYSTEM" | "PERF" | "ERROR";

export interface DiagEvent {
  id: number;
  ts: number;
  severity: DiagSeverity;
  subsystem: DiagSubsystem;
  message: string;
  meta?: Record<string, string | number | boolean | null>;
}

export const DIAG_BUFFER_CAPACITY = 256;

type Listener = () => void;

let seq = 0;
const events: DiagEvent[] = [];
const listeners = new Set<Listener>();

const SECRET_KEY = /(token|secret|password|api[_-]?key|authorization|cookie)/i;

function sanitizeMeta(
  meta?: Record<string, unknown>,
): Record<string, string | number | boolean | null> | undefined {
  if (!meta) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SECRET_KEY.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = typeof v === "string" ? v.slice(0, 240) : v;
    } else {
      out[k] = String(v).slice(0, 120);
    }
  }
  return out;
}

function notify(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* listener faults must not break diagnostics */
    }
  }
}

/** Append one diagnostic event (bounded ring). */
export function diagPush(
  severity: DiagSeverity,
  subsystem: DiagSubsystem,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const entry: DiagEvent = {
    id: ++seq,
    ts: Date.now(),
    severity,
    subsystem,
    message: String(message).slice(0, 400),
    meta: sanitizeMeta(meta),
  };
  events.push(entry);
  while (events.length > DIAG_BUFFER_CAPACITY) events.shift();
  notify();
}

export function diagInfo(
  subsystem: DiagSubsystem,
  message: string,
  meta?: Record<string, unknown>,
) {
  diagPush("INFO", subsystem, message, meta);
}
export function diagWarn(
  subsystem: DiagSubsystem,
  message: string,
  meta?: Record<string, unknown>,
) {
  diagPush("WARN", subsystem, message, meta);
}
export function diagError(
  subsystem: DiagSubsystem,
  message: string,
  meta?: Record<string, unknown>,
) {
  diagPush("ERROR", subsystem, message, meta);
}
export function diagDebug(
  subsystem: DiagSubsystem,
  message: string,
  meta?: Record<string, unknown>,
) {
  if (import.meta.env.DEV) diagPush("DEBUG", subsystem, message, meta);
}

export function diagClear(): void {
  events.length = 0;
  notify();
}

export function diagSnapshot(): readonly DiagEvent[] {
  return events.slice();
}

export function diagSubscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function formatDiagEvent(e: DiagEvent): string {
  const t = new Date(e.ts).toISOString().slice(11, 23);
  const meta =
    e.meta && Object.keys(e.meta).length
      ? " " +
        Object.entries(e.meta)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(" ")
      : "";
  return `${t} [${e.severity}] [${e.subsystem}] ${e.message}${meta}`;
}

export function formatDiagExport(list: readonly DiagEvent[] = events): string {
  const header = [
    "TXPPS TX-80 DIAGNOSTIC EXPORT",
    `exportedAt=${new Date().toISOString()}`,
    `events=${list.length}`,
    `capacity=${DIAG_BUFFER_CAPACITY}`,
    "---",
  ];
  return [...header, ...list.map(formatDiagEvent)].join("\n");
}
