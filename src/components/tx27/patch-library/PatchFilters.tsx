import { TxSelect } from "../TxSelect";
import { PRESET_CATEGORIES, type PresetCategory } from "@/lib/patch-library/types";

const CATEGORY_OPTIONS = [
  { value: "", label: "ALL CATEGORIES" },
  ...PRESET_CATEGORIES.map((c) => ({ value: c as string, label: c as string })),
];

/** Pack + category dropdowns and the clear-all-filters button. */
export function PatchFilters({
  packs,
  pack,
  category,
  hasAnyFilter,
  onPackChange,
  onCategoryChange,
  onClearAll,
}: {
  packs: string[];
  pack: string | null;
  category: PresetCategory | null;
  hasAnyFilter: boolean;
  onPackChange: (p: string | null) => void;
  onCategoryChange: (c: PresetCategory | null) => void;
  onClearAll: () => void;
}) {
  const packOptions = [
    { value: "", label: "ALL PACKS" },
    ...packs.map((p) => ({ value: p, label: p.toUpperCase() })),
  ];
  return (
    <div className="flex gap-1">
      <TxSelect
        className="flex-1 min-w-0 text-left"
        style={{ minHeight: 40 }}
        value={pack ?? ""}
        options={packOptions}
        onChange={(v) => onPackChange(v || null)}
        ariaLabel="Filter by pack"
      />
      <TxSelect
        className="flex-1 min-w-0 text-left"
        style={{ minHeight: 40 }}
        value={category ?? ""}
        options={CATEGORY_OPTIONS}
        onChange={(v) => onCategoryChange((v || null) as PresetCategory | null)}
        ariaLabel="Filter by category"
      />
      <button
        type="button"
        className="tx-btn shrink-0"
        style={{ minHeight: 40, opacity: hasAnyFilter ? 1 : 0.5 }}
        onClick={onClearAll}
        disabled={!hasAnyFilter}
        aria-label="Clear all filters"
      >
        CLEAR
      </button>
    </div>
  );
}
