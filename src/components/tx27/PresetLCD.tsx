import type { ReactNode, Ref } from "react";
import type { Patch } from "@/lib/audio/types";
import type { LibraryController } from "@/components/tx27/patch-library/usePatchLibrary";

/**
 * The integrated preset-navigation LCD: one hardware-style display that owns
 * previous/next, favorite state, patch info, and quick access. Replaces the
 * old native select + separate arrow/★/LIBRARY buttons.
 *
 * Everything is phosphor-on-black via the existing `tx-lcd-box` display
 * language, so the amber Vintage shift applies automatically through the
 * `--tx-lcd*` CSS variables.
 */
interface PresetLCDProps {
  library: LibraryController;
  patch: Patch;
  audioError: boolean;
  /** Output meter node (already gated by UI mode in the parent). */
  meterSlot?: ReactNode;
  quickAccessOpen: boolean;
  onToggleQuickAccess: () => void;
  /** Ref to the central info button — focus returns here when overlays close. */
  centerRef: Ref<HTMLButtonElement>;
}

const EDGE_BORDER = { borderColor: "var(--tx-lcd-dim)" } as const;

export function PresetLCD({
  library,
  patch,
  audioError,
  meterSlot,
  quickAccessOpen,
  onToggleQuickAccess,
  centerRef,
}: PresetLCDProps) {
  const entry = library.activeEntry;
  const activeFav = library.activeId ? library.favoritesSet.has(library.activeId) : false;

  // Position within its own bank: "3/15" for factory, "U2/7" for user.
  let positionLine = "NOT STORED";
  if (entry) {
    const bank = entry.meta.source === "factory" ? library.factoryEntries : library.userEntries;
    const idx = bank.findIndex((e) => e.meta.id === entry.meta.id);
    const pos = `${entry.meta.source === "user" ? "U" : ""}${idx + 1}/${bank.length}`;
    positionLine = `${pos} · ${entry.meta.category} · ${entry.meta.pack.toUpperCase()}`;
  }

  return (
    <div className="tx-lcd-box w-full flex items-stretch overflow-hidden" style={{ minHeight: 64 }}>
      {/* Previous — embedded in the left edge of the screen. Sibling of the
          central button, so taps can never bubble into quick access. */}
      <button
        type="button"
        className="w-11 shrink-0 flex items-center justify-center text-lg border-r hover:bg-white/5 active:bg-white/10"
        style={EDGE_BORDER}
        onClick={() => library.loadNeighbor(-1)}
        aria-label="Previous preset"
      >
        ◀
      </button>

      {/* Central preset information — an accessible button opening quick access. */}
      <button
        type="button"
        ref={centerRef}
        className="flex-1 min-w-0 px-2 py-1.5 text-left flex flex-col justify-center gap-0.5 hover:bg-white/5 active:bg-white/10"
        onClick={onToggleQuickAccess}
        aria-haspopup="dialog"
        aria-expanded={quickAccessOpen}
        aria-label="Open preset quick access"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-[8px] uppercase opacity-60 leading-none tracking-[0.25em]">PATCH</span>
          <span className="flex-1" />
          {audioError && (
            <span className="text-[8px] tracking-widest shrink-0" style={{ color: "var(--tx-red)" }}>
              AUDIO ERR
            </span>
          )}
          {meterSlot}
        </span>
        <span className="flex items-baseline gap-1.5 min-w-0">
          <span className="truncate text-base sm:text-lg font-bold leading-tight">{patch.name}</span>
          {library.statusLabel && (
            <span
              className="shrink-0 text-[7px] tracking-widest px-1 border rounded-sm"
              style={EDGE_BORDER}
            >
              {library.statusLabel}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 min-w-0 text-[9px] leading-none opacity-75">
          <span className="truncate">{positionLine}</span>
          <span className="flex-1" />
          <span className="hidden sm:inline shrink-0">
            ALG {patch.algorithm} · {patch.voiceMode.toUpperCase()} {patch.polyphony}
          </span>
          <span className="shrink-0">
            AGE {Math.round(patch.vintage.age * 100)}% · {patch.vintage.enabled ? "VINTAGE" : "CLEAN"}
          </span>
        </span>
      </button>

      {/* Favorite — phosphor star embedded in the display. Never marks the
          patch edited (it only touches favorites storage). */}
      <button
        type="button"
        className="w-11 shrink-0 flex items-center justify-center text-base border-l hover:bg-white/5 active:bg-white/10 disabled:opacity-40"
        style={EDGE_BORDER}
        onClick={() => library.activeId && library.toggleFavorite(library.activeId)}
        disabled={!library.activeId}
        aria-pressed={activeFav}
        aria-label={activeFav ? "Remove preset from favorites" : "Add preset to favorites"}
      >
        <span style={activeFav ? { textShadow: "0 0 8px var(--tx-lcd)" } : { opacity: 0.55 }}>
          {activeFav ? "★" : "☆"}
        </span>
      </button>

      {/* Next — embedded in the right edge. */}
      <button
        type="button"
        className="w-11 shrink-0 flex items-center justify-center text-lg border-l hover:bg-white/5 active:bg-white/10"
        style={EDGE_BORDER}
        onClick={() => library.loadNeighbor(1)}
        aria-label="Next preset"
      >
        ▶
      </button>
    </div>
  );
}
