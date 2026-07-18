import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Patch } from "@/lib/audio/types";
import { clonePatch } from "@/lib/presets";
import { patchesEqual } from "@/lib/patch-library/comparison";
import { FACTORY_LIBRARY } from "@/lib/patch-library/factory";
import {
  buildUserMetadata,
  ensureUniqueId,
  sanitizeName,
} from "@/lib/patch-library/metadata";
import {
  exportLibraryFile,
  exportPresetFile,
  parseImportText,
} from "@/lib/patch-library/importExport";
import { collectTags } from "@/lib/patch-library/search";
import {
  loadFavorites,
  loadRecent,
  loadUserLibrary,
  saveFavorites,
  saveRecent,
  saveUserLibrary,
} from "@/lib/patch-library/storage";
import {
  DEFAULT_USER_AUTHOR,
  DEFAULT_USER_PACK,
  MAX_IMPORT_FILE_BYTES,
  MAX_RECENT,
  type ImportSummary,
  type LibraryEntry,
  type PresetCategory,
} from "@/lib/patch-library/types";

export type LibraryDialogState =
  | { kind: "none" }
  | { kind: "saveAs"; thenLoadId: string | null }
  | { kind: "rename"; id: string }
  | { kind: "confirmDelete"; id: string }
  | { kind: "confirmDiscard"; targetId: string };

export interface SaveAsFields {
  name: string;
  author: string;
  pack: string;
  category: PresetCategory;
  tags: string[];
  description: string;
}

type UiModeLike = "full" | "editor" | "performance";

export interface UsePatchLibraryArgs {
  /** Current (live) patch state from the synth. */
  patch: Patch;
  /** The authoritative patch-application path (clone → patchRef → UI state →
   *  DSP / audio init). All preset loading goes through this. */
  applyPatch: (p: Patch) => void;
  /** Live UI mode; loading a preset in PLAY auto-closes the browser. */
  uiModeRef: { readonly current: UiModeLike };
  /** Called right before the overlay opens (release held notes etc.). */
  onBeforeOpen?: () => void;
  /** Global CONFIRM PRESET CHANGE setting (read through a ref so changing it
   *  re-renders nothing here). When present and false, requestLoad skips the
   *  unsaved-changes dialog and loads immediately. Defaults to confirming. */
  confirmDiscardRef?: { readonly current: boolean };
}

/**
 * Owns all patch-library state: user entries, favorites, recent, active
 * preset reference, unsaved-change detection, dialogs, and import/export.
 * The audio engine is never touched directly — only through applyPatch.
 */
export function usePatchLibrary({
  patch,
  applyPatch,
  uiModeRef,
  onBeforeOpen,
  confirmDiscardRef,
}: UsePatchLibraryArgs) {
  const [userEntries, setUserEntries] = useState<LibraryEntry[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  // The app boots showing factory preset 1 (same clone the synth starts with).
  const [activeId, setActiveId] = useState<string | null>(FACTORY_LIBRARY[0]?.meta.id ?? null);
  const [reference, setReference] = useState<Patch>(() => clonePatch(FACTORY_LIBRARY[0].patch));
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dialog, setDialog] = useState<LibraryDialogState>({ kind: "none" });
  const [importSummary, setImportSummary] = useState<string | null>(null);

  // Load persisted state after mount (SSR renders none of it, so this can
  // never cause a hydration mismatch). Legacy patches migrate here once.
  useEffect(() => {
    setUserEntries(loadUserLibrary());
    setFavorites(loadFavorites());
    setRecent(loadRecent());
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const allEntries = useMemo(() => [...FACTORY_LIBRARY, ...userEntries], [userEntries]);
  const entryMap = useMemo(() => {
    const m = new Map<string, LibraryEntry>();
    for (const e of allEntries) m.set(e.meta.id, e);
    return m;
  }, [allEntries]);
  const orderedIds = useMemo(() => allEntries.map((e) => e.meta.id), [allEntries]);
  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);
  const allTags = useMemo(() => collectTags(allEntries), [allEntries]);

  const getEntry = useCallback((id: string) => entryMap.get(id), [entryMap]);
  const activeEntry = activeId ? entryMap.get(activeId) ?? null : null;
  const activeIsUser = activeEntry?.meta.source === "user";

  /** True when the current normalized patch differs from the loaded preset. */
  const edited = useMemo(() => !patchesEqual(patch, reference), [patch, reference]);
  /** LCD badge: UNSAVED (no preset reference) / EDITED (params differ). */
  const statusLabel = activeId === null ? "UNSAVED" : edited ? "EDITED" : null;

  // ── Recent ────────────────────────────────────────────────────────────────
  const pushRecent = useCallback((id: string) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENT);
      saveRecent(next);
      return next;
    });
  }, []);

  // ── Loading ───────────────────────────────────────────────────────────────
  const doLoad = useCallback(
    (entry: LibraryEntry) => {
      applyPatch(entry.patch); // clones + normalizes + initializes audio if needed
      setActiveId(entry.meta.id);
      setReference(clonePatch(entry.patch));
      pushRecent(entry.meta.id);
      // In PLAY mode, return straight to the keyboard after loading.
      if (uiModeRef.current === "performance") setLibraryOpen(false);
    },
    [applyPatch, pushRecent, uiModeRef],
  );

  /** Guarded entry point used by every preset-selection surface. */
  const requestLoad = useCallback(
    (id: string) => {
      const entry = entryMap.get(id);
      if (!entry) return;
      if (activeId === id && !edited) {
        // Double-tap on the already-loaded preset: no duplicate load; still
        // honor the PLAY-mode auto-close so the tap returns to the keyboard.
        if (uiModeRef.current === "performance") setLibraryOpen(false);
        return;
      }
      if (edited && (confirmDiscardRef?.current ?? true)) {
        setDialog({ kind: "confirmDiscard", targetId: id });
        return;
      }
      // Either nothing is edited, or the global setting says: don't ask.
      doLoad(entry);
    },
    [entryMap, activeId, edited, doLoad, uiModeRef, confirmDiscardRef],
  );

  const loadNeighbor = useCallback(
    (dir: 1 | -1) => {
      if (orderedIds.length === 0) return;
      const idx = activeId ? orderedIds.indexOf(activeId) : -1;
      const next =
        idx === -1
          ? dir > 0
            ? 0
            : orderedIds.length - 1
          : (idx + dir + orderedIds.length) % orderedIds.length;
      requestLoad(orderedIds[next]);
    },
    [orderedIds, activeId, requestLoad],
  );

  // ── Favorites ─────────────────────────────────────────────────────────────
  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveFavorites(next);
      return next;
    });
  }, []);

  // ── INIT / RND integration ───────────────────────────────────────────────
  /** Current sound no longer corresponds to a stored preset (INIT, RND). */
  const markUnsaved = useCallback((p: Patch) => {
    setActiveId(null);
    setReference(clonePatch(p));
  }, []);

  // ── Dialog begins ─────────────────────────────────────────────────────────
  const cancelDialog = useCallback(() => setDialog({ kind: "none" }), []);
  const beginSaveAs = useCallback(() => setDialog({ kind: "saveAs", thenLoadId: null }), []);
  const beginRename = useCallback(
    (id: string) => {
      const e = entryMap.get(id);
      if (e?.meta.source === "user") setDialog({ kind: "rename", id });
    },
    [entryMap],
  );
  const beginDelete = useCallback(
    (id: string) => {
      const e = entryMap.get(id);
      if (e?.meta.source === "user") setDialog({ kind: "confirmDelete", id });
    },
    [entryMap],
  );

  // ── Save As ───────────────────────────────────────────────────────────────
  const submitSaveAs = useCallback(
    (fields: SaveAsFields) => {
      if (!sanitizeName(fields.name, "")) return; // dialog validates; belt & braces
      const meta = buildUserMetadata(fields, new Set(orderedIds));
      const savedPatch = clonePatch(patch);
      savedPatch.name = meta.name;
      const entry: LibraryEntry = { meta, patch: savedPatch };
      setUserEntries((prev) => {
        const next = [...prev, entry];
        saveUserLibrary(next);
        return next;
      });
      const thenLoadId = dialog.kind === "saveAs" ? dialog.thenLoadId : null;
      setDialog({ kind: "none" });
      if (thenLoadId) {
        // Save-then-load continuation from the discard-changes flow.
        const target = entryMap.get(thenLoadId);
        if (target) doLoad(target);
      } else {
        // The newly saved preset becomes the active, no-longer-unsaved one.
        applyPatch(savedPatch);
        setActiveId(meta.id);
        setReference(clonePatch(savedPatch));
        pushRecent(meta.id);
      }
    },
    [patch, orderedIds, dialog, entryMap, doLoad, applyPatch, pushRecent],
  );

  const saveDefaults = useMemo<SaveAsFields>(
    () => ({
      name: activeEntry?.meta.name ?? patch.name,
      author: DEFAULT_USER_AUTHOR,
      pack: DEFAULT_USER_PACK,
      category: activeEntry?.meta.category ?? "UNCATEGORIZED",
      tags: activeEntry?.meta.tags ?? [],
      description: "",
    }),
    [activeEntry, patch.name],
  );

  // ── Rename ────────────────────────────────────────────────────────────────
  const submitRename = useCallback(
    (name: string) => {
      if (dialog.kind !== "rename") return;
      const clean = sanitizeName(name, "");
      if (!clean) return;
      const id = dialog.id;
      const now = new Date().toISOString();
      setUserEntries((prev) => {
        const next = prev.map((e) =>
          e.meta.id === id
            ? {
                meta: { ...e.meta, name: clean, updatedAt: now },
                patch: { ...clonePatch(e.patch), name: clean },
              }
            : e,
        );
        saveUserLibrary(next);
        return next;
      });
      if (activeId === id) {
        // ID, favorites and recent references are untouched by design.
        applyPatch({ ...patch, name: clean });
        setReference((r) => ({ ...r, name: clean }));
      }
      setDialog({ kind: "none" });
    },
    [dialog, activeId, patch, applyPatch],
  );

  // ── Delete ────────────────────────────────────────────────────────────────
  const confirmDelete = useCallback(() => {
    if (dialog.kind !== "confirmDelete") return;
    const id = dialog.id;
    setUserEntries((prev) => {
      const next = prev.filter((e) => e.meta.id !== id);
      saveUserLibrary(next);
      return next;
    });
    // Remove orphaned references.
    setFavorites((prev) => {
      if (!prev.includes(id)) return prev;
      const next = prev.filter((x) => x !== id);
      saveFavorites(next);
      return next;
    });
    setRecent((prev) => {
      if (!prev.includes(id)) return prev;
      const next = prev.filter((x) => x !== id);
      saveRecent(next);
      return next;
    });
    if (activeId === id) {
      // Keep the current sound playing; it just no longer references a
      // stored preset, so it reads as UNSAVED until saved again.
      setActiveId(null);
    }
    setDialog({ kind: "none" });
  }, [dialog, activeId]);

  // ── Discard-changes flow ──────────────────────────────────────────────────
  const confirmDiscard = useCallback(() => {
    if (dialog.kind !== "confirmDiscard") return;
    const target = entryMap.get(dialog.targetId);
    setDialog({ kind: "none" });
    if (target) doLoad(target);
  }, [dialog, entryMap, doLoad]);

  const discardToSaveAs = useCallback(() => {
    if (dialog.kind !== "confirmDiscard") return;
    setDialog({ kind: "saveAs", thenLoadId: dialog.targetId });
  }, [dialog]);

  // ── Duplicate ─────────────────────────────────────────────────────────────
  const duplicateEntry = useCallback(
    (id: string) => {
      const e = entryMap.get(id);
      if (!e) return;
      const now = new Date().toISOString();
      const name = sanitizeName(`${e.meta.name} Copy`);
      const patchCopy = clonePatch(e.patch);
      patchCopy.name = name;
      const entry: LibraryEntry = {
        meta: {
          ...e.meta,
          id: ensureUniqueId(null, new Set(orderedIds)),
          name,
          tags: [...e.meta.tags],
          source: "user",
          pack: DEFAULT_USER_PACK,
          createdAt: now,
          updatedAt: now,
        },
        patch: patchCopy,
      };
      setUserEntries((prev) => {
        const next = [...prev, entry];
        saveUserLibrary(next);
        return next;
      });
    },
    [entryMap, orderedIds],
  );

  // ── Import / export ───────────────────────────────────────────────────────
  const importFiles = useCallback(
    async (files: FileList | File[]): Promise<ImportSummary> => {
      const list = Array.from(files);
      const workingIds = new Set(orderedIds);
      const newEntries: LibraryEntry[] = [];
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      for (const f of list) {
        if (f.size > MAX_IMPORT_FILE_BYTES) {
          errors.push("FILE TOO LARGE");
          continue;
        }
        let text: string;
        try {
          text = await f.text();
        } catch {
          errors.push("READ FAILED");
          continue;
        }
        const res = parseImportText(text, workingIds);
        if (res.error) {
          errors.push(res.error);
          continue;
        }
        for (const e of res.entries) {
          workingIds.add(e.meta.id);
          newEntries.push(e);
        }
        imported += res.entries.length;
        skipped += res.skipped;
      }
      if (newEntries.length > 0) {
        setUserEntries((prev) => {
          const next = [...prev, ...newEntries];
          saveUserLibrary(next);
          return next;
        });
      }
      const parts = [`IMPORTED ${imported}`];
      if (skipped > 0) parts.push(`SKIPPED ${skipped}`);
      if (errors.length > 0) parts.push(errors[0]);
      const message = parts.join(" · ");
      setImportSummary(message);
      return { imported, skipped, message };
    },
    [orderedIds],
  );

  const exportEntryById = useCallback(
    (id: string) => {
      const e = entryMap.get(id);
      if (e) exportPresetFile(e);
    },
    [entryMap],
  );

  const exportUserLibrary = useCallback(() => {
    if (userEntries.length > 0) exportLibraryFile(userEntries);
  }, [userEntries]);

  // ── Overlay open/close ────────────────────────────────────────────────────
  const openLibrary = useCallback(() => {
    onBeforeOpen?.(); // release held notes so nothing can get stuck under the overlay
    setImportSummary(null);
    setLibraryOpen(true);
  }, [onBeforeOpen]);

  const closeLibrary = useCallback(() => {
    setLibraryOpen(false);
    setDialog({ kind: "none" });
  }, []);

  return {
    // data
    factoryEntries: FACTORY_LIBRARY,
    userEntries,
    allEntries,
    favorites,
    favoritesSet,
    recent,
    allTags,
    getEntry,
    activeId,
    activeEntry,
    activeIsUser,
    edited,
    statusLabel,
    // overlay
    libraryOpen,
    openLibrary,
    closeLibrary,
    // loading
    requestLoad,
    loadNeighbor,
    // favorites
    toggleFavorite,
    // unsaved integration
    markUnsaved,
    // dialogs
    dialog,
    cancelDialog,
    beginSaveAs,
    beginRename,
    beginDelete,
    submitSaveAs,
    submitRename,
    confirmDelete,
    confirmDiscard,
    discardToSaveAs,
    saveDefaults,
    // actions
    duplicateEntry,
    importFiles,
    exportEntryById,
    exportUserLibrary,
    importSummary,
  };
}

export type LibraryController = ReturnType<typeof usePatchLibrary>;
