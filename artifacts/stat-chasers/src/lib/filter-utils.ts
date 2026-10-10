import { cn } from "@/lib/utils";

export type QbFilter = "superflex" | "one_qb";
export type ScoringFilter = "ppr" | "half_ppr";
export type TepFilter = "tep" | "no_tep";
export type SizeFilter = "10" | "12";
export type SeasonFilter = "2021" | "2022" | "2023" | "2024" | "2025" | "compare";

export interface Filters {
  qb: QbFilter;
  scoring: ScoringFilter;
  tep: TepFilter;
  size: SizeFilter;
  season: SeasonFilter;
}

export function filtersToKey(f: Filters): string {
  return `${f.qb}__${f.scoring}__${f.tep}__${f.size}__${f.season}`;
}

export type UnsupportedFormat = {
  qb: QbFilter;
  scoring: ScoringFilter;
  tep: TepFilter;
  size: SizeFilter;
};

// League settings that combine into a format with too few sampled leagues to
// report reliably. These exact combinations are not offered as selectable
// options in the filter bar. Add or remove entries here to change what's blocked.
export const UNSUPPORTED_FORMATS: UnsupportedFormat[] = [
  { qb: "one_qb", scoring: "half_ppr", tep: "tep", size: "10" },
  { qb: "superflex", scoring: "half_ppr", tep: "tep", size: "10" },
];

type FormatKey = keyof UnsupportedFormat;
const FORMAT_KEYS: FormatKey[] = ["qb", "scoring", "tep", "size"];

/** True when the format dimensions of `f` exactly match any unsupported combo. */
export function isUnsupportedFormat(f: Pick<Filters, FormatKey>): boolean {
  return UNSUPPORTED_FORMATS.some((spec) =>
    FORMAT_KEYS.every((k) => f[k] === spec[k]),
  );
}

/**
 * True when choosing `value` for dimension `key` would land on an unsupported
 * format — i.e. some unsupported combo pins `key` to `value` and the other
 * three dimensions already match. Used to disable the completing pill.
 */
export function wouldSelectUnsupportedFormat<K extends FormatKey>(
  current: Pick<Filters, FormatKey>,
  key: K,
  value: Filters[K],
): boolean {
  return UNSUPPORTED_FORMATS.some(
    (spec) =>
      spec[key] === value &&
      FORMAT_KEYS.every((k) => k === key || current[k] === spec[k]),
  );
}

/**
 * If `f` sits on an unsupported format, nudge it to the nearest supported
 * variant (12-team) so a stale URL never renders an empty view.
 */
export function coerceSupportedFormat(f: Filters): Filters {
  return isUnsupportedFormat(f) ? { ...f, size: "12" } : f;
}

export function pillClass(active: boolean, extra?: string, disabled?: boolean) {
  return cn(
    "flex flex-none items-center justify-center px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
    disabled
      ? "cursor-not-allowed text-[var(--rs-app-text-muted)]/45"
      : active
        ? "bg-[var(--rs-app-blue)] dark:bg-[#0b3a7a]/60 text-white border border-[#d4af37]/25"
        : "text-[var(--rs-app-text-muted)] hover:text-[var(--rs-app-blue)] dark:text-white/40 dark:hover:text-white/70",
    extra,
  );
}
