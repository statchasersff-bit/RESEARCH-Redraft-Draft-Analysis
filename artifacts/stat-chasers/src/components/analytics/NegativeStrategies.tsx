import { useState } from "react";
import { AlertTriangle, XCircle, TrendingDown, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface MissRiskEntry {
  strategy_name: string;
  format_context: string;
  sample_size: number;
  probability_of_missing_playoffs: number;
  relative_risk_vs_baseline: number;
  percentile_rank: number;
  confidence_level: string;
}

interface NegativeData {
  overall: NegativeEntry[];
  by_league_size?: Record<string, NegativeEntry[]>;
  by_qb_format?: Record<string, NegativeEntry[]>;
  by_full_format?: Record<string, NegativeEntry[]>;
}

interface MissRiskData {
  baseline_miss_rate: number;
  entries: MissRiskEntry[];
}

interface Props {
  negativeData?: NegativeData;
  missRiskData?: MissRiskData;
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

function ConfidenceBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    High: "bg-green-100 text-green-800 border-green-200",
    Medium: "bg-blue-100 text-blue-800 border-blue-200",
    Low: "bg-yellow-100 text-yellow-800 border-yellow-200",
    "Very Low": "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${map[level] ?? map["Very Low"]}`}>
      {level}
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
          <ConfidenceBadge level={entry.confidence_level} />
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
        <div className="text-center bg-background/80 rounded-lg py-2 px-3">
          <div className="text-lg font-bold text-foreground">{entry.average_points_for.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">Avg Pts</div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
        {entry.explanation}
      </p>
    </div>
  );
}

const GROUP_TABS = [
  { id: "overall", label: "Overall" },
  { id: "miss_risk", label: "Miss Risk Table" },
  { id: "by_size", label: "By League Size" },
  { id: "by_qb", label: "By QB Format" },
] as const;

export function NegativeStrategies({ negativeData, missRiskData, isLoading }: Props) {
  const [activeTab, setActiveTab] = useState<string>("overall");

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (!negativeData && !missRiskData) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No data available — run <code className="bg-muted px-1 rounded font-mono text-xs">pnpm run redraft:update</code> to generate analysis.
      </p>
    );
  }

  const overallEntries = negativeData?.overall ?? [];
  const hasSufficientData = overallEntries.length > 0;

  return (
    <div className="space-y-5">
      {/* Warning banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 leading-relaxed">
          <span className="font-semibold">Correlation, not causation.</span>{" "}
          These strategies consistently underperformed across the sample and should generally be avoided
          unless league-specific conditions justify them. A strategy that underperforms on average may
          still work in specific contexts.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-0">
        {GROUP_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-red-500 text-red-700 bg-card"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            data-testid={`neg-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overall tab */}
      {activeTab === "overall" && (
        <div className="space-y-4" data-testid="neg-tab-content-overall">
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
      )}

      {/* Miss risk table */}
      {activeTab === "miss_risk" && (
        <div data-testid="neg-tab-content-miss-risk">
          {!missRiskData?.entries?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No miss risk data available yet.</p>
          ) : (
            <div className="space-y-3">
              {missRiskData.baseline_miss_rate != null && (
                <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-2.5">
                  <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Baseline miss rate:</span>{" "}
                    {pct(missRiskData.baseline_miss_rate)} — probability of missing playoffs across all teams.
                    Strategies above this are riskier; below it are safer.
                  </p>
                </div>
              )}
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="font-semibold">Strategy</TableHead>
                      <TableHead className="font-semibold text-right">Miss Rate</TableHead>
                      <TableHead className="font-semibold text-right">vs Baseline</TableHead>
                      <TableHead className="font-semibold text-right">Risk Multiple</TableHead>
                      <TableHead className="font-semibold text-right">Percentile</TableHead>
                      <TableHead className="font-semibold text-right">Sample</TableHead>
                      <TableHead className="font-semibold">Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missRiskData.entries.map((entry, i) => {
                      const liftVsBaseline = entry.probability_of_missing_playoffs - (missRiskData.baseline_miss_rate ?? 0);
                      const isRisky = liftVsBaseline > 0.05;
                      return (
                        <TableRow
                          key={i}
                          className={`hover:bg-muted/30 transition-colors ${isRisky ? "bg-red-50/20" : ""}`}
                          data-testid={`miss-risk-row-${i}`}
                        >
                          <TableCell className="font-medium text-foreground">{entry.strategy_name}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-semibold ${isRisky ? "text-red-600" : "text-foreground"}`}>
                              {pct(entry.probability_of_missing_playoffs)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`text-sm font-medium ${liftVsBaseline > 0 ? "text-red-500" : "text-green-600"}`}>
                              {liftVsBaseline > 0 ? "+" : ""}
                              {(liftVsBaseline * 100).toFixed(1)}pp
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {entry.relative_risk_vs_baseline.toFixed(2)}×
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {entry.percentile_rank}th
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm">
                            {entry.sample_size.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <ConfidenceBadge level={entry.confidence_level} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* By league size */}
      {activeTab === "by_size" && (
        <div className="space-y-6" data-testid="neg-tab-content-by-size">
          {["12-team", "10-team"].map((size) => {
            const entries = negativeData?.by_league_size?.[size] ?? [];
            return (
              <div key={size}>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {size} Leagues
                </h4>
                {entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No strategies flagged for {size} — insufficient sample or no significant underperformers.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {entries.slice(0, 3).map((entry, i) => (
                      <NegativeStrategyCard key={i} entry={entry} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* By QB format */}
      {activeTab === "by_qb" && (
        <div className="space-y-6" data-testid="neg-tab-content-by-qb">
          {["1QB", "Superflex"].map((fmt) => {
            const entries = negativeData?.by_qb_format?.[fmt] ?? [];
            return (
              <div key={fmt}>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {fmt}
                </h4>
                {entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No strategies flagged for {fmt} — insufficient sample or no significant underperformers.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {entries.slice(0, 3).map((entry, i) => (
                      <NegativeStrategyCard key={i} entry={entry} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
