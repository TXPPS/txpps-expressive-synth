import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

export interface TxSelectOption<T extends string | number> {
  value: T;
  label: string;
}

/**
 * Fully themed replacement for the native <select>. The trigger reuses the
 * existing `tx-select` chassis chrome (chevron included); the option list is
 * an LCD-phosphor listbox in the same display language as the preset quick
 * access panel — no browser-native popup anywhere.
 *
 * Behavior notes:
 * · The list renders position:fixed from the trigger rect, so it escapes
 *   overflow-clipping ancestors (dialog shells scroll) without a portal —
 *   staying inside the same DOM subtree keeps dialog focus traps working.
 * · All keydowns inside trigger-open state and the list stop propagation, so
 *   typing while the list is open can never reach the computer-keyboard
 *   piano handler on window.
 * · Outside pointerdown, Escape, Tab, resize and (outside) scroll close it.
 *   Focus returns to the trigger on Escape/Tab/selection.
 */
export function TxSelect<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  style,
}: {
  value: T;
  options: ReadonlyArray<TxSelectOption<T>>;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);

  const selected = options.find((o) => o.value === value);
  const selectedIndex = options.findIndex((o) => o.value === value);

  // Position the fixed list under (or, when space is short, above) the trigger.
  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const maxH = Math.min(320, window.innerHeight * 0.45);
    const below = window.innerHeight - rect.bottom;
    const top = below >= Math.min(maxH, 160) || below >= rect.top
      ? rect.bottom + 2
      : Math.max(4, rect.top - 2 - maxH);
    setPos({ left: rect.left, top, width: rect.width });
  }, [open]);

  // Focus the selected option when the list opens.
  useEffect(() => {
    if (!open) return;
    const target = optionRefs.current[selectedIndex >= 0 ? selectedIndex : 0];
    target?.focus();
    // Focus once per open only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside pointerdown, resize, and scrolls outside the list.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (listRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    const onScroll = (e: Event) => {
      if (listRef.current && e.target instanceof Node && listRef.current.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const closeAndRefocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const select = (v: T) => {
    onChange(v);
    closeAndRefocus();
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    // Shield the global computer-keyboard piano while the list is open.
    e.stopPropagation();
    if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      closeAndRefocus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const nodes = optionRefs.current.filter((n): n is HTMLButtonElement => n !== null);
    if (nodes.length === 0) return;
    const cur = nodes.findIndex((n) => n === document.activeElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? nodes.length - 1
          : e.key === "ArrowDown"
            ? (cur + 1 + nodes.length) % nodes.length
            : (cur - 1 + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`tx-select ${className}`}
        style={style}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {selected?.label ?? String(value)}
      </button>
      {open && pos && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          onKeyDown={onListKeyDown}
          className="tx-lcd-box fixed z-[100] overflow-y-auto overscroll-contain"
          style={{
            left: pos.left,
            top: pos.top,
            minWidth: pos.width,
            maxHeight: "min(45vh, 320px)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.75), inset 0 0 10px rgba(0,0,0,0.55)",
          }}
        >
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <button
                key={String(o.value)}
                type="button"
                role="option"
                aria-selected={isSel}
                ref={(n) => {
                  optionRefs.current[i] = n;
                }}
                className={`w-full min-h-9 flex items-center gap-2 px-2.5 text-left text-[11px] tracking-widest uppercase ${
                  isSel ? "bg-white/10" : "hover:bg-white/5"
                }`}
                onClick={() => select(o.value)}
              >
                <span className="shrink-0 w-3 text-[9px]">{isSel ? "▸" : ""}</span>
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
