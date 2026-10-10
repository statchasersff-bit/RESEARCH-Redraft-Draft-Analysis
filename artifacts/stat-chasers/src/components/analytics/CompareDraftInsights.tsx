import { CheckCircle2, XCircle, ArrowRightLeft } from "lucide-react";

// ─── Shared advice copy (mirrors DraftInsights) ───────────────────────────────

const DO_ADVICE: Record<string, string> = {
  "Robust RB": "target 3+ RBs in your first 5 rounds",
  "Late TE":   "wait until round 8 or later for your TE",
  "Late QB":   "wait until round 8 or later for your QB",
  "WR Heavy":  "load up on 3+ WRs in your first 5 rounds",
  "Balanced":  "build an even mix of RBs and WRs across your first 5 rounds",
  "Hero RB":   "anchor with 1 elite RB and surround it with WR depth in rounds 2–5",
  "Elite QB":  "lock in a QB in rounds 1–4",
  "Elite TE":  "invest in an elite TE in rounds 1–2",
  "Zero RB":   "skip RBs entirely in the first 5 rounds",
};

const AVOID_ADVICE: Record<string, string> = {
  "Zero RB":   "skipping RBs entirely in rounds 1–5",
  "Elite TE":  "spending a top-2 pick on a TE",
  "Hero RB":   "drafting only 1 RB in your first 5 rounds",
  "WR Heavy":  "loading 3+ WRs at the expense of RBs in rounds 1–5",
  "Elite QB":  "spending an early pick (rounds 1–4) on a QB",
  "Robust RB": "stacking 3+ RBs in your first 5 rounds",
  "Late TE":   "waiting until round 8+ for a TE",
  "Late QB":   "delaying your QB until round 8 or later",
  "Balanced":  "spreading picks without a clear positional concentration in rounds 1–5",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface StrategyTrend {
  strategy: string;
  sample_2021?: number;
  sample_2022?: number;
  sample_2023?: number;
  sample_2024: number;
  sample_2025: number;
  playoff_rate_2021?: number;
  playoff_rate_2022?: number;
  playoff_rate_2023?: number;
  playoff_rate_2024: number;
  playoff_rate_2025: number;
  playoff_rate_change_pp: number;
  comparison_quality: string;
  trend_label: string;
}

interface TrendsSlice {
  baseline_playoff_rate_2021?: number;
  baseline_playoff_rate_2022?: number;
  baseline_playoff_rate_2023?: number;
  baseline_playoff_rate_2024: number;
  baseline_playoff_rate_2025: number;
  sample_2021?: number;
  sample_2022?: number;
  sample_2023?: number;
  sample_2024: number;
  sample_2025: number;
  overall_strategies: StrategyTrend[];
}

interface Props {
  trendsSlice: TrendsSlice | null;
  isLoading?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function pp(v: number) {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}pp`;
}

function joinPhrases(phrases: string[]): string {
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(", ")}, and ${phrases[phrases.length - 1]}`;
}

// ─── Row components ───────────────────────────────────────────────────────────

interface YearLift {
  year: string;
  rate: number;
  lift: number;
}

function ConsistentRow({
  strat,
  yearLifts,
  variant,
}: {
  strat: StrategyTrend;
  yearLifts: YearLift[];
  variant: "good" | "bad";
}) {
  const isGood = variant === "good";
  const minSample = Math.min(strat.sample_2024, strat.sample_2025);
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm ${
        isGood ? "bg-green-50/40 border-green-200" : "bg-red-50/30 border-red-200"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-semibold text-foreground truncate">{strat.strategy}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground min-w-0 sm:justify-end">
        {yearLifts.map(({ year, rate, lift }, i) => (
          <span key={year} className="inline-flex items-center whitespace-nowrap">
            {year}:{" "}
            <span className="font-medium text-foreground ml-1">{pct(rate)}</span>
            <span className={`ml-1 font-semibold ${isGood ? "text-green-700" : "text-red-600"}`}>
              ({pp(lift)})
            </span>
            {i < yearLifts.length - 1 && (
              <span className="text-muted-foreground/40 ml-3">·</span>
            )}
          </span>
        ))}
        <span className="text-muted-foreground/40">·</span>
        <span className="whitespace-nowrap">n={minSample.toLocaleString()}+</span>
      </div>
    </div>
  );
}

function MixedRow({
  strat,
  yearLifts,
}: {
  strat: StrategyTrend;
  yearLifts: YearLift[];
}) {
  const minSample = Math.min(strat.sample_2024, strat.sample_2025);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/30 px-4 py-3 text-sm">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-semibold text-foreground truncate">{strat.strategy}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground min-w-0 sm:justify-end">
        {yearLifts.map(({ year, rate, lift }, i) => (
          <span key={year} className="inline-flex items-center whitespace-nowrap">
            {year}:{" "}
            <span className="font-medium text-foreground ml-1">{pct(rate)}</span>
            <span className={`ml-1 font-semibold ${lift >= 0 ? "text-green-700" : "text-red-600"}`}>
              ({pp(lift)})
            </span>
            {i < yearLifts.length - 1 && (
              <span className="text-muted-foreground/40 ml-3">·</span>
            )}
          </span>
        ))}
        <span className="text-muted-foreground/40">·</span>
        <span className="whitespace-nowrap">n={minSample.toLocaleString()}+</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CompareDraftInsights({ trendsSlice, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-40 bg-muted rounded-xl" />
        <div className="h-40 bg-muted rounded-xl" />
      </div>
    );
  }

  if (!trendsSlice) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Year-over-year comparison data not yet generated. Run{" "}
        <code className="bg-muted px-1 rounded font-mono text-xs">pnpm run redraft:analyze</code>{" "}
        to produce the trends file.
      </p>
    );
  }

  const {
    baseline_playoff_rate_2021: b21raw,
    baseline_playoff_rate_2022: b22raw,
    baseline_playoff_rate_2023: b23raw,
    baseline_playoff_rate_2024: b24,
    baseline_playoff_rate_2025: b25,
    sample_2021,
    sample_2022,
    sample_2023,
    overall_strategies: all,
  } = trendsSlice;

  const has2021 = b21raw != null && (sample_2021 ?? 0) > 0;
  const has2022 = b22raw != null && (sample_2022 ?? 0) > 0;
  const has2023 = b23raw != null && (sample_2023 ?? 0) > 0;
  const b21: number | null = has2021 ? (b21raw as number) : null;
  const b22: number | null = has2022 ? (b22raw as number) : null;
  const b23: number | null = has2023 ? (b23raw as number) : null;

  // Count available years for label generation
  const availableYears: string[] = [];
  if (has2021) availableYears.push("2021");
  if (has2022) availableYears.push("2022");
  if (has2023) availableYears.push("2023");
  availableYears.push("2024", "2025");

  const totalYears = availableYears.length;

  // Build per-strategy year lifts
  function buildYearLifts(s: StrategyTrend): YearLift[] {
    const lifts: YearLift[] = [];
    if (has2021 && b21 != null && s.playoff_rate_2021 != null)
      lifts.push({ year: "2021", rate: s.playoff_rate_2021, lift: (s.playoff_rate_2021 - b21) * 100 });
    if (has2022 && b22 != null && s.playoff_rate_2022 != null)
      lifts.push({ year: "2022", rate: s.playoff_rate_2022, lift: (s.playoff_rate_2022 - b22) * 100 });
    if (has2023 && b23 != null && s.playoff_rate_2023 != null)
      lifts.push({ year: "2023", rate: s.playoff_rate_2023, lift: (s.playoff_rate_2023 - b23) * 100 });
    lifts.push({ year: "2024", rate: s.playoff_rate_2024, lift: (s.playoff_rate_2024 - b24) * 100 });
    lifts.push({ year: "2025", rate: s.playoff_rate_2025, lift: (s.playoff_rate_2025 - b25) * 100 });
    return lifts;
  }

  // Qualify strategies that have sufficient data in all available years
  const qualifying = all.filter((s) => {
    const base = s.sample_2024 >= 10 && s.sample_2025 >= 10;
    if (!base) return false;
    if (has2021 && (s.sample_2021 ?? 0) < 10) return false;
    if (has2022 && (s.sample_2022 ?? 0) < 10) return false;
    if (has2023 && (s.sample_2023 ?? 0) < 10) return false;
    return true;
  });

  // Per-year above-baseline helpers
  function aboveBaseline(s: StrategyTrend, year: string): boolean | null {
    switch (year) {
      case "2021": return has2021 && b21 != null && s.playoff_rate_2021 != null ? s.playoff_rate_2021 >= b21 : null;
      case "2022": return has2022 && b22 != null && s.playoff_rate_2022 != null ? s.playoff_rate_2022 >= b22 : null;
      case "2023": return has2023 && b23 != null && s.playoff_rate_2023 != null ? s.playoff_rate_2023 >= b23 : null;
      case "2024": return s.playoff_rate_2024 >= b24;
      case "2025": return s.playoff_rate_2025 >= b25;
      default: return null;
    }
  }

  // Average lift across all available years (for sort order)
  function avgLift(s: StrategyTrend): number {
    const lifts = buildYearLifts(s).map((yl) => yl.lift / 100);
    return lifts.reduce((a, v) => a + v, 0) / lifts.length;
  }

  const consistentlyGood = qualifying
    .filter((s) => availableYears.every((yr) => {
      const above = aboveBaseline(s, yr);
      return above === null || above === true;
    }))
    .sort((a, b) => avgLift(b) - avgLift(a));

  const consistentlyBad = qualifying
    .filter((s) => availableYears.every((yr) => {
      const above = aboveBaseline(s, yr);
      return above === null || above === false;
    }))
    .sort((a, b) => avgLift(a) - avgLift(b));

  const MIN_LIFT_PP = 2;
  const mixed = qualifying
    .filter((s) => {
      if (consistentlyGood.includes(s) || consistentlyBad.includes(s)) return false;
      const vals = buildYearLifts(s);
      for (let i = 0; i < vals.length - 1; i++) {
        const flipA = vals[i].lift >= 0;
        const flipB = vals[i + 1].lift >= 0;
        if (flipA !== flipB && Math.abs(vals[i].lift) >= MIN_LIFT_PP && Math.abs(vals[i + 1].lift) >= MIN_LIFT_PP) return true;
      }
      return false;
    })
    .sort((a, b) => Math.abs(b.playoff_rate_change_pp) - Math.abs(a.playoff_rate_change_pp));

  // Narrative copy
  const yearsLabel = totalYears === 2 ? "both seasons" : `all ${totalYears} seasons`;
  const yearsHeadingGood = totalYears === 2 ? "Consistently Worked: Both Years" : `Consistently Worked: All ${totalYears} Years`;
  const yearsHeadingBad = totalYears === 2 ? "Consistently Failed: Both Years" : `Consistently Failed: All ${totalYears} Years`;

  const doAdvicePhrases = consistentlyGood.slice(0, 3).map((s) => DO_ADVICE[s.strategy]).filter(Boolean);
  const avoidPhrases = consistentlyBad.slice(0, 3).map((s) => AVOID_ADVICE[s.strategy]).filter(Boolean);

  const doNarrative =
    doAdvicePhrases.length > 0
      ? `${totalYears === 2 ? "Both seasons" : `All ${totalYears} seasons`} agree: the winning approach is to ${joinPhrases(doAdvicePhrases)}.`
      : `No strategies cleared the baseline in ${yearsLabel} for this filter combination. Try widening your format settings.`;

  const avoidNarrative =
    avoidPhrases.length > 0
      ? `${totalYears === 2 ? "Both seasons" : `All ${totalYears} seasons`} consistently penalize ${joinPhrases(avoidPhrases)}.`
      : "No strategies landed below the baseline across all seasons. The field was competitive across approaches.";

  return (
    <div className="space-y-5">

      {/* Consistent Winners */}
      <div className="rounded-xl border border-green-200 bg-green-50/20 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <h3 className="font-bold text-foreground text-base">{yearsHeadingGood}</h3>
        </div>
        <p className="text-sm text-foreground leading-relaxed">
          {doNarrative}
        </p>
        {consistentlyGood.length > 0 ? (
          <div className="space-y-2 pt-1">
            {consistentlyGood.slice(0, 4).map((s) => (
              <ConsistentRow
                key={s.strategy}
                strat={s}
                yearLifts={buildYearLifts(s)}
                variant="good"
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No strategies exceeded the baseline in {yearsLabel} for this filter. Broaden the Team Size or Scoring filters.
          </p>
        )}
      </div>

      {/* Consistent Underperformers */}
      <div className="rounded-xl border border-red-200 bg-red-50/20 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <h3 className="font-bold text-foreground text-base">{yearsHeadingBad}</h3>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{avoidNarrative}</p>
        {consistentlyBad.length > 0 ? (
          <div className="space-y-2 pt-1">
            {consistentlyBad.slice(0, 4).map((s) => (
              <ConsistentRow
                key={s.strategy}
                strat={s}
                yearLifts={buildYearLifts(s)}
                variant="bad"
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No strategies fell below the baseline in {yearsLabel}. Results were split across seasons.
          </p>
        )}
      </div>

      {/* Mixed Signals */}
      {mixed.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <h3 className="font-bold text-foreground text-base">Mixed Signals: Results Flipped Year-over-Year</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            These strategies outperformed the baseline in some seasons but underperformed in others. The signal is inconsistent and may be as a result of injuries and/or players who had outlier performances.
          </p>
          <div className="space-y-2 pt-1">
            {mixed.slice(0, 4).map((s) => (
              <MixedRow key={s.strategy} strat={s} yearLifts={buildYearLifts(s)} />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground italic">
        {`"${totalYears === 2 ? "Both Years" : `All ${totalYears} Years`}" means the strategy exceeded (or fell below) the baseline playoff rate in ${yearsLabel} for this filter combination.`}{" "}
        Lift shown as percentage-point deviation from each year's baseline. Correlation, not causation.
      </p>
    </div>
  );
}
