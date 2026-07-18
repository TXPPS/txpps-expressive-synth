export function PatchLibraryHeader({
  shown,
  total,
  onClose,
}: {
  shown: number;
  total: number;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-black/40 shrink-0">
      <div className="flex-1 min-w-0">
        <div className="text-[9px] tracking-[0.3em] text-tx-muted leading-none">TXPPS</div>
        <div className="text-sm font-bold tracking-widest text-tx-cream leading-tight">
          PATCH LIBRARY
        </div>
      </div>
      <div className="tx-lcd-box px-2 py-1 text-[10px] shrink-0" aria-live="polite">
        {shown}/{total}
      </div>
      <button
        type="button"
        className="tx-btn shrink-0"
        style={{ minHeight: 44, minWidth: 44 }}
        onClick={onClose}
        aria-label="Close patch library"
      >
        ✕
      </button>
    </div>
  );
}
