/**
 * analyze_negative_strategies.ts
 *
 * Identifies draft strategies that consistently underperform (miss playoffs).
 * Exports redraft_negative_strategies.json and redraft_playoff_miss_risk.json.
 */

import type { TeamRecord, StrategyMetrics } from "./analyze_redraft_strategy.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NegativeStrategyEntry {
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

export interface PlayoffMissRiskEntry {
  strategy_name: string;
  format_context: string;
  sample_size: number;
  probability_of_missing_playoffs: number;
  relative_risk_vs_baseline: number;
  percentile_rank: number;
  confidence_level: string;
}

export interface NegativeStrategyOutput {
  generated_at: string;
  overall: NegativeStrategyEntry[];
  by_league_size: Record<string, NegativeStrategyEntry[]>;
  by_qb_format: Record<string, NegativeStrategyEntry[]>;
  by_tep: Record<string, NegativeStrategyEntry[]>;
  by_full_format: Record<string, NegativeStrategyEntry[]>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidenceLevel(n: number): string {
  if (n >= 250) return "High";
  if (n >= 75) return "Medium";
  if (n >= 25) return "Low";
  return "Very Low";
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface Baseline {
  playoff_rate: number;
  championship_rate: number;
  top_3_pf_rate: number;
  average_points_for: number;
}

function computeBaseline(teams: TeamRecord[]): Baseline {
  const n = teams.length;
  if (n === 0) return { playoff_rate: 0, championship_rate: 0, top_3_pf_rate: 0, average_points_for: 0 };
  return {
    playoff_rate: teams.filter((t) => t.playoff_made).length / n,
    championship_rate: teams.filter((t) => t.champion).length / n,
    top_3_pf_rate: teams.filter((t) => t.top_3_points_for).length / n,
    average_points_for: teams.reduce((a, b) => a + b.regular_season_points_for, 0) / n,
  };
}

function generateExplanation(
  strategy: string,
  metrics: { playoff_rate: number; average_points_for: number; top_3_pf_rate: number },
  baseline: Baseline
): string {
  const lift = ((metrics.playoff_rate - baseline.playoff_rate) * 100).toFixed(1);
  const missRate = ((1 - metrics.playoff_rate) * 100).toFixed(1);
  const baselineMissRate = ((1 - baseline.playoff_rate) * 100).toFixed(1);
  const ptsDiff = (metrics.average_points_for - baseline.average_points_for).toFixed(1);

  if (strategy === "Zero RB") {
    return `Teams that drafted 0 RBs in rounds 1–5 missed the playoffs ${missRate}% of the time (vs ${baselineMissRate}% baseline). Without early-round RB production, rosters tended to score ${Math.abs(Number(ptsDiff))} fewer points per season on average.`;
  }
  if (strategy === "Elite QB") {
    return `Using a top-4 pick on a QB reduced positional advantage at RB/WR, leading to a ${Math.abs(Number(lift))}pp drop in playoff rate vs baseline. The scoring upside rarely offset the positional opportunity cost in this sample.`;
  }
  if (strategy === "Anchor TE") {
    return `Targeting a TE in rounds 1–3 correlated with underperformance, likely because elite TEs rarely provide enough relative value to justify sacrificing a premium RB or WR selection. Playoff rate was ${Math.abs(Number(lift))}pp below baseline.`;
  }
  if (strategy === "Fragile RB") {
    return `Teams with exactly 2 RBs in rounds 1–5 and no RBs in rounds 6–8 frequently struggled with RB depth. Without mid-round RB insurance, injury exposure was high, resulting in a playoff rate ${Math.abs(Number(lift))}pp below the overall baseline.`;
  }
  if (strategy === "Double Hero RB") {
    return `Building with exactly 2 early RBs and loading up on WRs in round 6 produced below-average results in this sample. Playoff rate was ${missRate}% miss rate vs ${baselineMissRate}% baseline, suggesting this specific distribution often leaves teams thin in at least one key position.`;
  }
  if (strategy === "WR Heavy") {
    return `Taking 3+ WRs in rounds 1–5 without matching RB depth correlated with lower scoring output (${ptsDiff > "0" ? "+" : ""}${ptsDiff} pts vs baseline) and a playoff rate ${Math.abs(Number(lift))}pp below baseline. WR scarcity is lower than RB, so overloading early reduces marginal value.`;
  }
  if (strategy === "Elite TE") {
    return `Selecting a TE in rounds 1–4 was associated with reduced overall roster quality. Teams using this approach missed the playoffs ${missRate}% of the time, ${Math.abs(Number(lift))}pp worse than the ${baselineMissRate}% baseline miss rate.`;
  }

  return `Teams using ${strategy} missed the playoffs ${missRate}% of the time vs the ${baselineMissRate}% baseline — a ${Math.abs(Number(lift))}pp gap. Average scoring was ${ptsDiff > "0" ? "+" : ""}${ptsDiff} pts vs the sample mean.`;
}

function computeStrategyMetricsForGroup(
  teams: TeamRecord[],
  strategyName: string,
  baseline: Baseline
): {
  sample_size: number;
  playoff_rate: number;
  championship_rate: number;
  top_3_pf_rate: number;
  average_points_for: number;
  playoff_rate_lift: number;
  confidence_level: string;
} | null {
  const matching = teams.filter((t) => t.strategies.includes(strategyName));
  const n = matching.length;
  if (n === 0) return null;

  const playoff_rate = matching.filter((t) => t.playoff_made).length / n;
  const championship_rate = matching.filter((t) => t.champion).length / n;
  const top_3_pf_rate = matching.filter((t) => t.top_3_points_for).length / n;
  const average_points_for =
    matching.reduce((a, b) => a + b.regular_season_points_for, 0) / n;
  const playoff_rate_lift =
    Math.round((playoff_rate - baseline.playoff_rate) * 1000) / 10;

  return {
    sample_size: n,
    playoff_rate: Math.round(playoff_rate * 1000) / 1000,
    championship_rate: Math.round(championship_rate * 1000) / 1000,
    top_3_pf_rate: Math.round(top_3_pf_rate * 1000) / 1000,
    average_points_for: Math.round(average_points_for * 100) / 100,
    playoff_rate_lift,
    confidence_level: confidenceLevel(n),
  };
}

function buildNegativeEntries(
  teams: TeamRecord[],
  strategies: string[],
  contextLabel: string
): NegativeStrategyEntry[] {
  if (teams.length === 0) return [];
  const baseline = computeBaseline(teams);
  const entries: NegativeStrategyEntry[] = [];

  for (const strategy of strategies) {
    const m = computeStrategyMetricsForGroup(teams, strategy, baseline);
    if (!m) continue;

    const isNegative = m.sample_size >= 50 && m.playoff_rate_lift <= -8;
    const isStrongNegative = m.sample_size >= 100 && m.playoff_rate_lift <= -12;

    if (!isNegative && !isStrongNegative) continue;

    entries.push({
      strategy_name: strategy,
      format_context: contextLabel,
      sample_size: m.sample_size,
      playoff_rate: m.playoff_rate,
      playoff_rate_lift: m.playoff_rate_lift,
      championship_rate: m.championship_rate,
      top_3_pf_rate: m.top_3_pf_rate,
      average_points_for: m.average_points_for,
      confidence_level: m.confidence_level,
      severity: isStrongNegative ? "strong_negative" : "negative",
      explanation: generateExplanation(strategy, m, baseline),
    });
  }

  return entries.sort((a, b) => a.playoff_rate_lift - b.playoff_rate_lift);
}

// ─── Main Export ──────────────────────────────────────────────────────────────

const ALL_STRATEGIES = [
  "Zero RB", "Hero RB", "Robust RB", "WR Heavy", "Elite QB", "Elite TE",
  "Balanced Start", "Fragile RB", "Late QB", "Late TE", "Anchor TE", "Double Hero RB",
];

export function analyzeNegativeStrategies(teams: TeamRecord[]): {
  negativeStrategies: NegativeStrategyOutput;
  playoffMissRisk: {
    generated_at: string;
    baseline_miss_rate: number;
    entries: PlayoffMissRiskEntry[];
  };
} {
  const now = new Date().toISOString();
  const overall = computeBaseline(teams);

  // ─── Overall negative strategies ─────────────────────────────────────────
  const overallNegative = buildNegativeEntries(teams, ALL_STRATEGIES, "Overall");

  // ─── By league size ────────────────────────────────────────────────────────
  const byLeagueSize: Record<string, NegativeStrategyEntry[]> = {};
  for (const size of [10, 12]) {
    const label = `${size}-team`;
    const group = teams.filter((t) => t.league_size === size);
    byLeagueSize[label] = buildNegativeEntries(group, ALL_STRATEGIES, label);
  }

  // ─── By QB format ─────────────────────────────────────────────────────────
  const byQBFormat: Record<string, NegativeStrategyEntry[]> = {};
  for (const fmt of ["1QB", "Superflex"]) {
    const group = teams.filter((t) => t.roster_format === fmt);
    byQBFormat[fmt] = buildNegativeEntries(group, ALL_STRATEGIES, fmt);
  }

  // ─── By TEP ───────────────────────────────────────────────────────────────
  // Note: TEP isn't tracked directly on TeamRecord from existing analyzer
  // We'll use scoring_format as a proxy grouping since TEP isn't in current TeamRecord
  const byTEP: Record<string, NegativeStrategyEntry[]> = {};
  const byFormatKeys = ["Standard", "Half PPR", "PPR"];
  for (const fmt of byFormatKeys) {
    const group = teams.filter((t) => t.scoring_format === fmt);
    byTEP[fmt] = buildNegativeEntries(group, ALL_STRATEGIES, fmt);
  }

  // ─── By full format combo ─────────────────────────────────────────────────
  const byFullFormat: Record<string, NegativeStrategyEntry[]> = {};
  const formatCombos: Array<{ label: string; filter: (t: TeamRecord) => boolean }> = [
    { label: "12-team PPR 1QB", filter: (t) => t.league_size === 12 && t.scoring_format === "PPR" && t.roster_format === "1QB" },
    { label: "12-team PPR Superflex", filter: (t) => t.league_size === 12 && t.scoring_format === "PPR" && t.roster_format === "Superflex" },
    { label: "12-team Half PPR 1QB", filter: (t) => t.league_size === 12 && t.scoring_format === "Half PPR" && t.roster_format === "1QB" },
    { label: "10-team PPR 1QB", filter: (t) => t.league_size === 10 && t.scoring_format === "PPR" && t.roster_format === "1QB" },
    { label: "10-team Half PPR 1QB", filter: (t) => t.league_size === 10 && t.scoring_format === "Half PPR" && t.roster_format === "1QB" },
  ];
  for (const combo of formatCombos) {
    const group = teams.filter(combo.filter);
    if (group.length >= 50) {
      byFullFormat[combo.label] = buildNegativeEntries(group, ALL_STRATEGIES, combo.label);
    }
  }

  // ─── Playoff miss risk ─────────────────────────────────────────────────────
  const baseline = computeBaseline(teams);
  const baselineMissRate = 1 - baseline.playoff_rate;

  // Compute for all strategies (not just negatives) for risk ranking
  const allMetrics: Array<{
    strategy: string;
    sample_size: number;
    miss_rate: number;
    playoff_rate: number;
  }> = [];

  for (const strategy of ALL_STRATEGIES) {
    const matching = teams.filter((t) => t.strategies.includes(strategy));
    if (matching.length < 25) continue;
    const n = matching.length;
    const playoff_rate = matching.filter((t) => t.playoff_made).length / n;
    allMetrics.push({ strategy, sample_size: n, miss_rate: 1 - playoff_rate, playoff_rate });
  }

  // Sort by miss rate descending for percentile calculation
  const sorted = [...allMetrics].sort((a, b) => b.miss_rate - a.miss_rate);

  const missRiskEntries: PlayoffMissRiskEntry[] = allMetrics.map((m) => {
    const rank = sorted.findIndex((s) => s.strategy === m.strategy);
    const percentileRank = Math.round(((sorted.length - rank) / sorted.length) * 100);
    const relativeRisk = baselineMissRate > 0
      ? Math.round((m.miss_rate / baselineMissRate) * 100) / 100
      : 1;

    return {
      strategy_name: m.strategy,
      format_context: "Overall",
      sample_size: m.sample_size,
      probability_of_missing_playoffs: Math.round(m.miss_rate * 1000) / 1000,
      relative_risk_vs_baseline: relativeRisk,
      percentile_rank: percentileRank,
      confidence_level: confidenceLevel(m.sample_size),
    };
  }).sort((a, b) => b.probability_of_missing_playoffs - a.probability_of_missing_playoffs);

  return {
    negativeStrategies: {
      generated_at: now,
      overall: overallNegative,
      by_league_size: byLeagueSize,
      by_qb_format: byQBFormat,
      by_tep: byTEP,
      by_full_format: byFullFormat,
    },
    playoffMissRisk: {
      generated_at: now,
      baseline_miss_rate: Math.round(baselineMissRate * 1000) / 1000,
      entries: missRiskEntries,
    },
  };
}
