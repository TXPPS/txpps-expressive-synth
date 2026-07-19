import { useCallback, useEffect, useMemo, useState } from "react";
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
  type UserPatch,
} from "@/state/presets";

export function PresetBar() {
  const { currentPreset, setCurrentPreset, patch, loadPatch } = useSynthStore();
  const [userPatches, setUserPatches] = useState<UserPatch[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);

  const catalog = useMemo(() => allBrowsablePatches(userPatches), [userPatches]);

  const applyPatchById = useCallback(
    (id: string) => {
      const factory = findFactoryPatch(id);
      if (factory) {
        loadPatch(factory.values);
        setCurrentPreset(toPresetMeta(factory, "factory"));
        saveLastPresetId(id);
        return;
      }
      const user = userPatches.find((p) => p.id === id);
      if (user) {
        loadPatch(user.values);
        setCurrentPreset(toPresetMeta(user, "user"));
        saveLastPresetId(id);
      }
    },
    [loadPatch, setCurrentPreset, userPatches],
  );

  useEffect(() => {
    const users = loadUserPatches();
    setUserPatches(users);
    setFavorites(loadFavorites());
    const last = loadLastPresetId();
    const initial =
      (last && (findFactoryPatch(last) || users.find((u) => u.id === last)) && last) ||
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
    applyPatchById(next.id);
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
  };

  const isFav = currentPreset ? favorites.has(currentPreset.id) : false;

  return (
    <div className="panel-sunken mx-3 sm:mx-4 my-2 px-3 py-2 flex items-center gap-2 sm:gap-3">
      <button
        type="button"
        aria-label="Previous preset"
        onClick={() => step(-1)}
        disabled={!ready}
        className="silkscreen-strong text-[color:var(--phosphor-dim)] hover:text-[color:var(--phosphor)] shrink-0 disabled:opacity-40"
      >
        ◀
      </button>
      <div className="flex-1 min-w-0">
        <div className="silkscreen">PATCH</div>
        <div className="readout truncate text-base sm:text-lg font-semibold">
          {currentPreset?.name ?? "— init —"}
        </div>
        <div className="silkscreen truncate">
          {currentPreset
            ? `${currentPreset.category} · ${currentPreset.source.toUpperCase()}`
            : "no preset"}
        </div>
      </div>
      <button
        type="button"
        aria-label="Save current patch"
        onClick={saveCurrent}
        className="silkscreen-strong text-[color:var(--silkscreen)] hover:text-[color:var(--phosphor)] shrink-0 text-[0.6rem] border border-[color:var(--hairline)] rounded px-1.5 py-1"
      >
        SAVE
      </button>
      <button
        type="button"
        aria-label="Favorite preset"
        aria-pressed={isFav}
        onClick={toggleFavorite}
        className={`silkscreen-strong shrink-0 ${
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
        className="silkscreen-strong text-[color:var(--phosphor-dim)] hover:text-[color:var(--phosphor)] shrink-0 disabled:opacity-40"
      >
        ▶
      </button>
    </div>
  );
}
