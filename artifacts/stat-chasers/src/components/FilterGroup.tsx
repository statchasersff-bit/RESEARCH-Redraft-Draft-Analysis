import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A labeled filter group: bold label (hidden on narrow) + a rounded, bordered
    "track" that holds the pills. The group and its track are always content-width
    and flow inline (wrapping as needed) rather than stretching full-width — so the
    filter bar stays a compact toolbar instead of a tall stack on narrow screens.
    Matches the "Segmented" control from the Filter Pills & Design Kit spec — an
    enclosed track that reads as a radio-style single-select. Height and text size
    (12px via text-xs) are derived to match the Strategy Ranking sort toggle. */
export function FilterGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 w-auto", className)}>
      <span className="hidden sm:inline text-xs font-bold tracking-[0.02em] text-slate-400/90 flex-shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1 p-1 rounded-lg text-xs bg-[var(--rs-app-card-soft)] border border-[var(--rs-app-border)] dark:bg-white/[0.03] dark:border-white/6 w-auto">
        {children}
      </div>
    </div>
  );
}

