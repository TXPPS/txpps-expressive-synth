import { useSynthStore } from "@/state/store";

export function PresetBar() {
  const { currentPreset } = useSynthStore();
  return (
    <div className="panel-sunken mx-3 sm:mx-4 my-2 px-3 py-2 flex items-center gap-3">
      <button
        aria-label="Previous preset"
        className="silkscreen-strong text-[color:var(--phosphor-dim)] hover:text-[color:var(--phosphor)] shrink-0"
      >
        ◀
      </button>
      <div className="flex-1 min-w-0">
        <div className="silkscreen">PATCH</div>
        <div className="readout truncate text-base sm:text-lg font-semibold">
          {currentPreset?.name ?? "— init —"}
        </div>
        <div className="silkscreen truncate">
          {currentPreset ? `${currentPreset.category} · ${currentPreset.source.toUpperCase()}` : "no preset"}
        </div>
      </div>
      <button
        aria-label="Favorite preset"
        className="silkscreen-strong text-[color:var(--amber-dim)] hover:text-[color:var(--amber)] shrink-0"
      >
        ☆
      </button>
      <button
        aria-label="Next preset"
        className="silkscreen-strong text-[color:var(--phosphor-dim)] hover:text-[color:var(--phosphor)] shrink-0"
      >
        ▶
      </button>
    </div>
  );
}
