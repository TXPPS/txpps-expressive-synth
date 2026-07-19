import { useState } from "react";
import { useSynthStore, type UiMode } from "@/state/store";
import { useViewportLayout } from "@/hooks/useViewportLayout";
import { SettingsDialog } from "./SettingsDialog";
import { diagInfo } from "@/lib/diagnostics/buffer";

const MODES: { id: UiMode; label: string; short: string }[] = [
  { id: "full", label: "FULL", short: "FULL" },
  { id: "edit", label: "EDIT", short: "EDIT" },
  { id: "play", label: "PLAY", short: "PLAY" },
];

export function Header({ onAudioStart }: { onAudioStart: () => void }) {
  const uiMode = useSynthStore((s) => s.uiMode);
  const setUiMode = useSynthStore((s) => s.setUiMode);
  const audioStatus = useSynthStore((s) => s.audioStatus);
  const panic = useSynthStore((s) => s.panic);
  const layout = useViewportLayout();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const compact = layout.isNarrow;

  const statusLabel =
    audioStatus === "running"
      ? "READY"
      : audioStatus === "starting"
        ? "STARTING"
        : audioStatus === "failed"
          ? "RETRY"
          : audioStatus === "suspended"
            ? "RESUME"
            : "TAP TO START";

  const compactStatus =
    audioStatus === "running"
      ? "READY"
      : audioStatus === "starting"
        ? "…"
        : audioStatus === "failed"
          ? "RETRY"
          : audioStatus === "suspended"
            ? "RESUME"
            : "START";

  const accessibleStatus =
    audioStatus === "running"
      ? "Audio ready"
      : audioStatus === "starting"
        ? "Audio starting"
        : audioStatus === "failed"
          ? "Audio failed — retry"
          : audioStatus === "suspended"
            ? "Audio suspended — tap to resume"
            : "Tap to start audio";

  const onAudio = () => {
    if (audioStatus === "running" || audioStatus === "starting") return;
    diagInfo("AUDIO", `header start control (${audioStatus})`);
    onAudioStart();
  };

  return (
    <header
      data-tx80-header="true"
      className="flex items-center justify-between gap-2 px-2 py-1.5 sm:px-4 sm:py-3 border-b border-[color:var(--hairline)] shrink-0"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 0.35rem)",
        paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
        paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
      }}
    >
      <div className="flex items-baseline gap-1.5 min-w-0 shrink">
        {!compact && <span className="silkscreen shrink-0">TXPPS</span>}
        <span
          className={`font-bold tracking-widest text-[color:var(--foreground)] shrink-0 ${
            compact ? "text-base" : "text-lg"
          }`}
          data-tx80-brand="true"
        >
          TX-80
        </span>
        {!compact && <span className="silkscreen shrink-0">v0.2.0 · Gate 2</span>}
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-wrap justify-end">
        <div
          className="flex items-center rounded-md border border-[color:var(--hairline)] overflow-hidden"
          role="group"
          aria-label="Workspace mode"
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              data-tx80-mode={m.id}
              onClick={() => setUiMode(m.id)}
              aria-pressed={uiMode === m.id}
              className={`silkscreen-strong px-1.5 py-1.5 sm:px-3 sm:py-1.5 text-[0.6rem] sm:text-xs min-h-11 transition-colors border-r border-[color:var(--hairline)] last:border-r-0 ${
                uiMode === m.id
                  ? "bg-[color:var(--panel-sunken)] text-[color:var(--phosphor)]"
                  : "text-[color:var(--silkscreen-dim)] hover:text-[color:var(--silkscreen)]"
              }`}
            >
              {compact ? m.short : m.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="silkscreen-strong rounded-md border border-[color:var(--hairline)] px-2 py-1.5 text-[0.6rem] sm:px-3 sm:text-xs text-[color:var(--silkscreen-dim)] hover:text-[color:var(--silkscreen)] min-h-11 min-w-11"
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          aria-label="Settings"
        >
          {compact ? "⚙" : "SETTINGS"}
        </button>

        <button
          type="button"
          data-tx80-audio-start="true"
          onClick={onAudio}
          disabled={audioStatus === "starting"}
          className={`silkscreen-strong rounded-md border px-2 py-1.5 text-[0.6rem] sm:px-3 sm:text-xs min-h-11 ${
            audioStatus === "running"
              ? "border-[color:var(--phosphor)] text-[color:var(--phosphor)] cursor-default"
              : "border-[color:var(--amber-dim)] text-[color:var(--amber)]"
          } disabled:opacity-80`}
          aria-live="polite"
          aria-label={accessibleStatus}
        >
          {compact ? compactStatus : statusLabel}
        </button>

        <button
          type="button"
          onClick={panic}
          className="silkscreen-strong rounded-md border border-[color:var(--alert)] px-2 py-1.5 text-[0.6rem] text-[color:var(--alert)] sm:px-3 sm:text-xs hover:bg-[color:var(--alert)]/10 min-h-11"
          aria-label="Panic — all notes off"
        >
          {compact ? "!" : "PANIC"}
        </button>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}
