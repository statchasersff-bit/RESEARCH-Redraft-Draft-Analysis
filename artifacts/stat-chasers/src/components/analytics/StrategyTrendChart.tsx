import { useState, useMemo } from "react";
import type { CompareStrategyRow } from "./CompareTable";

const NAVY = "#0B1F3A";

const CORE_ARCHETYPES = new Set(["Robust RB", "Hero RB", "Zero RB", "WR Heavy", "Balanced"]);

const ALL_YEARS = [2021, 2022, 2023, 2024, 2025] as const;

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

interface BaselineByYear {
  [year: number]: number | undefined;
}

interface Props {
  rows: CompareStrategyRow[];
  baselineByYear?: BaselineByYear;
  minSample?: number;
}

function getRateForYear(row: CompareStrategyRow, year: number): number | null {
  const rate = (row as any)[`playoff_rate_${year}`];
  const sample = (row as any)[`sample_${year}`] ?? 0;
  if (rate == null || sample < 10) return null;
  return rate as number;
}

function getSampleForYear(row: CompareStrategyRow, year: number): number {
  return (row as any)[`sample_${year}`] ?? 0;
}


function heatColor(rate: number, baseline: number): { bg: string; text: string } {
  const pp = (rate - baseline) * 100;
  if (pp >= 6)  return { bg: "#166534", text: "#f0fdf4" };
  if (pp >= 2)  return { bg: "#16a34a", text: "#f0fdf4" };
  if (pp > -2)  return { bg: "#e2e8f0", text: "#475569" };
  if (pp > -6)  return { bg: "#dc2626", text: "#fff1f2" };
  return              { bg: "#991b1b", text: "#fff1f2" };
}

function HeatmapTable({
  activeStrategies,
  visibleYears,
  baselineByYear,
}: {
  activeStrategies: CompareStrategyRow[];
  visibleYears: readonly number[];
  baselineByYear?: BaselineByYear;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 font-semibold text-muted-foreground whitespace-nowrap">
              Strategy
            </th>
            {visibleYears.map((year) => (
              <th key={year} className="text-center py-2 px-2 font-semibold text-muted-foreground min-w-[72px]">
                {year}
              </th>
            ))}
            <th className="text-center py-2 px-3 font-semibold text-muted-foreground whitespace-nowrap min-w-[96px]">
              Years Above Avg
            </th>
          </tr>
        </thead>
        <tbody>

          {activeStrategies.map((row) => {
            // Compute years-above-average for visible years that have data + a baseline
            let above = 0;
            let total = 0;
            for (const year of visibleYears) {
              const val = getRateForYear(row, year);
              const baseline = baselineByYear?.[year];
              if (val != null && baseline != null) {
                total++;
                if (val > baseline) above++;
              }
            }
            const ratio = total > 0 ? above / total : null;
            const pillBg =
              ratio == null ? "#e2e8f0"
              : ratio >= 0.8 ? "#166534"
              : ratio >= 0.6 ? "#16a34a"
              : ratio >= 0.4 ? "#e2e8f0"
              : ratio >= 0.2 ? "#dc2626"
              : "#991b1b";
            const pillText =
              ratio == null ? "#475569"
              : ratio >= 0.6 ? "#f0fdf4"
              : ratio >= 0.4 ? "#475569"
              : "#fff1f2";

            return (
              <tr key={row.strategy} className="border-t border-border hover:bg-muted/20 transition-colors">
                <td className="py-0.5 px-3 whitespace-nowrap">
                  <span className="font-semibold text-foreground">{row.strategy}</span>
                </td>
                {visibleYears.map((year) => {
                  const val = getRateForYear(row, year);
                  const baseline = baselineByYear?.[year];
                  if (val == null) {
                    return (
                      <td key={year} className="text-center py-0.5 px-2">
                        <span className="text-muted-foreground/40">—</span>
                      </td>
                    );
                  }
                  const { bg, text } = baseline != null
                    ? heatColor(val, baseline)
                    : { bg: "#f8fafc", text: "#374151" };
                  const diff = baseline != null ? (val - baseline) * 100 : null;
                  return (
                    <td key={year} className="text-center py-0.5 px-1.5">
                      <div
                        className="rounded-md px-1.5 py-0.5 inline-flex flex-col items-center leading-tight"
                        style={{ background: bg, minWidth: 58 }}
                        title={diff != null ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}pp vs league avg` : undefined}
                      >
                        <span className="font-bold tabular-nums" style={{ color: text, fontSize: 10 }}>
                          {pct(val)}
                        </span>
                        {diff != null && (
                          <span className="tabular-nums" style={{ color: text, fontSize: 8, opacity: 0.8 }}>
                            {diff > 0 ? "+" : ""}{diff.toFixed(1)}pp
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="text-center py-0.5 px-3">
                  {ratio != null ? (
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 font-bold tabular-nums"
                      style={{ background: pillBg, color: pillText, fontSize: 10 }}
                      title={`${above} of ${total} years above league average`}
                    >
                      {above}/{total}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function StrategyTrendChart({ rows, baselineByYear, minSample = 10 }: Props) {
  const strategies = useMemo(
    () => rows.filter((r) => r.sample_2024 >= minSample || r.sample_2025 >= minSample),
    [rows, minSample]
  );

  const allStrategyNames = useMemo(() => strategies.map((r) => r.strategy), [strategies]);

  const [active, setActive] = useState<Set<string>>(
    () => new Set(allStrategyNames.filter((n) => CORE_ARCHETYPES.has(n)))
  );

  function toggleStrategy(name: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        if (next.size > 1) next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  const activeStrategies = useMemo(
    () => strategies.filter((r) => active.has(r.strategy)),
    [strategies, active]
  );

  const visibleYears = useMemo(() => {
    return ALL_YEARS.filter((year) =>
      activeStrategies.some((r) => getRateForYear(r, year) != null)
    );
  }, [activeStrategies]);

  return (
    <>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Playoff % by Year
          </h3>
        </div>
      </div>

      {/* Toggle pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {strategies.map((row) => {
          const on = active.has(row.strategy);
          return (
            <button
              key={row.strategy}
              onClick={() => toggleStrategy(row.strategy)}
              className="flex items-center px-2 py-1 rounded-full text-[8.4px] font-semibold border transition-all"
              style={
                on
                  ? { background: NAVY, color: "#fff", borderColor: NAVY }
                  : { background: "transparent", color: "#6b7280", borderColor: "#e5e7eb" }
              }
            >
              {row.strategy}
            </button>
          );
        })}
      </div>

      {/* Heatmap view */}
      <HeatmapTable
        activeStrategies={activeStrategies}
        visibleYears={visibleYears}
        baselineByYear={baselineByYear}
      />
    </>
  );
}
