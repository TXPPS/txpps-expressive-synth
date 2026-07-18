import { tagKey } from "./metadata";
import type { LibraryEntry, PresetCategory } from "./types";

/** Stacked filter set applied on top of the source tab. */
export interface LibraryFilterState {
  pack: string | null;
  category: PresetCategory | null;
  /** AND semantics: an entry must contain every selected tag. */
  tags: string[];
}

export const EMPTY_FILTERS: LibraryFilterState = { pack: null, category: null, tags: [] };

// Search haystacks are cached per entry object; entries are treated as
// immutable (every mutation in the library creates a new entry object).
const searchTextCache = new WeakMap<LibraryEntry, string>();

export function entrySearchText(e: LibraryEntry): string {
  const cached = searchTextCache.get(e);
  if (cached) return cached;
  const m = e.meta;
  const text = [m.name, m.category, m.tags.join(" "), m.author, m.pack, m.description, m.source]
    .join(" ")
    .toLowerCase();
  searchTextCache.set(e, text);
  return text;
}

/** Case-insensitive multi-word match: every whitespace-separated term must
 *  appear somewhere in the entry's searchable text. Pure and offline. */
export function matchesQuery(e: LibraryEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = entrySearchText(e);
  return q.split(/\s+/).every((term) => hay.includes(term));
}

export function filterEntries(
  entries: readonly LibraryEntry[],
  query: string,
  filters: LibraryFilterState,
): LibraryEntry[] {
  const tagKeys = filters.tags.map(tagKey);
  return entries.filter((e) => {
    if (filters.pack && e.meta.pack !== filters.pack) return false;
    if (filters.category && e.meta.category !== filters.category) return false;
    if (tagKeys.length) {
      const entryKeys = new Set(e.meta.tags.map(tagKey));
      for (const k of tagKeys) if (!entryKeys.has(k)) return false;
    }
    return matchesQuery(e, query);
  });
}

/** Distinct packs across entries, factory pack first, then alphabetical. */
export function collectPacks(entries: readonly LibraryEntry[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of entries) {
    if (!e.meta.pack || seen.has(e.meta.pack)) continue;
    seen.add(e.meta.pack);
    out.push(e.meta.pack);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** Distinct tags (case-insensitive, first display form wins), alphabetical. */
export function collectTags(entries: readonly LibraryEntry[]): string[] {
  const seen = new Map<string, string>();
  for (const e of entries) {
    for (const t of e.meta.tags) {
      const k = tagKey(t);
      if (!seen.has(k)) seen.set(k, t);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
