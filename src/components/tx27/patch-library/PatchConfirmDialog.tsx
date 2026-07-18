import { PatchDialogShell } from "./PatchDialogShell";

export interface ConfirmAction {
  label: string;
  onSelect: () => void;
  tone?: "danger" | "default";
}

/** Themed replacement for window.confirm — used for delete and
 *  discard-unsaved-changes decisions. Never uses browser prompts. */
export function PatchConfirmDialog({
  title,
  message,
  actions,
  onCancel,
}: {
  title: string;
  message: string;
  actions: ConfirmAction[];
  onCancel: () => void;
}) {
  return (
    <PatchDialogShell title={title} onCancel={onCancel}>
      <div className="tx-lcd-box px-2.5 py-2.5 text-[11px] leading-snug tracking-wider">
        {message}
      </div>
      <div className="flex gap-1 justify-end flex-wrap pt-1">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className="tx-btn px-3"
            style={{
              minHeight: 44,
              color: a.tone === "danger" ? "var(--tx-red)" : undefined,
            }}
            onClick={a.onSelect}
          >
            {a.label}
          </button>
        ))}
      </div>
    </PatchDialogShell>
  );
}
