import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSynthStore } from "@/state/store";
import {
  allBrowsablePatches,
  createUserPatchId,
  FACTORY_PATCHES,
  findFactoryPatch,
  loadFavorites,
  loadLastPresetId,
  loadUserPatches,
  saveFavorites,
  saveLastPresetId,
  saveUserPatches,
  toPresetMeta,
  type FactoryPatch,
  type PatchCategory,
  type UserPatch,
} from "@/state/presets";
import { diagInfo, diagWarn } from "@/lib/diagnostics/buffer";
import { patchRuntimeDiag } from "@/lib/diagnostics/runtime";
import { useViewportLayout } from "@/hooks/useViewportLayout";

const BROWSER_CATEGORIES: Array<PatchCategory | "ALL" | "FAVORITES" | "USER"> = [
  "ALL",
  "KEYS",
  "PADS",
  "LEADS",
  "BASS",
  "EXPERIMENTAL",
  "FAVORITES",
  "USER",
];

type CatalogEntry = FactoryPatch | UserPatch;

function isUserPatch(p: CatalogEntry): p is UserPatch {
  return "savedAt" in p;
}

export function PresetBar() {
  const {
    currentPreset,
    setCurrentPreset,
    patch,
    loadPatch,
    presetBrowserOpen,
    setPresetBrowserOpen,
    uiMode,
  } = useSynthStore();
  const [userPatches, setUserPatches] = useState<UserPatch[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const layout = useViewportLayout();

  const catalog = useMemo(() => allBrowsablePatches(userPatches), [userPatches]);

  const applyPatchById = useCallback(
    (id: string, closeBrowser = true) => {
      const factory = findFactoryPatch(id);
      if (factory) {
        loadPatch(factory.values);
        setCurrentPreset(toPresetMeta(factory, "factory"));
        saveLastPresetId(id);
        patchRuntimeDiag({
          currentPatchId: factory.id,
          currentPatchName: factory.name,
          patchSource: "factory",
        });
        diagInfo("PATCH", `load factory ${factory.name}`);
        if (closeBrowser) setPresetBrowserOpen(false);
        return;
      }
      const user = userPatches.find((p) => p.id === id);
      if (user) {
        loadPatch(user.values);
        setCurrentPreset(toPresetMeta(user, "user"));
        saveLastPresetId(id);
        patchRuntimeDiag({
          currentPatchId: user.id,
          currentPatchName: user.name,
          patchSource: "user",
        });
        diagInfo("PATCH", `load user ${user.name}`);
        if (closeBrowser) setPresetBrowserOpen(false);
      } else {
        diagWarn("PATCH", `preset not found ${id}`);
      }
    },
    [loadPatch, setCurrentPreset, setPresetBrowserOpen, userPatches],
  );

  useEffect(() => {
    const users = loadUserPatches();
    setUserPatches(users);
    setFavorites(loadFavorites());
    const last = loadLastPresetId();
    const initial =
      (last && (findFactoryPatch(last) || users.find((u) => u.id === last)) && last) ||
      findFactoryPatch("tx80-factory-init")?.id ||
      FACTORY_PATCHES[0]?.id;
    if (initial) {
      const factory = findFactoryPatch(initial);
      const user = users.find((u) => u.id === initial);
      if (factory) {
        loadPatch(factory.values);
        setCurrentPreset(toPresetMeta(factory, "factory"));
      } else if (user) {
        loadPatch(user.values);
        setCurrentPreset(toPresetMeta(user, "user"));
      }
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, []);

  const step = (dir: -1 | 1) => {
    if (!catalog.length) return;
    const idx = Math.max(
      0,
      catalog.findIndex((p) => p.id === currentPreset?.id),
    );
    const next = catalog[(idx + dir + catalog.length) % catalog.length]!;
    applyPatchById(next.id, false);
  };

  const toggleFavorite = () => {
    if (!currentPreset) return;
    const next = new Set(favorites);
    if (next.has(currentPreset.id)) next.delete(currentPreset.id);
    else next.add(currentPreset.id);
    setFavorites(next);
    saveFavorites(next);
  };

  const saveCurrent = () => {
    const name = window.prompt("Save patch as:", currentPreset?.name ?? "User Patch");
    if (!name?.trim()) return;
    const entry: UserPatch = {
      id: createUserPatchId(),
      name: name.trim().slice(0, 40),
      category: "EXPERIMENTAL",
      values: { ...patch },
      savedAt: Date.now(),
    };
    const next = [...userPatches, entry];
    setUserPatches(next);
    saveUserPatches(next);
    setCurrentPreset(toPresetMeta(entry, "user"));
    saveLastPresetId(entry.id);
    diagInfo("PATCH", `saved user ${entry.name}`);
  };

  const restoreFactory = () => {
    const id = currentPreset?.id;
    if (!id) return;
    const factory = findFactoryPatch(id);
    if (!factory) {
      diagWarn("PATCH", "restore factory — not a factory patch");
      return;
    }
    applyPatchById(factory.id, false);
    diagInfo("PATCH", `restored factory ${factory.name}`);
  };

  const isFav = currentPreset ? favorites.has(currentPreset.id) : false;
  const compact = layout.isNarrow || uiMode === "play";

  return (
    <>
      <div
        data-tx80-preset-bar="true"
        className={`panel-sunken mx-2 sm:mx-4 my-1.5 sm:my-2 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-3 shrink-0 ${
          compact ? "gap-1" : ""
        }`}
      >
        <button
          type="button"
          aria-label="Previous preset"
          onClick={() => step(-1)}
          disabled={!ready}
          className="silkscreen-strong text-[color:var(--phosphor-dim)] hover:text-[color:var(--phosphor)] shrink-0 disabled:opacity-40 min-h-11 min-w-11"
        >
          ◀
        </button>

        <button
          type="button"
          data-tx80-preset-open="true"
          onClick={() => setPresetBrowserOpen(true)}
          className="flex-1 min-w-0 text-left rounded-md px-1 py-0.5 hover:bg-[color:var(--panel)]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--phosphor)]"
          aria-haspopup="dialog"
          aria-expanded={presetBrowserOpen}
          aria-label={`Open patch browser. Current patch ${currentPreset?.name ?? "init"}`}
        >
          <div className="silkscreen text-[0.55rem]">PATCH</div>
          <div className="readout truncate text-sm sm:text-lg font-semibold">
            {currentPreset?.name ?? "— init —"}
          </div>
          {!compact && (
            <div className="silkscreen truncate text-[0.55rem]">
              {currentPreset
                ? `${currentPreset.category} · ${currentPreset.source.toUpperCase()}`
                : "tap to browse"}
            </div>
          )}
        </button>

        <button
          type="button"
          aria-label="Save current patch"
          onClick={saveCurrent}
          className="silkscreen-strong text-[color:var(--silkscreen)] hover:text-[color:var(--phosphor)] shrink-0 text-[0.55rem] border border-[color:var(--hairline)] rounded px-1.5 py-1 min-h-11"
        >
          SAVE
        </button>
        <button
          type="button"
          aria-label="Favorite preset"
          aria-pressed={isFav}
          onClick={toggleFavorite}
          className={`silkscreen-strong shrink-0 min-h-11 min-w-11 ${
            isFav
              ? "text-[color:var(--amber)]"
              : "text-[color:var(--amber-dim)] hover:text-[color:var(--amber)]"
          }`}
        >
          {isFav ? "★" : "☆"}
        </button>
        <button
          type="button"
          aria-label="Next preset"
          onClick={() => step(1)}
          disabled={!ready}
          className="silkscreen-strong text-[color:var(--phosphor-dim)] hover:text-[color:var(--phosphor)] shrink-0 disabled:opacity-40 min-h-11 min-w-11"
        >
          ▶
        </button>
      </div>

      {presetBrowserOpen && (
        <PresetBrowser
          catalog={catalog}
          favorites={favorites}
          currentId={currentPreset?.id ?? null}
          onSelect={(id) => applyPatchById(id, true)}
          onToggleFavorite={(id) => {
            const next = new Set(favorites);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setFavorites(next);
            saveFavorites(next);
          }}
          onSave={saveCurrent}
          onRestoreFactory={restoreFactory}
          onClose={() => setPresetBrowserOpen(false)}
          isNarrow={layout.isNarrow}
          isPortrait={layout.isPortrait}
        />
      )}
    </>
  );
}

function PresetBrowser({
  catalog,
  favorites,
  currentId,
  onSelect,
  onToggleFavorite,
  onSave,
  onRestoreFactory,
  onClose,
  isNarrow,
  isPortrait,
}: {
  catalog: CatalogEntry[];
  favorites: Set<string>;
  currentId: string | null;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onSave: () => void;
  onRestoreFactory: () => void;
  onClose: () => void;
  isNarrow: boolean;
  isPortrait: boolean;
}) {
  const [filter, setFilter] = useState<(typeof BROWSER_CATEGORIES)[number]>("ALL");
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    let list = catalog;
    if (filter === "FAVORITES") list = catalog.filter((p) => favorites.has(p.id));
    else if (filter === "USER") list = catalog.filter(isUserPatch);
    else if (filter !== "ALL") list = catalog.filter((p) => p.category === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [catalog, favorites, filter, query]);

  const factoryCount = FACTORY_PATCHES.length;
  const narrowPortrait = isNarrow && isPortrait;

  return (
    <div className="fixed inset-0 z-[70]" data-tx80-preset-browser="true">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Patch browser"
        tabIndex={-1}
        className={
          isNarrow
            ? `absolute ${
                narrowPortrait
                  ? "inset-x-0 bottom-0 top-[8%] rounded-t-xl"
                  : "inset-0 rounded-none"
              } enclosure border border-[color:var(--hairline)] flex flex-col outline-none`
            : "absolute inset-0 m-auto enclosure border border-[color:var(--hairline)] flex flex-col outline-none w-[min(720px,94vw)] h-[min(640px,90dvh)] rounded-lg"
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
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[color:var(--hairline)] shrink-0">
          <div>
            <div className="silkscreen-strong text-[color:var(--phosphor)]">PATCH BROWSER</div>
            <div className="silkscreen text-[0.55rem]">
              {filtered.length} shown · {factoryCount} factory
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="silkscreen-strong border border-[color:var(--hairline)] rounded-md px-3 py-2 min-h-11"
            aria-label="Close patch browser"
          >
            CLOSE
          </button>
        </div>

        <div className="px-3 py-2 flex flex-col gap-2 shrink-0 border-b border-[color:var(--hairline)]">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patches…"
            className="w-full panel-sunken rounded-md px-3 py-2 text-sm text-[color:var(--foreground)] bg-[color:var(--panel-sunken)] outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--phosphor)]"
            aria-label="Search patches"
          />
          <div className="flex gap-1 overflow-x-auto pb-1">
            {BROWSER_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={`silkscreen-strong shrink-0 rounded-md border px-2 py-1.5 text-[0.55rem] min-h-10 ${
                  filter === c
                    ? "border-[color:var(--phosphor)] text-[color:var(--phosphor)]"
                    : "border-[color:var(--hairline)] text-[color:var(--silkscreen-dim)]"
                }`}
              >
                {c === "EXPERIMENTAL" ? "EXP" : c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSave}
              className="silkscreen-strong border border-[color:var(--hairline)] rounded-md px-3 py-2 text-[0.6rem] min-h-11"
            >
              SAVE
            </button>
            <button
              type="button"
              onClick={onRestoreFactory}
              className="silkscreen-strong border border-[color:var(--hairline)] rounded-md px-3 py-2 text-[0.6rem] min-h-11"
            >
              RESTORE FACTORY
            </button>
          </div>
        </div>

        <ul className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1" role="listbox">
          {filtered.map((p) => {
            const source = isUserPatch(p) ? "USER" : "FACTORY";
            const active = p.id === currentId;
            const fav = favorites.has(p.id);
            return (
              <li key={p.id}>
                <div
                  className={`flex items-stretch gap-1 rounded-md border ${
                    active
                      ? "border-[color:var(--phosphor)] bg-[color:var(--panel-sunken)]"
                      : "border-[color:var(--hairline)]"
                  }`}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => onSelect(p.id)}
                    className="flex-1 min-w-0 text-left px-3 py-3 min-h-12"
                    data-tx80-preset-row={p.id}
                  >
                    <div className="readout text-sm truncate">{p.name}</div>
                    <div className="silkscreen text-[0.55rem]">
                      {p.category} · {source}
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={fav ? "Remove favorite" : "Add favorite"}
                    aria-pressed={fav}
                    onClick={() => onToggleFavorite(p.id)}
                    className={`px-3 min-w-11 ${fav ? "text-[color:var(--amber)]" : "text-[color:var(--amber-dim)]"}`}
                  >
                    {fav ? "★" : "☆"}
                  </button>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="silkscreen text-center py-8">NO MATCHES</li>
          )}
        </ul>
      </div>
    </div>
  );
}
