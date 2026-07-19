import { useSynthStore, type UiMode } from "@/state/store";

const MODES: { id: UiMode; label: string }[] = [
  { id: "full", label: "FULL" },
  { id: "edit", label: "EDIT" },
  { id: "play", label: "PLAY" },
];

export function Header() {
  const { uiMode, setUiMode, audioStatus, panic } = useSynthStore();
  const statusLabel =
    audioStatus === "running"
      ? "READY"
      : audioStatus === "starting"
        ? "STARTING"
        : audioStatus === "failed"
          ? "AUDIO OFF"
          : audioStatus === "suspended"
            ? "SUSPENDED"
            : "TAP TO START";

  return (
    <header className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4 sm:py-3 border-b border-[color:var(--hairline)]">
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="silkscreen shrink-0">TXPPS</span>
        <span className="text-lg font-bold tracking-widest text-[color:var(--foreground)] shrink-0">
          TX-80
        </span>
        <span className="silkscreen hidden sm:inline shrink-0">v0.2.0 · Gate 2</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setUiMode(m.id)}
            className={`silkscreen-strong rounded-md border px-2 py-1 text-[0.65rem] sm:px-3 sm:py-1.5 sm:text-xs transition-colors ${
              uiMode === m.id
                ? "border-[color:var(--phosphor)] text-[color:var(--phosphor)] shadow-[0_0_10px_-2px_var(--phosphor-dim)]"
                : "border-[color:var(--hairline)] text-[color:var(--silkscreen-dim)] hover:text-[color:var(--silkscreen)]"
            }`}
          >
            {m.label}
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-[color:var(--hairline)]" aria-hidden />
        <div
          className={`silkscreen-strong rounded-md border px-2 py-1 text-[0.65rem] sm:px-3 sm:py-1.5 sm:text-xs ${
            audioStatus === "running"
              ? "border-[color:var(--phosphor)] text-[color:var(--phosphor)]"
              : "border-[color:var(--amber-dim)] text-[color:var(--amber)]"
          }`}
          aria-live="polite"
        >
          {statusLabel}
        </div>
        <button
          onClick={panic}
          className="silkscreen-strong rounded-md border border-[color:var(--alert)] px-2 py-1 text-[0.65rem] text-[color:var(--alert)] sm:px-3 sm:py-1.5 sm:text-xs hover:bg-[color:var(--alert)]/10"
          aria-label="Panic — all notes off"
        >
          PANIC
        </button>
      </div>
    </header>
  );
}
