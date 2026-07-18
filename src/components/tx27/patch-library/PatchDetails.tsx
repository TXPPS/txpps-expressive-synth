import type { LibraryEntry } from "@/lib/patch-library/types";

/** Details panel for the selected/focused preset plus its action buttons.
 *  Rename/Delete appear only for user presets; factory presets can be
 *  favorited, duplicated into USER, and exported. */
export function PatchDetails({
  entry,
  fav,
  onLoad,
  onToggleFavorite,
  onDuplicate,
  onExport,
  onRename,
  onDelete,
  onCloseDrawer,
}: {
  entry: LibraryEntry | null;
  fav: boolean;
  onLoad: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onDuplicate: (id: string) => void;
  onExport: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onCloseDrawer?: () => void;
}) {
  if (!entry) {
    return (
      <div className="tx-lcd-box h-full flex items-center justify-center px-3 py-6 text-[10px] tracking-widest opacity-70 text-center">
        SELECT A PRESET
      </div>
    );
  }
  const m = entry.meta;
  const isUser = m.source === "user";
  const btn = "tx-btn px-1";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="tx-lcd-box p-2 flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[8px] opacity-60 leading-none">PRESET</div>
            <div className="text-sm font-bold tracking-wider uppercase break-words">{m.name}</div>
          </div>
          {onCloseDrawer && (
            <button
              type="button"
              className="tx-btn shrink-0 px-2"
              style={{ minHeight: 34, paddingTop: 4, paddingBottom: 4 }}
              onClick={onCloseDrawer}
              aria-label="Close details"
            >
              ▾
            </button>
          )}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[9px] tracking-wider">
          <dt className="opacity-50">CATEGORY</dt>
          <dd className="text-right truncate">{m.category}</dd>
          <dt className="opacity-50">PACK</dt>
          <dd className="text-right truncate uppercase">{m.pack}</dd>
          <dt className="opacity-50">AUTHOR</dt>
          <dd className="text-right truncate uppercase">{m.author}</dd>
          <dt className="opacity-50">SOURCE</dt>
          <dd className="text-right uppercase">{m.source}</dd>
        </dl>
        {m.tags.length > 0 && (
          <div className="flex flex-wrap gap-1" aria-label="Tags">
            {m.tags.map((t) => (
              <span
                key={t}
                className="text-[8px] tracking-wider px-1 py-0.5 rounded-sm border uppercase"
                style={{ borderColor: "var(--tx-lcd-dim)" }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {m.description && (
          <p className="text-[9px] leading-snug opacity-80 tracking-wide">{m.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          className={`${btn} tx-btn-active col-span-2`}
          style={{ minHeight: 44 }}
          onClick={() => onLoad(m.id)}
        >
          LOAD
        </button>
        <button
          type="button"
          className={btn}
          style={{ minHeight: 44 }}
          onClick={() => onToggleFavorite(m.id)}
          aria-pressed={fav}
        >
          {fav ? "★ UNFAV" : "☆ FAV"}
        </button>
        <button type="button" className={btn} style={{ minHeight: 44 }} onClick={() => onDuplicate(m.id)}>
          DUPLICATE
        </button>
        <button type="button" className={btn} style={{ minHeight: 44 }} onClick={() => onExport(m.id)}>
          EXPORT
        </button>
        {isUser ? (
          <>
            <button type="button" className={btn} style={{ minHeight: 44 }} onClick={() => onRename(m.id)}>
              RENAME
            </button>
            <button
              type="button"
              className={`${btn} col-span-2`}
              style={{ minHeight: 44, color: "var(--tx-red)" }}
              onClick={() => onDelete(m.id)}
            >
              DELETE
            </button>
          </>
        ) : (
          <div
            className="flex items-center justify-center text-[8px] tracking-widest text-tx-muted"
            aria-hidden="true"
          >
            FACTORY · READ ONLY
          </div>
        )}
      </div>
    </div>
  );
}
