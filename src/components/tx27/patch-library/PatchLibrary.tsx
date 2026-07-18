import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tagKey } from "@/lib/patch-library/metadata";
import { collectPacks, filterEntries } from "@/lib/patch-library/search";
import { loadBrowserState, saveBrowserState } from "@/lib/patch-library/storage";
import type { LibraryBrowserState, LibraryEntry } from "@/lib/patch-library/types";
import { trapTabKey } from "./focusTrap";
import { PatchDetails } from "./PatchDetails";
import { PatchFilters } from "./PatchFilters";
import { PatchImportExport } from "./PatchImportExport";
import { PatchLibraryHeader } from "./PatchLibraryHeader";
import { PatchList, type PatchListApi } from "./PatchList";
import { PatchSearch } from "./PatchSearch";
import { PatchSourceTabs } from "./PatchSourceTabs";
import { PatchTagFilter } from "./PatchTagFilter";
import type { LibraryController } from "./usePatchLibrary";

/**
 * The patch-library overlay. Rendered only while open (client-only, after a
 * user gesture — no hydration concerns). Layouts:
 *  · phone portrait  — full-screen; details open as a bottom drawer via ⓘ
 *  · phone landscape — full-screen, two columns (list + details)
 *  · tablet/desktop  — centered panel with a permanent details column
 * Browser state (tab/pack/category/tags) persists; the search query doesn't.
 */
export function PatchLibrary({
  controller: c,
  isNarrow,
  isPortrait,
}: {
  controller: LibraryController;
  isNarrow: boolean;
  isPortrait: boolean;
}) {
  const [browser, setBrowser] = useState<LibraryBrowserState>(() => loadBrowserState());
  const [query, setQuery] = useState("");
  const [detailsId, setDetailsId] = useState<string | null>(c.activeId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listApiRef = useRef<PatchListApi>({ focusFirst: () => {} });

  useEffect(() => {
    saveBrowserState(browser);
  }, [browser]);

  // Initial focus: the search field on pointer layouts; the panel itself on
  // phones (focusing an input there would pop the virtual keyboard).
  useEffect(() => {
    if (isNarrow) panelRef.current?.focus();
    else searchRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once, on open
  }, []);

  // When a dialog stacked above the library closes, refocus the panel so
  // keyboard interaction (Esc, arrows, Tab cycle) continues seamlessly.
  const prevDialogKind = useRef(c.dialog.kind);
  useEffect(() => {
    if (prevDialogKind.current !== "none" && c.dialog.kind === "none") {
      panelRef.current?.focus();
    }
    prevDialogKind.current = c.dialog.kind;
  }, [c.dialog.kind]);

  const sourceEntries = useMemo<LibraryEntry[]>(() => {
    switch (browser.source) {
      case "user":
        return c.userEntries;
      case "favorites":
        return c.allEntries.filter((e) => c.favoritesSet.has(e.meta.id));
      case "recent":
        return c.recent
          .map((id) => c.getEntry(id))
          .filter((e): e is LibraryEntry => e !== undefined);
      default:
        return c.factoryEntries;
    }
  }, [browser.source, c.factoryEntries, c.userEntries, c.allEntries, c.favoritesSet, c.recent, c.getEntry]);

  const filtered = useMemo(
    () => filterEntries(sourceEntries, query, browser),
    [sourceEntries, query, browser],
  );
  const packs = useMemo(() => collectPacks(c.allEntries), [c.allEntries]);
  const hasAnyFilter =
    browser.pack !== null || browser.category !== null || browser.tags.length > 0 || query !== "";

  const detailsEntry: LibraryEntry | null =
    (detailsId ? c.getEntry(detailsId) : undefined) ?? c.activeEntry ?? filtered[0] ?? null;

  const inspect = useCallback((id: string, open?: boolean) => {
    setDetailsId(id);
    if (open) setDrawerOpen(true);
  }, []);

  const toggleTag = useCallback((t: string) => {
    setBrowser((b) => {
      const k = tagKey(t);
      const has = b.tags.some((x) => tagKey(x) === k);
      return { ...b, tags: has ? b.tags.filter((x) => tagKey(x) !== k) : [...b.tags, t] };
    });
  }, []);

  const clearAll = useCallback(() => {
    setQuery("");
    setBrowser((b) => ({ ...b, pack: null, category: null, tags: [] }));
  }, []);

  const emptyMessage =
    sourceEntries.length === 0
      ? browser.source === "user"
        ? "NO USER PRESETS YET · SAVE AS CREATES ONE"
        : browser.source === "favorites"
          ? "NO FAVORITES YET · TAP ☆ ON ANY PRESET"
          : browser.source === "recent"
            ? "NOTHING LOADED YET"
            : "NO PRESETS"
      : "NO MATCHES · ADJUST SEARCH OR FILTERS";

  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      c.closeLibrary();
      return;
    }
    trapTabKey(e, panelRef.current);
  };

  const narrowPortrait = isNarrow && isPortrait;
  const narrowLandscape = isNarrow && !isPortrait;

  const searchEl = (
    <PatchSearch
      ref={searchRef}
      query={query}
      onChange={setQuery}
      onArrowDown={() => listApiRef.current.focusFirst()}
    />
  );
  const tabsEl = (
    <PatchSourceTabs
      source={browser.source}
      onChange={(s) => setBrowser((b) => ({ ...b, source: s }))}
    />
  );
  const details = (
    <PatchDetails
      entry={detailsEntry}
      fav={detailsEntry ? c.favoritesSet.has(detailsEntry.meta.id) : false}
      onLoad={c.requestLoad}
      onToggleFavorite={c.toggleFavorite}
      onDuplicate={c.duplicateEntry}
      onExport={c.exportEntryById}
      onRename={c.beginRename}
      onDelete={c.beginDelete}
      onCloseDrawer={narrowPortrait ? () => setDrawerOpen(false) : undefined}
    />
  );

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/70" onClick={c.closeLibrary} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Patch library"
        tabIndex={-1}
        onKeyDown={onPanelKeyDown}
        className={
          isNarrow
            ? "absolute inset-0 tx-panel rounded-none border-0 flex flex-col gap-2 outline-none"
            : "absolute inset-0 m-auto tx-panel flex flex-col gap-2 p-3 outline-none w-[min(940px,94vw)] h-[min(680px,92dvh)]"
        }
        style={
          isNarrow
            ? {
                paddingTop: "max(env(safe-area-inset-top), 8px)",
                paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
                paddingLeft: "max(env(safe-area-inset-left), 8px)",
                paddingRight: "max(env(safe-area-inset-right), 8px)",
              }
            : undefined
        }
      >
        <PatchLibraryHeader
          shown={filtered.length}
          total={c.allEntries.length}
          onClose={c.closeLibrary}
        />

        <div className="shrink-0 flex flex-col gap-1.5">
          {narrowLandscape ? (
            // Landscape phones are height-starved: search + tabs share a row.
            <div className="flex gap-1.5 items-stretch">
              <div className="flex-1 min-w-0">{searchEl}</div>
              <div className="w-72 shrink-0">{tabsEl}</div>
            </div>
          ) : (
            <>
              {searchEl}
              {tabsEl}
            </>
          )}
          <PatchFilters
            packs={packs}
            pack={browser.pack}
            category={browser.category}
            hasAnyFilter={hasAnyFilter}
            onPackChange={(p) => setBrowser((b) => ({ ...b, pack: p }))}
            onCategoryChange={(cat) => setBrowser((b) => ({ ...b, category: cat }))}
            onClearAll={clearAll}
          />
          <PatchTagFilter allTags={c.allTags} selected={browser.tags} onToggle={toggleTag} />
        </div>

        <div className={`flex-1 min-h-0 flex gap-2 ${narrowPortrait ? "flex-col" : "flex-row"}`}>
          <div className="flex-1 min-h-0 min-w-0 overflow-y-auto">
            <PatchList
              entries={filtered}
              activeId={c.activeId}
              edited={c.edited}
              favoritesSet={c.favoritesSet}
              showInfoButton={narrowPortrait}
              emptyMessage={emptyMessage}
              onLoad={c.requestLoad}
              onToggleFavorite={c.toggleFavorite}
              onInspect={inspect}
              apiRef={listApiRef}
            />
          </div>
          {narrowPortrait ? (
            drawerOpen && detailsEntry ? (
              <div className="shrink-0 max-h-[46%] overflow-y-auto">{details}</div>
            ) : null
          ) : (
            <aside
              className={`${narrowLandscape ? "w-52" : "w-64"} shrink-0 min-h-0 overflow-y-auto`}
            >
              {details}
            </aside>
          )}
        </div>

        <PatchImportExport
          userCount={c.userEntries.length}
          summary={c.importSummary}
          onSaveAs={c.beginSaveAs}
          onImportFiles={c.importFiles}
          onExportLibrary={c.exportUserLibrary}
        />
      </div>
    </div>
  );
}
