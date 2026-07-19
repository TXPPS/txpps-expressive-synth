import { useEffect, useMemo, useRef, useState } from "react";
import {
  DIAG_BUFFER_CAPACITY,
  diagClear,
  diagSnapshot,
  diagSubscribe,
  formatDiagEvent,
  formatDiagExport,
  type DiagEvent,
  type DiagSeverity,
  type DiagSubsystem,
} from "@/lib/diagnostics/buffer";
import { formatSessionSummary, getRuntimeDiagSnapshot } from "@/lib/diagnostics/runtime";
import { formatBuildSummary } from "@/lib/diagnostics/buildInfo";

const SEVERITIES: Array<DiagSeverity | "ALL"> = ["ALL", "INFO", "WARN", "ERROR", "DEBUG"];
const SUBSYSTEMS: Array<DiagSubsystem | "ALL"> = [
  "ALL",
  "BUILD",
  "BROWSER",
  "AUDIO",
  "INPUT",
  "PATCH",
  "MIDI",
  "SYSTEM",
  "PERF",
  "ERROR",
];

/**
 * TXPPS diagnostic terminal — the only general selectable/copyable region
 * in the instrument UI (see `.tx80-diag-terminal` in styles.css).
 */
export function DiagnosticTerminal() {
  const [events, setEvents] = useState<DiagEvent[]>(() => [...diagSnapshot()]);
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("ALL");
  const [subsystem, setSubsystem] = useState<(typeof SUBSYSTEMS)[number]>("ALL");
  const [autoScroll, setAutoScroll] = useState(true);
  const [wrap, setWrap] = useState(true);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const scrollerRef = useRef<HTMLPreElement>(null);
  const [, bump] = useState(0);

  useEffect(() => {
    return diagSubscribe(() => {
      if (pausedRef.current) return;
      setEvents([...diagSnapshot()]);
    });
  }, []);

  useEffect(() => {
    if (!autoScroll || paused) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events, autoScroll, paused]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (severity !== "ALL" && e.severity !== severity) return false;
      if (subsystem !== "ALL" && e.subsystem !== subsystem) return false;
      return true;
    });
  }, [events, severity, subsystem]);

  const copyAll = async () => {
    const text = [
      formatBuildSummary(),
      "",
      formatSessionSummary(),
      "",
      "=== EVENT LOG ===",
      formatDiagExport(filtered.length ? filtered : events),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: select terminal text for manual copy
      const el = scrollerRef.current;
      if (!el) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  };

  const refreshSnapshot = () => bump((n) => n + 1);
  const snap = getRuntimeDiagSnapshot();

  return (
    <div className="space-y-2">
      <div className="silkscreen text-[color:var(--phosphor)]">DIAGNOSTIC TERMINAL</div>
      <div className="flex flex-wrap gap-1.5 items-center">
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as typeof severity)}
          className="panel-sunken readout text-[0.65rem] px-1.5 py-1 rounded border border-[color:var(--hairline)] bg-transparent"
          aria-label="Filter by severity"
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s} className="bg-[color:var(--panel-raised)]">
              {s}
            </option>
          ))}
        </select>
        <select
          value={subsystem}
          onChange={(e) => setSubsystem(e.target.value as typeof subsystem)}
          className="panel-sunken readout text-[0.65rem] px-1.5 py-1 rounded border border-[color:var(--hairline)] bg-transparent"
          aria-label="Filter by subsystem"
        >
          {SUBSYSTEMS.map((s) => (
            <option key={s} value={s} className="bg-[color:var(--panel-raised)]">
              {s}
            </option>
          ))}
        </select>
        <Toggle label="AUTO" pressed={autoScroll} onClick={() => setAutoScroll((v) => !v)} />
        <Toggle label="WRAP" pressed={wrap} onClick={() => setWrap((v) => !v)} />
        <Toggle
          label={paused ? "PAUSED" : "LIVE"}
          pressed={!paused}
          onClick={() => {
            setPaused((p) => {
              const next = !p;
              if (!next) setEvents([...diagSnapshot()]);
              return next;
            });
          }}
        />
        <button
          type="button"
          className="silkscreen-strong rounded border border-[color:var(--hairline)] px-2 py-1 text-[0.6rem]"
          onClick={refreshSnapshot}
        >
          SNAP
        </button>
        <button
          type="button"
          className="silkscreen-strong rounded border border-[color:var(--phosphor)] text-[color:var(--phosphor)] px-2 py-1 text-[0.6rem]"
          onClick={() => void copyAll()}
        >
          COPY ALL
        </button>
        <button
          type="button"
          className="silkscreen-strong rounded border border-[color:var(--alert)] text-[color:var(--alert)] px-2 py-1 text-[0.6rem]"
          onClick={() => {
            diagClear();
            setEvents([]);
          }}
        >
          CLEAR
        </button>
      </div>

      <div className="panel-sunken p-2 text-[0.6rem] font-mono text-[color:var(--silkscreen-dim)] leading-relaxed whitespace-pre-wrap">
        {`voices ${snap.activeVoices}/${snap.maxPolyphony} · ctx ${snap.contextState} · phase ${snap.audioPhase}
ribbon ${snap.ribbonMode} ${snap.ribbonValue ?? "—"} · pitch ${snap.pitchBend.toFixed(2)} · mod ${snap.modWheel.toFixed(2)}
owners ptr=${snap.pointerOwners} keys=${snap.keyboardOwners} · buffer ${events.length}/${DIAG_BUFFER_CAPACITY}`}
      </div>

      <pre
        ref={scrollerRef}
        className={`tx80-diag-terminal panel-sunken max-h-56 overflow-auto p-2 text-[0.62rem] leading-relaxed font-mono text-[color:var(--phosphor)] ${
          wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"
        }`}
        tabIndex={0}
        aria-label="Diagnostic log — selectable and copyable"
      >
        {filtered.length === 0
          ? "— no events —"
          : filtered.map((e) => formatDiagEvent(e)).join("\n")}
      </pre>
      <p className="silkscreen text-[0.5rem] text-[color:var(--silkscreen-dim)]">
        Local session only · no network transmission · secrets redacted
      </p>
    </div>
  );
}

function Toggle({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`silkscreen-strong rounded border px-2 py-1 text-[0.6rem] ${
        pressed
          ? "border-[color:var(--phosphor)] text-[color:var(--phosphor)]"
          : "border-[color:var(--hairline)] text-[color:var(--silkscreen-dim)]"
      }`}
    >
      {label}
    </button>
  );
}
