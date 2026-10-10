import { AlertTriangle, XCircle, TrendingDown } from "lucide-react";
import { TrustBadge } from "@/lib/trustScore";

interface NegativeEntry {
  strategy_name: string;
  format_context: string;
  sample_size: number;
  playoff_rate: number;
  playoff_rate_lift: number;
  championship_rate: number;
  top_3_pf_rate: number;
  average_points_for: number;
  confidence_level: string;
  severity: "negative" | "strong_negative";
  explanation: string;
}

interface NegativeData {
  overall: NegativeEntry[];
  by_league_size?: Record<string, NegativeEntry[]>;
  by_qb_format?: Record<string, NegativeEntry[]>;
  by_full_format?: Record<string, NegativeEntry[]>;
}

interface Props {
  negativeData?: NegativeData;
  isLoading?: boolean;
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "strong_negative") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
        <XCircle className="h-3 w-3" />
        Strong Negative
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
      <AlertTriangle className="h-3 w-3" />
      Negative
    </span>
  );
}

function pct(val: number) {
  return `${(val * 100).toFixed(1)}%`;
}

function NegativeStrategyCard({ entry }: { entry: NegativeEntry }) {
  return (
    <div
      className={`bg-card rounded-xl border p-4 shadow-sm hover:shadow transition-shadow ${
        entry.severity === "strong_negative"
          ? "border-red-200 bg-red-50/30"
          : "border-orange-200 bg-orange-50/20"
      }`}
      data-testid={`negative-card-${entry.strategy_name}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-bold text-foreground text-base">{entry.strategy_name}</h4>
          <SeverityBadge severity={entry.severity} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            n={entry.sample_size.toLocaleString()}
          </span>
          <TrustBadge sampleSize={entry.sample_size} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="text-center bg-background/80 rounded-lg py-2 px-3">
          <div className="text-lg font-bold text-red-600">{pct(entry.playoff_rate)}</div>
          <div className="text-xs text-muted-foreground">Playoff Rate</div>
        </div>
        <div className="text-center bg-background/80 rounded-lg py-2 px-3">
          <div className={`text-lg font-bold ${entry.playoff_rate_lift < 0 ? "text-red-600" : "text-green-600"}`}>
            {entry.playoff_rate_lift > 0 ? "+" : ""}
            {entry.playoff_rate_lift.toFixed(1)}pp
          </div>
          <div className="text-xs text-muted-foreground">vs Baseline</div>
        </div>
        <div className="text-center bg-background/80 rounded-lg py-2 px-3">
          <div className="text-lg font-bold text-foreground">{pct(entry.championship_rate)}</div>
          <div className="text-xs text-muted-foreground">Champ Rate</div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
        {entry.explanation}
      </p>
    </div>
  );
}

export function NegativeStrategies({ negativeData, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (!negativeData) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No data available. Run <code className="bg-muted px-1 rounded font-mono text-xs">pnpm run redraft:update</code> to generate analysis.
      </p>
    );
  }

  const overallEntries = negativeData?.overall ?? [];
  const hasSufficientData = overallEntries.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 leading-relaxed">
          <span className="font-semibold">Correlation, not causation.</span>{" "}
          These strategies consistently underperformed across the sample and should generally be avoided
          unless league-specific conditions justify them. A strategy that underperforms on average may
          still work in specific contexts.
        </p>
      </div>

      {!hasSufficientData ? (
        <div className="text-center py-8">
          <TrendingDown className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No strategies flagged as negative yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Need at least 50 teams per strategy with ≥8pp below-baseline playoff rate to flag.
            Add more leagues and re-run the analysis.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{overallEntries.length}</span> strategy
            {overallEntries.length !== 1 ? "ies" : "y"} with statistically meaningful negative outcomes
            (sample ≥50, playoff rate ≥8pp below baseline).
          </p>
          {overallEntries.slice(0, 5).map((entry, i) => (
            <NegativeStrategyCard key={i} entry={entry} />
          ))}
        </>
      )}
    </div>
  );
}
