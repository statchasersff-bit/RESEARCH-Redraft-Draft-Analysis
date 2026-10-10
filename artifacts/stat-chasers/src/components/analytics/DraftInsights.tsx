import { useState } from "react";
import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ─── Neutral roster-construction descriptions (used in expanded detail) ───────

const BUILD_DESC: Record<string, string> = {
  "Zero RB":   "skips RBs entirely in rounds 1–5",
  "Elite TE":  "spends a top-2 pick on a TE",
  "Hero RB":   "drafts just one RB in the first 5 rounds",
  "WR Heavy":  "loads 3+ WRs at the expense of RBs in rounds 1–5",
  "Elite QB":  "spends an early pick (rounds 1–4) on a QB",
  "Robust RB": "stacks 3+ RBs in the first 5 rounds",
  "Late TE":   "waits until round 8 or later for a TE",
  "Late QB":   "delays the QB until round 8 or later",
  "Balanced":  "spreads picks without a clear positional concentration in rounds 1–5",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface StrategyRow {
  strategy?: string;
  strategy_name?: string;
  sample_size: number;
  playoff_rate: number;
  championship_rate: number;
  top_3_pf_rate: number;
  average_points_for: number;
  playoff_rate_lift?: number;
  confidence_level?: string;
}

interface PipelineRec {
  headline: string;
  body?: string;
  sample_size?: number;
  confidence: string;
  metrics?: Record<string, number>;
}

interface PipelineGroup {
  headline: string;
  recommendations: PipelineRec[];
}

interface Props {
  bestStrategies?: StrategyRow[];
  worstStrategies?: StrategyRow[];
  bestFirstRoundPositions?: StrategyRow[];
  recommendations?: PipelineGroup;
  baseline?: { playoff_rate?: number };
  sampleSize?: number;
  isLoading?: boolean;
}

// A normalized, display-ready row for either column.
interface InsightRow {
  name: string;
  playoffRate: number; // 0–1
  lift: number; // percentage points
  top3: number; // 0–1
  champ: number; // 0–1
  sample: number;
  confidence: string;
  explanation: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowName(row: StrategyRow): string {
  return row.strategy ?? row.strategy_name ?? "";
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function signed(v: number) {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}

function buildExplanation(
  name: string,
  variant: "good" | "bad",
  row: StrategyRow,
  baselinePct: string,
  recs?: PipelineGroup,
): string {
  // Prefer a human-written pipeline recommendation body when one matches.
  if (recs) {
    const match = recs.recommendations.find(
      (r) =>
        r.body &&
        (r.headline?.toLowerCase().includes(name.toLowerCase()) ||
          r.body.toLowerCase().includes(name.toLowerCase())),
    );
    if (match?.body) return match.body;
  }

  const desc = BUILD_DESC[name];
  const lead = desc ? `This build ${desc}. ` : "";
  const liftAbs = Math.abs(row.playoff_rate_lift ?? 0).toFixed(1);

  if (variant === "good") {
    return `${lead}In this sample it beat the ${baselinePct}% playoff baseline by ${liftAbs} points, finishing top-3 in scoring ${pct(row.top_3_pf_rate)} of the time.`;
  }
  return `${lead}In this sample it trailed the ${baselinePct}% playoff baseline by ${liftAbs} points.`;
}

function toInsightRow(
  row: StrategyRow,
  variant: "good" | "bad",
  baselinePct: string,
  recs?: PipelineGroup,
): InsightRow {
  const name = rowName(row);
  return {
    name,
    playoffRate: row.playoff_rate,
    lift: row.playoff_rate_lift ?? 0,
    top3: row.top_3_pf_rate,
    champ: row.championship_rate,
    sample: row.sample_size,
    confidence: row.confidence_level ?? "—",
    explanation: buildExplanation(name, variant, row, baselinePct, recs),
  };
}

// ─── One expandable ranked row ────────────────────────────────────────────────

function InsightRowItem({
  rank,
  row,
  variant,
}: {
  rank: number;
  row: InsightRow;
  variant: "good" | "bad";
}) {
  const [open, setOpen] = useState(false);
  const good = variant === "good";
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold tabular-nums text-primary">
          {rank}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {row.name}
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {pct(row.playoffRate)}
        </span>
        <span
          className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
            good
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
              : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
          }`}
        >
          {signed(row.lift)}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 pl-12 pt-0.5">
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              Top 3 PF{" "}
              <span className="font-semibold text-foreground">{pct(row.top3)}</span>
            </span>
            <span>
              Champ <span className="font-semibold text-foreground">{pct(row.champ)}</span>
            </span>
            <span>
              Sample{" "}
              <span className="font-semibold text-foreground">
                {row.sample.toLocaleString()}
              </span>
            </span>
            <span>
              Confidence{" "}
              <span className="font-semibold text-foreground">{row.confidence}</span>
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{row.explanation}</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── A ranked column (What Worked / What Didn't Work) ─────────────────────────

function RankedColumn({
  variant,
  title,
  subtitle,
  rows,
  empty,
}: {
  variant: "good" | "bad";
  title: string;
  subtitle: string;
  rows: InsightRow[];
  empty: string;
}) {
  const good = variant === "good";
  const Icon = good ? TrendingUp : TrendingDown;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon
          className={`h-5 w-5 shrink-0 ${
            good
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-500 dark:text-rose-400"
          }`}
        />
        <div>
          <h4 className="text-sm font-bold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border px-3 py-4 text-xs text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {rows.map((row, i) => (
            <InsightRowItem key={row.name + i} rank={i + 1} row={row} variant={variant} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DraftInsights({
  bestStrategies = [],
  worstStrategies = [],
  recommendations,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 rounded-xl bg-muted" />
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="h-40 rounded-xl bg-muted" />
          <div className="h-40 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!bestStrategies.length && !worstStrategies.length && !recommendations) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No data available yet. Run{" "}
        <code className="rounded bg-muted px-1 font-mono text-xs">pnpm run redraft:update</code>{" "}
        to generate analysis.
      </p>
    );
  }

  // Winners: positive lift, ranked by playoff rate (best first).
  const winnerRows = bestStrategies
    .filter((r) => (r.playoff_rate_lift ?? 0) > 0 && r.confidence_level !== "Very Low")
    .sort((a, b) => b.playoff_rate - a.playoff_rate)
    .slice(0, 4);

  // Losers: negative lift, ranked by playoff rate (worst first).
  const loserRows = worstStrategies
    .filter((r) => (r.playoff_rate_lift ?? 0) < 0 && r.confidence_level !== "Very Low")
    .sort((a, b) => a.playoff_rate - b.playoff_rate)
    .slice(0, 4);

  // Derive the baseline playoff rate from any row: rate − lift (lift is in points).
  const anchor = winnerRows[0] ?? loserRows[0];
  const baselinePct = anchor
    ? (anchor.playoff_rate * 100 - (anchor.playoff_rate_lift ?? 0)).toFixed(1)
    : "50.0";

  const winners = winnerRows.map((r) => toInsightRow(r, "good", baselinePct, recommendations));
  const losers = loserRows.map((r) => toInsightRow(r, "bad", baselinePct));

  return (
    <div className="space-y-5">
      <div className="grid gap-6 sm:grid-cols-2">
        <RankedColumn
          variant="good"
          title="What Worked"
          subtitle="Outperformed the baseline"
          rows={winners}
          empty="No standout winning builds in this sample yet."
        />
        <RankedColumn
          variant="bad"
          title="What Didn't Work"
          subtitle="Underperformed the baseline"
          rows={losers}
          empty="No clear underperformers in this sample yet."
        />
      </div>
    </div>
  );
}
