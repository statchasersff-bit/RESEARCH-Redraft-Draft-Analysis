import { useEffect, useState, type ReactNode } from "react";
import { FilterGroup } from "@/components/FilterGroup";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pillClass, wouldSelectUnsupportedFormat, type QbFilter, type ScoringFilter, type TepFilter, type SizeFilter, type SeasonFilter, type Filters } from "@/lib/filter-utils";
export type { QbFilter, ScoringFilter, TepFilter, SizeFilter, SeasonFilter, Filters } from "@/lib/filter-utils";
export { filtersToKey } from "@/lib/filter-utils";

// Fires under the `sm` breakpoint (640px) — matches where FilterGroup hides its
// label and pills switch to full-width, so mobile label abbreviations stay in sync.
function useIsSmall() {
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const onChange = () => setSmall(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return small;
}

interface Option<T extends string> {
  value: T;
  label: string;
  /** Shorter label used when the group label is hidden (narrow screens). */
  mobileLabel?: string;
  disabled?: boolean;
}

interface PillGroupProps<T extends string> {
  label: string;
  options: Option<T>[];
  selected: T;
  onSelect: (value: T) => void;
  isSmall: boolean;
}

function PillGroup<T extends string>({ label, options, selected, onSelect, isSmall }: PillGroupProps<T>) {
  return (
    <FilterGroup label={label}>
      {options.map((opt) => {
        const isSelected = selected === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => !opt.disabled && onSelect(opt.value)}
            disabled={opt.disabled}
            aria-pressed={!opt.disabled && isSelected}
            title={opt.disabled ? "Limited data: not enough leagues to show reliable results" : undefined}
            className={pillClass(isSelected, undefined, opt.disabled)}
            data-testid={`filter-${label.toLowerCase().replace(/\s/g, "-")}-${opt.value}`}
          >
            {isSmall && opt.mobileLabel ? opt.mobileLabel : opt.label}
          </button>
        );
      })}
    </FilterGroup>
  );
}

const SEASON_OPTIONS: { value: SeasonFilter; label: string }[] = [
  { value: "2021", label: "2021" },
  { value: "2022", label: "2022" },
  { value: "2023", label: "2023" },
  { value: "2024", label: "2024" },
  { value: "2025", label: "2025" },
  { value: "compare", label: "2021-2025" },
];

function SeasonSelect({
  selected,
  onSelect,
}: {
  selected: SeasonFilter;
  onSelect: (value: SeasonFilter) => void;
}) {
  return (
    <FilterGroup label="Season">
      <Select value={selected} onValueChange={(v) => onSelect(v as SeasonFilter)}>
        <SelectTrigger
          className={pillClass(
            true,
            "h-auto w-auto gap-1 shadow-none focus:outline-none focus:ring-0",
          )}
          data-testid="filter-season-trigger"
        >
          <SelectValue placeholder="Season" />
        </SelectTrigger>
        <SelectContent className="min-w-[7rem]">
          {SEASON_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs font-semibold">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterGroup>
  );
}

interface Props {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  /** Optional control pinned to the far right of the filter row (e.g. Strategy Glossary toggle). */
  trailing?: ReactNode;
}

export function FilterBar({ filters, onFiltersChange, trailing }: Props) {
  const isSmall = useIsSmall();
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  return (
    <div className="w-full border-b bg-muted/25">
      <div className="w-full py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <PillGroup
            label="Format"
            options={[
              { value: "superflex" as QbFilter, label: "Superflex", mobileLabel: "SF", disabled: wouldSelectUnsupportedFormat(filters, "qb", "superflex") },
              { value: "one_qb" as QbFilter, label: "1QB", disabled: wouldSelectUnsupportedFormat(filters, "qb", "one_qb") },
            ]}
            selected={filters.qb}
            onSelect={(v) => set("qb", v)}
            isSmall={isSmall}
          />
          <PillGroup
            label="Scoring"
            options={[
              { value: "ppr" as ScoringFilter, label: "PPR" },
              { value: "half_ppr" as ScoringFilter, label: "Half PPR", mobileLabel: "Half", disabled: wouldSelectUnsupportedFormat(filters, "scoring", "half_ppr") },
            ]}
            selected={filters.scoring}
            onSelect={(v) => set("scoring", v)}
            isSmall={isSmall}
          />
          <PillGroup
            label="TE Premium"
            options={[
              { value: "no_tep" as TepFilter, label: "No TEP" },
              { value: "tep" as TepFilter, label: "TEP", disabled: wouldSelectUnsupportedFormat(filters, "tep", "tep") },
            ]}
            selected={filters.tep}
            onSelect={(v) => set("tep", v)}
            isSmall={isSmall}
          />
          <PillGroup
            label="Team Size"
            options={[
              { value: "10" as SizeFilter, label: "10-Team", mobileLabel: "10T", disabled: wouldSelectUnsupportedFormat(filters, "size", "10") },
              { value: "12" as SizeFilter, label: "12-Team", mobileLabel: "12T" },
            ]}
            selected={filters.size}
            onSelect={(v) => set("size", v)}
            isSmall={isSmall}
          />
          <SeasonSelect
            selected={filters.season}
            onSelect={(v) => set("season", v)}
          />
          {trailing && <div className="ml-auto">{trailing}</div>}
        </div>
      </div>
    </div>
  );
}
