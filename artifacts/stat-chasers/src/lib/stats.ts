// Statistical helpers for comparing observed strategy outcomes.
//
// Every rate on this dashboard (playoff rate, top-three points rate,
// championship rate) is a proportion estimated from a finite sample of
// fantasy teams. These helpers attach the uncertainty around those point
// estimates so strategies are never compared as if the numbers were exact.
//
// IMPORTANT CAVEAT — league independence:
// Teams drafted in the same league are not independent observations. Exactly
// a fixed number of teams make the playoffs in each league, so one team's
// success is another team's failure within that league. The intervals below
// treat teams as independent and therefore understate the true uncertainty
// somewhat. Proper league-level (clustered) intervals require per-strategy
// league identifiers, which are not present in the aggregated dataset the
// dashboard reads. Where that data becomes available the design effect should
// be applied here.

const Z_95 = 1.96;

export interface Interval {
  low: number; // lower bound of the 95% interval, as a proportion (0–1)
  high: number; // upper bound, as a proportion (0–1)
  halfWidth: number; // (high - low) / 2, convenient for "±X pp" display
}

/**
 * Wilson score 95% confidence interval for a single proportion.
 * More reliable than the normal approximation for small samples and for
 * rates near 0 or 1. Returns bounds as proportions in [0, 1].
 */
export function wilson95(p: number, n: number): Interval | null {
  if (!Number.isFinite(p) || !Number.isFinite(n) || n <= 0) return null;
  const clamped = Math.min(1, Math.max(0, p));
  const z2 = Z_95 * Z_95;
  const denom = 1 + z2 / n;
  const center = (clamped + z2 / (2 * n)) / denom;
  const margin =
    (Z_95 / denom) *
    Math.sqrt((clamped * (1 - clamped)) / n + z2 / (4 * n * n));
  const low = Math.max(0, center - margin);
  const high = Math.min(1, center + margin);
  return { low, high, halfWidth: (high - low) / 2 };
}

export type SeasonPoint = {
  rate: number | undefined | null;
  n: number | undefined | null;
};

export interface AggregateResult {
  rate: number; // point estimate (proportion 0–1)
  n: number; // total teams contributing
  seasons: number; // number of seasons contributing
  ci: Interval | null; // 95% confidence interval
}

/**
 * Pooled estimate: every team carries equal weight. Successes and sample
 * sizes are summed across seasons, so seasons with more teams dominate.
 * The interval is a Wilson interval on the pooled counts.
 */
export function pooled(points: SeasonPoint[]): AggregateResult {
  let totalSucc = 0;
  let totalN = 0;
  let seasons = 0;
  for (const { rate, n } of points) {
    if (rate == null || n == null || n <= 0) continue;
    totalSucc += rate * n;
    totalN += n;
    seasons += 1;
  }
  const rate = totalN > 0 ? totalSucc / totalN : 0;
  return { rate, n: totalN, seasons, ci: wilson95(rate, totalN) };
}

/**
 * Season-balanced estimate: every season carries equal weight, regardless of
 * how many teams that season contributed. Guards against a single large
 * season dominating the average. The point estimate is the simple mean of the
 * per-season rates; the interval combines the per-season Wilson intervals so a
 * season with few teams widens the result appropriately.
 */
export function seasonBalanced(points: SeasonPoint[]): AggregateResult {
  const valid = points.filter(
    (p): p is { rate: number; n: number } =>
      p.rate != null && p.n != null && p.n > 0,
  );
  const k = valid.length;
  let totalN = 0;
  for (const p of valid) totalN += p.n;
  if (k === 0) return { rate: 0, n: 0, seasons: 0, ci: null };

  const rate = valid.reduce((a, p) => a + p.rate, 0) / k;

  // Combine the per-season Wilson intervals under equal weighting. Treating the
  // seasons' interval half-widths as independent, the equal-weighted mean has
  // half-width sqrt(sum(hw_i^2)) / k. This inflates when any season is thin.
  let sumSqHalf = 0;
  let anyCi = false;
  for (const p of valid) {
    const ci = wilson95(p.rate, p.n);
    if (ci) {
      sumSqHalf += ci.halfWidth * ci.halfWidth;
      anyCi = true;
    }
  }
  let ci: Interval | null = null;
  if (anyCi) {
    const halfWidth = Math.sqrt(sumSqHalf) / k;
    ci = {
      low: Math.max(0, rate - halfWidth),
      high: Math.min(1, rate + halfWidth),
      halfWidth,
    };
  }
  return { rate, n: totalN, seasons: k, ci };
}

export type Weighting = "pooled" | "balanced";

export function aggregate(
  points: SeasonPoint[],
  weighting: Weighting,
): AggregateResult {
  return weighting === "pooled" ? pooled(points) : seasonBalanced(points);
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

/** "±X.X pp" formatting of an interval half-width. */
export function fmtCiPp(ci: Interval | null): string {
  if (!ci) return "";
  return `±${(ci.halfWidth * 100).toFixed(1)} pp`;
}

/** "[low%, high%]" formatting of an interval. */
export function fmtCiRange(ci: Interval | null): string {
  if (!ci) return "";
  return `[${(ci.low * 100).toFixed(1)}%, ${(ci.high * 100).toFixed(1)}%]`;
}
