import { forwardRef } from "react";

/** Search field. ArrowDown moves focus into the result list; Escape clears
 *  the query first (and only closes the library when already empty). */
export const PatchSearch = forwardRef<HTMLInputElement, {
  query: string;
  onChange: (q: string) => void;
  onArrowDown: () => void;
}>(function PatchSearch({ query, onChange, onArrowDown }, ref) {
  return (
    <div className="relative">
      <input
        ref={ref}
        className="tx-lcd-box w-full pl-2 pr-9 text-[12px] tracking-wider outline-none focus:ring-1 focus:ring-[color:var(--tx-lcd-dim)]"
        style={{ minHeight: 40 }}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onArrowDown();
          } else if (e.key === "Escape" && query) {
            e.preventDefault();
            e.stopPropagation(); // clear instead of closing the library
            onChange("");
          }
        }}
        placeholder="SEARCH NAME · TAG · PACK · AUTHOR"
        aria-label="Search presets"
        autoComplete="off"
        spellCheck={false}
      />
      {query && (
        <button
          type="button"
          className="absolute right-1 top-1/2 -translate-y-1/2 tx-btn px-2"
          style={{ minHeight: 30, paddingTop: 2, paddingBottom: 2 }}
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
});
