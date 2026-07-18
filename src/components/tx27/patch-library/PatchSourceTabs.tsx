import type { BrowserSource } from "@/lib/patch-library/types";

const TABS: Array<{ id: BrowserSource; label: string }> = [
  { id: "factory", label: "FACTORY" },
  { id: "user", label: "USER" },
  { id: "favorites", label: "FAV" },
  { id: "recent", label: "RECENT" },
];

export function PatchSourceTabs({
  source,
  onChange,
}: {
  source: BrowserSource;
  onChange: (s: BrowserSource) => void;
}) {
  return (
    <div className="flex gap-1" role="tablist" aria-label="Preset source">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={source === t.id}
          className={`tx-btn flex-1 px-1 ${source === t.id ? "tx-btn-active" : ""}`}
          style={{ minHeight: 40 }}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
