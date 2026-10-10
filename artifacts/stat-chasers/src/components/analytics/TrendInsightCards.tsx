import { type ElementType, type ReactNode } from "react";
import { Trophy, Dices, Scale } from "lucide-react";
import { kpiCardStyle, kpiIconStyle, type KpiAccent } from "@/lib/kpiCardStyle";

interface StrategyTrend {
  strategy: string;
  playoff_rate_2021?: number;
  playoff_rate_2022?: number;
  playoff_rate_2023?: number;
  playoff_rate_2024: number;
  playoff_rate_2025: number;
  trend_label: string;
  sample_2021?: number;
  sample_2022?: number;
  sample_2023?: number;
  sample_2024: number;
  sample_2025: number;
  comparison_quality: string;
}

interface Props {
  strategies: StrategyTrend[];
  baselineChangePp?: number;
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

interface VolatilityMetrics {
  volatilityScore: number;
  maxSwingPp: number;
  totalRangePp: number;
  yearToYearChanges: number[];
}

function computeVolatilityMetrics(
  rates: Array<number | undefined>
): VolatilityMetrics {
  const ratesPp: number[] = rates.filter((r): r is number => r != null).map((r) => r * 100);

  const changes: number[] = [];
  for (let i = 1; i < ratesPp.length; i++) {
    changes.push(ratesPp[i] - ratesPp[i - 1]);
  }

  if (changes.length === 0) {
    return { volatilityScore: 0, maxSwingPp: 0, totalRangePp: 0, yearToYearChanges: [] };
  }

  const maxSwingPp = Math.max(...changes.map(Math.abs));
  const totalRangePp = Math.max(...ratesPp) - Math.min(...ratesPp);
  const volatilityScore = maxSwingPp * 0.7 + totalRangePp * 0.3;

  return { volatilityScore, maxSwingPp, totalRangePp, yearToYearChanges: changes };
}

function volatilityLabel(score: number): string {
  if (score <= 2.0) return "Very Stable";
  if (score <= 4.0) return "Stable";
  if (score <= 7.0) return "Moderate Volatility";
  return "High Volatility";
}

function volatilityColor(score: number): string {
  if (score <= 2.0) return "text-emerald-600 dark:text-emerald-400";
  if (score <= 4.0) return "text-emerald-600 dark:text-emerald-300";
  if (score <= 7.0) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function computeAvg(s: StrategyTrend, has2021: boolean, has2022: boolean, has2023: boolean): number {
  const vals: number[] = [];
  if (has2021 && s.playoff_rate_2021 != null && (s.sample_2021 ?? 0) > 0) vals.push(s.playoff_rate_2021);
  if (has2022 && s.playoff_rate_2022 != null && (s.sample_2022 ?? 0) > 0) vals.push(s.playoff_rate_2022);
  if (has2023 && s.playoff_rate_2023 != null && (s.sample_2023 ?? 0) > 0) vals.push(s.playoff_rate_2023);
  vals.push(s.playoff_rate_2024, s.playoff_rate_2025);
  return vals.reduce((a, v) => a + v, 0) / vals.length;
}

function qualityLabel(q: string): string {
  if (q === "Strong") return "Strong Sample";
  if (q === "Reliable") return "Reliable Sample";
  return "Limited Sample";
}

function qualityClasses(q: string): string {
  if (q === "Strong") return "bg-emerald-500/10 text-emerald-700 border-emerald-600/30 dark:text-emerald-300 dark:border-emerald-500/25";
  if (q === "Reliable") return "bg-sky-500/10 text-sky-700 border-sky-600/30 dark:text-sky-300 dark:border-sky-500/25";
  return "bg-amber-500/10 text-amber-700 border-amber-600/30 dark:text-amber-300 dark:border-amber-500/25";
}

function SeasonChips({ yearRates }: { yearRates: Array<{ year: string; rate: number }> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {yearRates.map(({ year, rate }) => (
        <span key={year} className="inline-flex items-center gap-0.5 bg-slate-900/[0.05] dark:bg-white/5 rounded px-1.5 py-0.5 text-[10px]">
          <span className="text-slate-500 dark:text-slate-400 font-medium">{year}</span>
          <span className="text-slate-800 dark:text-slate-100 font-semibold">{pct(rate)}</span>
        </span>
      ))}
    </div>
  );
}

function ProgressionRow({ yearRates }: { yearRates: Array<{ year: string; rate: number }> }) {
  const parts = yearRates.map(({ year, rate }) => `${year}: ${pct(rate)}`);
  return (
    <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-snug">
      {parts.join(" \u2192 ")}
    </p>
  );
}

interface CardProps {
  accent: KpiAccent;
  icon: ElementType;
  label: string;
  qualityQ: string;
  sampleTotal: number;
  sampleTooltip: string;
  strategy: string;
  mainMetric: string;
  mainMetricCls: string;
  subLabel?: string;
  subLabelCls?: string;
  seasonChips: ReactNode;
  explanation: string;
  metricTooltip?: string;
}

function InsightCard({
  accent, icon: Icon, label, qualityQ, sampleTotal, sampleTooltip,
  strategy, mainMetric, mainMetricCls, subLabel, subLabelCls,
  seasonChips, explanation, metricTooltip,
}: CardProps) {
  return (
    <div
      className="rs-app-premium-kpi rounded-xl overflow-hidden flex flex-col h-full"
      style={kpiCardStyle(accent)}
    >
      <div className="relative p-2 flex flex-col gap-1 flex-1">

        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <div
              className="rs-app-premium-kpi-icon flex items-center justify-center flex-shrink-0 !w-7 !h-7 !rounded-lg"
              style={kpiIconStyle(accent)}
            >
              <Icon className="w-[13px] h-[13px]" />
            </div>
            <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide leading-tight">
              {label}
            </span>
          </div>
          <span
            className={`inline-flex items-center flex-shrink-0 px-1.5 py-0.5 rounded-full text-[8px] font-semibold border cursor-default ${qualityClasses(qualityQ)}`}
            title="Based on the smallest single-year sample. Hover the n= figure below for per-year breakdown."
          >
            {qualityLabel(qualityQ)}
          </span>
        </div>

        <div>
          <p className="font-bold text-slate-900 dark:text-white text-[13px] leading-snug mb-0.5">
            {strategy}
          </p>
          <p
            className={`text-[24px] font-black leading-none tracking-tight ${mainMetricCls}`}
            title={metricTooltip}
          >
            {mainMetric}
          </p>
          {subLabel && (
            <p className={`text-[10px] font-semibold mt-0.5 ${subLabelCls ?? "text-slate-500 dark:text-slate-400"}`}>
              {subLabel}
            </p>
          )}
        </div>

        <div className="mt-auto space-y-0.5 pt-0.5">
          {seasonChips}
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">{explanation}</p>
          <p
            className="text-[9px] text-slate-400 dark:text-slate-500 cursor-default"
            title={sampleTooltip}
          >
            n = {sampleTotal.toLocaleString()} teams min/yr
          </p>
        </div>

      </div>
    </div>
  );
}

export function TrendInsightCards({ strategies, baselineChangePp }: Props) {
  const has2021 = strategies.some((s) => s.playoff_rate_2021 != null && (s.sample_2021 ?? 0) >= 50);
  const has2022 = strategies.some((s) => s.playoff_rate_2022 != null && (s.sample_2022 ?? 0) >= 50);
  const has2023 = strategies.some((s) => s.playoff_rate_2023 != null && (s.sample_2023 ?? 0) >= 50);

  function getYearRates(s: StrategyTrend): Array<{ year: string; rate: number }> {
    const result: Array<{ year: string; rate: number }> = [];
    if (has2021 && s.playoff_rate_2021 != null) result.push({ year: "2021", rate: s.playoff_rate_2021 });
    if (has2022 && s.playoff_rate_2022 != null) result.push({ year: "2022", rate: s.playoff_rate_2022 });
    if (has2023 && s.playoff_rate_2023 != null) result.push({ year: "2023", rate: s.playoff_rate_2023 });
    result.push({ year: "2024", rate: s.playoff_rate_2024 });
    result.push({ year: "2025", rate: s.playoff_rate_2025 });
    return result;
  }

  function getOrderedRates(s: StrategyTrend): Array<number | undefined> {
    return [
      has2021 ? s.playoff_rate_2021 : undefined,
      has2022 ? s.playoff_rate_2022 : undefined,
      has2023 ? s.playoff_rate_2023 : undefined,
      s.playoff_rate_2024,
      s.playoff_rate_2025,
    ];
  }

  function isQualified(s: StrategyTrend, minN = 50): boolean {
    if (has2021 && (s.sample_2021 == null || s.sample_2021 < minN)) return false;
    if (has2022 && (s.sample_2022 == null || s.sample_2022 < minN)) return false;
    if (has2023 && (s.sample_2023 == null || s.sample_2023 < minN)) return false;
    if (s.sample_2024 < minN || s.sample_2025 < minN) return false;
    if (has2021 && s.playoff_rate_2021 == null) return false;
    if (has2022 && s.playoff_rate_2022 == null) return false;
    if (has2023 && s.playoff_rate_2023 == null) return false;
    return true;
  }

  function sampleTooltip(s: StrategyTrend): string {
    const parts: string[] = [];
    if (has2021 && s.sample_2021 != null) parts.push(`2021: ${s.sample_2021.toLocaleString()}`);
    if (has2022 && s.sample_2022 != null) parts.push(`2022: ${s.sample_2022.toLocaleString()}`);
    if (has2023 && s.sample_2023 != null) parts.push(`2023: ${s.sample_2023.toLocaleString()}`);
    parts.push(`2024: ${s.sample_2024.toLocaleString()}`);
    parts.push(`2025: ${s.sample_2025.toLocaleString()}`);
    return parts.join("\n");
  }

  function sampleMinPerYear(s: StrategyTrend): number {
    const years = [s.sample_2024, s.sample_2025];
    if (has2021 && s.sample_2021 != null) years.push(s.sample_2021);
    if (has2022 && s.sample_2022 != null) years.push(s.sample_2022);
    if (has2023 && s.sample_2023 != null) years.push(s.sample_2023);
    return Math.min(...years);
  }

  const qualified50 = strategies.filter((s) => isQualified(s, 50));
  const qualified250 = qualified50.filter((s) => isQualified(s, 250));

  const reliable = qualified50.filter(
    (s) => s.sample_2024 >= 250 && s.sample_2025 >= 250
  );

  if (reliable.length === 0 && qualified50.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Insufficient sample size for trend insights in this filter combination. Try wider format settings.
      </div>
    );
  }

  const highestAvgPool = reliable.length > 0 ? reliable : qualified50;
  const highestAvg = [...highestAvgPool].sort((a, b) => computeAvg(b, has2021, has2022, has2023) - computeAvg(a, has2021, has2022, has2023))[0];

  const withVolatility = qualified50.map((s) => ({
    ...s,
    vm: computeVolatilityMetrics(getOrderedRates(s)),
  }));

  const leastConsistentEntry = withVolatility.length > 0
    ? [...withVolatility].sort((a, b) => b.vm.volatilityScore - a.vm.volatilityScore)[0]
    : null;

  const mostStablePool = qualified250.length > 0 ? qualified250 : qualified50;
  const mostStableWithVol = mostStablePool.map((s) => ({
    ...s,
    vm: computeVolatilityMetrics(getOrderedRates(s)),
  }));
  const mostStableEntry = mostStableWithVol.length > 0
    ? [...mostStableWithVol].sort((a, b) => a.vm.volatilityScore - b.vm.volatilityScore)[0]
    : null;

  const cards: ReactNode[] = [];

  if (highestAvg) {
    cards.push(
      <InsightCard
        key="highestAvg"
        accent="emerald"
        icon={Trophy}
        label="Highest Avg Playoff Rate"
        qualityQ={highestAvg.comparison_quality}
        sampleTotal={sampleMinPerYear(highestAvg)}
        sampleTooltip={sampleTooltip(highestAvg)}
        strategy={highestAvg.strategy}
        mainMetric={pct(computeAvg(highestAvg, has2021, has2022, has2023))}
        mainMetricCls="text-emerald-600 dark:text-emerald-400"
        seasonChips={<SeasonChips yearRates={getYearRates(highestAvg)} />}
        explanation="Best average playoff rate across selected seasons."
      />
    );
  }

  if (leastConsistentEntry) {
    const vm = leastConsistentEntry.vm;
    const label = volatilityLabel(vm.volatilityScore);
    const color = volatilityColor(vm.volatilityScore);
    cards.push(
      <InsightCard
        key="leastConsistent"
        accent="rose"
        icon={Dices}
        label="Least Consistent"
        qualityQ={leastConsistentEntry.comparison_quality}
        sampleTotal={sampleMinPerYear(leastConsistentEntry)}
        sampleTooltip={sampleTooltip(leastConsistentEntry)}
        strategy={leastConsistentEntry.strategy}
        mainMetric={`${vm.volatilityScore.toFixed(1)}pp`}
        mainMetricCls={color}
        subLabel={label}
        subLabelCls={color}
        seasonChips={<ProgressionRow yearRates={getYearRates(leastConsistentEntry)} />}
        explanation={`Range: ${vm.totalRangePp.toFixed(1)}pp · Max Swing: ${vm.maxSwingPp.toFixed(1)}pp`}
        metricTooltip={`Volatility Score = (max year-to-year swing × 0.70) + (total range × 0.30)\nMax swing: ${vm.maxSwingPp.toFixed(1)}pp · Range: ${vm.totalRangePp.toFixed(1)}pp`}
      />
    );
  }

  if (mostStableEntry) {
    const vm = mostStableEntry.vm;
    const label = volatilityLabel(vm.volatilityScore);
    const color = volatilityColor(vm.volatilityScore);
    cards.push(
      <InsightCard
        key="stable"
        accent="sky"
        icon={Scale}
        label="Most Consistent"
        qualityQ={mostStableEntry.comparison_quality}
        sampleTotal={sampleMinPerYear(mostStableEntry)}
        sampleTooltip={sampleTooltip(mostStableEntry)}
        strategy={mostStableEntry.strategy}
        mainMetric={`${vm.volatilityScore.toFixed(1)}pp`}
        mainMetricCls={color}
        subLabel={label}
        subLabelCls={color}
        seasonChips={<ProgressionRow yearRates={getYearRates(mostStableEntry)} />}
        explanation={`Range: ${vm.totalRangePp.toFixed(1)}pp · Max Swing: ${vm.maxSwingPp.toFixed(1)}pp`}
        metricTooltip={`Volatility Score = (max year-to-year swing × 0.70) + (total range × 0.30)\nMax swing: ${vm.maxSwingPp.toFixed(1)}pp · Range: ${vm.totalRangePp.toFixed(1)}pp`}
      />
    );
  }

  if (cards.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
        {cards}
      </div>
    </div>
  );
}
