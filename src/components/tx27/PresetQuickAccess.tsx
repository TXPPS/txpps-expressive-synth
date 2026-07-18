import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import type { LibraryController } from "@/components/tx27/patch-library/usePatchLibrary";

/**
 * Compact themed Quick Access panel anchored beneath the preset LCD.
 * Same phosphor display language as the LCD (green, amber under Vintage).
 * Shows RECENT / FAVORITES / NEARBY sections built from existing library
 * state and stable IDs — no separate preset storage, no duplicated data.
 *
 * Exactly one instance is ever mounted (rendered conditionally by the route).
 */
interface PresetQuickAccessProps {
  library: LibraryController;
  /** Container holding the LCD + this panel; pointerdowns inside it never
   *  count as "outside" (prevents the toggle-reopen race with the LCD button). */
  anchorRef: RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onOpenLibrary: () => void;
  onClose: () => void;
}

interface Row {
  id: string;
  name: string;
  source: "factory" | "user";
  category: string;
  fav: boolean;
  current: boolean;
}

const DIM_BORDER = { borderColor: "var(--tx-lcd-dim)" } as const;

export function PresetQuickAccess({
  library,
  anchorRef,
  onSelect,
  onOpenLibrary,
  onClose,
}: PresetQuickAccessProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const libraryBtnIndexRef = useRef(0);

  const sections = useMemo(() => {
    const toRow = (id: string): Row | null => {
      const e = library.getEntry(id);
      if (!e) return null;
      return {
        id,
        name: e.meta.name,
        source: e.meta.source,
        category: e.meta.category,
        fav: library.favoritesSet.has(id),
        current: id === library.activeId,
      };
    };
    const seen = new Set<string>();
    // RECENT: what you were playing before the current preset.
    const recent = library.recent
      .filter((id) => id !== library.activeId)
      .map(toRow)
      .filter((r): r is Row => r !== null)
      .slice(0, 3);
    for (const r of recent) seen.add(r.id);
    // FAVORITES: skip rows already shown above (keep the panel short).
    const favorites = library.favorites
      .filter((id) => !seen.has(id) && id !== library.activeId)
      .map(toRow)
      .filter((r): r is Row => r !== null)
      .slice(0, 3);
    // NEARBY: positional window around the current preset (includes it,
    // highlighted) so prev/next context is visible.
    const all = library.allEntries;
    const idx = library.activeId ? all.findIndex((e) => e.meta.id === library.activeId) : -1;
    const windowSize = Math.min(6, all.length);
    const start = Math.max(0, Math.min(idx - 2, all.length - windowSize));
    const nearby = all
      .slice(start, start + windowSize)
      .map((e) => toRow(e.meta.id))
      .filter((r): r is Row => r !== null);
    return [
      { title: "RECENT", rows: recent },
      { title: "FAVORITES", rows: favorites },
      { title: "NEARBY", rows: nearby },
    ].filter((s) => s.rows.length > 0);
  }, [library]);

  const flatRows = useMemo(() => sections.flatMap((s) => s.rows), [sections]);

  // Focus the current preset's row on open (or the first row, or the
  // library action if the list is somehow empty).
  useEffect(() => {
    const currentIdx = flatRows.findIndex((r) => r.current);
    const target = rowRefs.current[currentIdx >= 0 ? currentIdx : 0];
    (target ?? rowRefs.current[libraryBtnIndexRef.current])?.focus();
    // Run once on mount only — focus must not jump while the user navigates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on any pointerdown outside the LCD/panel container.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [anchorRef, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const nodes = rowRefs.current.filter((n): n is HTMLButtonElement => n !== null);
    if (nodes.length === 0) return;
    const active = document.activeElement as HTMLButtonElement | null;
    const cur = nodes.findIndex((n) => n === active);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? nodes.length - 1
          : e.key === "ArrowDown"
            ? (cur + 1 + nodes.length) % nodes.length
            : (cur - 1 + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };

  let refIndex = 0;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Preset quick access"
      className="tx-lcd-box absolute left-0 right-0 top-full mt-1 z-50 flex flex-col overflow-hidden"
      style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.75), inset 0 0 10px rgba(0,0,0,0.55)" }}
      onKeyDown={handleKeyDown}
    >
      <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: "min(45vh, 340px)" }}>
        {sections.map((section) => (
          <div key={section.title}>
            <div className="px-2 pt-1.5 pb-0.5 text-[8px] tracking-[0.3em] opacity-50 select-none">
              {section.title}
            </div>
            {section.rows.map((row) => {
              const i = refIndex++;
              return (
                <button
                  key={`${section.title}:${row.id}`}
                  type="button"
                  ref={(n) => {
                    rowRefs.current[i] = n;
                  }}
                  className={`w-full min-h-10 flex items-center gap-2 px-2 text-left text-xs ${
                    row.current ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                  onClick={() => onSelect(row.id)}
                  aria-current={row.current || undefined}
                >
                  <span
                    className="shrink-0 w-4 text-center text-[8px] leading-none border rounded-sm py-0.5"
                    style={DIM_BORDER}
                  >
                    {row.source === "factory" ? "F" : "U"}
                  </span>
                  {row.current && <span className="shrink-0 text-[9px]">▸</span>}
                  <span className="truncate flex-1 font-bold">{row.name}</span>
                  {row.fav && <span className="shrink-0 text-[10px]">★</span>}
                  <span className="hidden sm:inline shrink-0 text-[8px] opacity-60">{row.category}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <button
        type="button"
        ref={(n) => {
          libraryBtnIndexRef.current = refIndex;
          rowRefs.current[refIndex] = n;
        }}
        className="w-full min-h-10 shrink-0 text-[10px] tracking-[0.25em] font-bold border-t hover:bg-white/5"
        style={DIM_BORDER}
        onClick={onOpenLibrary}
        aria-label="Open full Patch Library"
      >
        OPEN PATCH LIBRARY
      </button>
    </div>
  );
}
