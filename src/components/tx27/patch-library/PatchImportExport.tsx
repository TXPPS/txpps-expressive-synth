import { useRef } from "react";

/** Footer bar: Save As, JSON import (single preset or whole library,
 *  auto-detected) and whole-library export, plus the import summary line. */
export function PatchImportExport({
  userCount,
  summary,
  onSaveAs,
  onImportFiles,
  onExportLibrary,
}: {
  userCount: number;
  summary: string | null;
  onSaveAs: () => void;
  onImportFiles: (files: FileList) => Promise<unknown>;
  onExportLibrary: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="shrink-0 pt-2 border-t border-black/40 flex items-center gap-1 flex-wrap">
      <button
        type="button"
        className="tx-btn tx-btn-active px-3"
        style={{ minHeight: 44 }}
        onClick={onSaveAs}
      >
        SAVE AS
      </button>
      <button
        type="button"
        className="tx-btn px-3"
        style={{ minHeight: 44 }}
        onClick={() => fileRef.current?.click()}
      >
        IMPORT
      </button>
      <button
        type="button"
        className="tx-btn px-3"
        style={{ minHeight: 44 }}
        onClick={onExportLibrary}
        disabled={userCount === 0}
        title={userCount === 0 ? "No user presets to export" : undefined}
      >
        EXPORT LIB
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.tx27preset.json,.tx27library.json,application/json"
        multiple
        className="hidden"
        onChange={(e) => {
          const el = e.currentTarget;
          if (el.files && el.files.length > 0) {
            void onImportFiles(el.files).finally(() => {
              el.value = ""; // allow re-importing the same file
            });
          }
        }}
        aria-label="Import preset files"
      />
      {summary && (
        <div className="tx-lcd-box px-2 py-1 text-[9px] tracking-wider ml-auto" role="status">
          {summary}
        </div>
      )}
    </div>
  );
}
