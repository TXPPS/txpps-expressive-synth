import { tagKey } from "@/lib/patch-library/metadata";

/** Horizontal (scrollable) strip of tag toggle chips. Multiple selected tags
 *  combine with AND semantics — handled in the filtering layer. */
export function PatchTagFilter({
  allTags,
  selected,
  onToggle,
}: {
  allTags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  if (allTags.length === 0) return null;
  const selectedKeys = new Set(selected.map(tagKey));
  return (
    <div
      className="flex gap-1 overflow-x-auto pb-0.5"
      role="group"
      aria-label="Filter by tags (all selected tags must match)"
    >
      {allTags.map((t) => {
        const on = selectedKeys.has(tagKey(t));
        return (
          <button
            key={tagKey(t)}
            type="button"
            className={`tx-btn shrink-0 px-2 ${on ? "tx-btn-active" : ""}`}
            style={{ minHeight: 34, paddingTop: 4, paddingBottom: 4 }}
            aria-pressed={on}
            onClick={() => onToggle(t)}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
