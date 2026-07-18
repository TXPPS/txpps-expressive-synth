import { memo, useRef } from "react";
import type { LibraryEntry } from "@/lib/patch-library/types";

export interface PatchListApi {
  focusFirst: () => void;
}

/**
 * The scrolling result list, rendered as one big LCD screen. Row buttons are
 * real buttons (Enter/Space load natively); ArrowUp/ArrowDown/Home/End move
 * focus between rows; focusing a row shows it in the details panel.
 */
export function PatchList({
  entries,
  activeId,
  edited,
  favoritesSet,
  showInfoButton,
  emptyMessage,
  onLoad,
  onToggleFavorite,
  onInspect,
  apiRef,
}: {
  entries: LibraryEntry[];
  activeId: string | null;
  edited: boolean;
  favoritesSet: Set<string>;
  showInfoButton: boolean;
  emptyMessage: string;
  onLoad: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onInspect: (id: string, open?: boolean) => void;
  apiRef: React.MutableRefObject<PatchListApi>;
}) {
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  rowRefs.current.length = entries.length; // drop stale refs on shrink

  apiRef.current.focusFirst = () => {
    rowRefs.current.find(Boolean)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const rows = rowRefs.current.filter((r): r is HTMLButtonElement => !!r);
    if (rows.length === 0) return;
    const idx = rows.findIndex((r) => r === document.activeElement);
    let next = idx;
    if (e.key === "ArrowDown") next = idx < 0 ? 0 : Math.min(rows.length - 1, idx + 1);
    else if (e.key === "ArrowUp") next = idx < 0 ? 0 : Math.max(0, idx - 1);
    else if (e.key === "Home") next = 0;
    else next = rows.length - 1;
    e.preventDefault();
    rows[next].focus();
    rows[next].scrollIntoView({ block: "nearest" });
  };

  if (entries.length === 0) {
    return (
      <div className="tx-lcd-box h-full flex items-center justify-center px-4 py-8 text-center text-[10px] tracking-widest opacity-80">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className="tx-lcd-box p-1 flex flex-col" onKeyDown={onKeyDown} aria-label="Presets">
      {entries.map((e, i) => (
        <PatchRow
          key={e.meta.id}
          entry={e}
          active={e.meta.id === activeId}
          edited={edited && e.meta.id === activeId}
          fav={favoritesSet.has(e.meta.id)}
          showInfoButton={showInfoButton}
          onLoad={onLoad}
          onToggleFavorite={onToggleFavorite}
          onInspect={onInspect}
          registerRef={(el) => {
            rowRefs.current[i] = el;
          }}
        />
      ))}
    </ul>
  );
}

const PatchRow = memo(function PatchRow({
  entry,
  active,
  edited,
  fav,
  showInfoButton,
  onLoad,
  onToggleFavorite,
  onInspect,
  registerRef,
}: {
  entry: LibraryEntry;
  active: boolean;
  edited: boolean;
  fav: boolean;
  showInfoButton: boolean;
  onLoad: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onInspect: (id: string, open?: boolean) => void;
  registerRef: (el: HTMLButtonElement | null) => void;
}) {
  const m = entry.meta;
  const focusCls =
    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--tx-lcd)] focus-visible:-outline-offset-1";
  return (
    <li className="flex items-stretch gap-0.5">
      <button
        type="button"
        className={`px-2 shrink-0 text-[13px] leading-none rounded-sm hover:bg-white/5 ${focusCls}`}
        style={{ minHeight: 44, opacity: fav ? 1 : 0.45 }}
        onClick={() => onToggleFavorite(m.id)}
        aria-pressed={fav}
        aria-label={fav ? `Remove ${m.name} from favorites` : `Add ${m.name} to favorites`}
      >
        {fav ? "★" : "☆"}
      </button>
      <button
        type="button"
        ref={registerRef}
        className={`flex-1 min-w-0 text-left px-1.5 py-1 rounded-sm hover:bg-white/5 ${focusCls}`}
        style={{
          minHeight: 44,
          background: active ? "var(--tx-accent-dim)" : undefined,
        }}
        onClick={() => onLoad(m.id)}
        onFocus={() => onInspect(m.id)}
        aria-current={active ? "true" : undefined}
        aria-label={`Load preset ${m.name}`}
      >
        <span className="flex items-baseline gap-2 min-w-0">
          <span className="truncate text-[11px] font-bold tracking-wider uppercase">
            {m.name}
            {edited ? " *" : ""}
          </span>
          <span className="ml-auto shrink-0 text-[8px] opacity-60 tracking-widest">
            {m.category}
          </span>
        </span>
        <span className="block truncate text-[8px] opacity-50 tracking-wider uppercase">
          {m.pack}
          {m.tags.length > 0 ? ` · ${m.tags.slice(0, 3).join(" · ")}` : ""}
        </span>
      </button>
      {showInfoButton && (
        <button
          type="button"
          className={`px-2.5 shrink-0 text-[11px] rounded-sm hover:bg-white/5 ${focusCls}`}
          style={{ minHeight: 44 }}
          onClick={() => onInspect(m.id, true)}
          aria-label={`Details for ${m.name}`}
        >
          ⓘ
        </button>
      )}
    </li>
  );
});
