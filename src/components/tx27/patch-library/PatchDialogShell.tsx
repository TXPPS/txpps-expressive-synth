import { useEffect, useRef } from "react";
import { trapTabKey } from "./focusTrap";

/**
 * Shared chrome for the library's modal dialogs (save, rename, confirms).
 * Renders above the library overlay, traps focus, closes on Escape and
 * backdrop tap. Focus is restored by the opener (library panel effect or
 * the LIBRARY-button effect in the route).
 */
export function PatchDialogShell({
  title,
  onCancel,
  children,
  wide = false,
}: {
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Focus the first interactive element so keyboard users land inside.
    const first = panelRef.current?.querySelector<HTMLElement>(
      "input, textarea, select, button",
    );
    first?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }
    trapTabKey(e, panelRef.current);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={onKeyDown}
        className={`tx-panel relative w-full ${wide ? "max-w-md" : "max-w-sm"} p-3 flex flex-col gap-2 max-h-[86dvh] overflow-y-auto`}
      >
        <div className="text-[10px] tracking-[0.3em] text-tx-muted pb-1.5 border-b border-black/40">
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}
