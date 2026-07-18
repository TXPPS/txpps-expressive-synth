import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  placeholder?: boolean;
  className?: string;
  accent?: "phosphor" | "amber" | "none";
}

export function Panel({ title, subtitle, children, placeholder, className, accent = "none" }: PanelProps) {
  return (
    <section
      className={`panel relative flex flex-col p-3 sm:p-4 ${className ?? ""}`}
      aria-label={title}
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {accent === "phosphor" && <span className="led shrink-0" aria-hidden />}
          {accent === "amber" && <span className="led-amber shrink-0" aria-hidden />}
          <h2 className="silkscreen-strong truncate">{title}</h2>
        </div>
        {subtitle && <span className="silkscreen shrink-0">{subtitle}</span>}
      </header>
      <div className="flex-1 min-w-0">{children}</div>
      {placeholder && <span className="placeholder-tag">M1 stub</span>}
    </section>
  );
}
