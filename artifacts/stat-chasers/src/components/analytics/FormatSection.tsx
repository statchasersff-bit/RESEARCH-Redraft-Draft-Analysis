import { useState } from "react";
import { StrategyTable } from "./StrategyTable";

interface FormatGroup {
  format: string;
  sample_size: number;
  best_strategies?: unknown[];
  best_combos?: unknown[];
  biggest_differences_from_baseline?: Array<{
    strategy: string;
    metric: string;
    lift: number;
  }>;
}

interface FormatData {
  standard?: FormatGroup;
  half_ppr?: FormatGroup;
  ppr?: FormatGroup;
  other_ppr?: FormatGroup;
  one_qb?: FormatGroup;
  superflex?: FormatGroup;
}

interface Props {
  data?: FormatData;
}

const FORMAT_OPTIONS = [
  { key: "ppr", label: "PPR" },
  { key: "half_ppr", label: "Half PPR" },
  { key: "standard", label: "Standard" },
  { key: "superflex", label: "Superflex" },
  { key: "one_qb", label: "1QB" },
  { key: "other_ppr", label: "Other PPR" },
] as const;

export function FormatSection({ data }: Props) {
  const [selected, setSelected] = useState<string>("ppr");

  if (!data) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No format data available yet.</p>;
  }

  const group = data[selected as keyof FormatData];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {FORMAT_OPTIONS.map((opt) => {
          const fmtData = data[opt.key as keyof FormatData];
          const n = fmtData?.sample_size ?? 0;
          return (
            <button
              key={opt.key}
              onClick={() => setSelected(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                selected === opt.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
              data-testid={`format-btn-${opt.key}`}
            >
              {opt.label}
              {n > 0 && (
                <span className={`ml-1.5 text-xs ${selected === opt.key ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  ({n})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!group || group.sample_size === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No data for this format — run the pipeline with more leagues.
        </p>
      ) : (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Best Strategies — {group.format}
            </h4>
            <StrategyTable rows={(group.best_strategies ?? []) as any} highlightFirst />
          </div>

          {group.best_combos && (group.best_combos as any[]).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Best First Two Pick Combos
              </h4>
              <StrategyTable rows={(group.best_combos ?? []) as any} />
            </div>
          )}

          {group.biggest_differences_from_baseline && group.biggest_differences_from_baseline.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Biggest Differences from Overall Baseline
              </h4>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Strategy</th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Metric</th>
                      <th className="text-right px-4 py-3 font-semibold text-foreground">Lift vs Baseline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.biggest_differences_from_baseline.map((diff, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{diff.strategy}</td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">
                          {diff.metric.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${diff.lift >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {diff.lift >= 0 ? "+" : ""}
                            {diff.lift.toFixed(1)}pp
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
