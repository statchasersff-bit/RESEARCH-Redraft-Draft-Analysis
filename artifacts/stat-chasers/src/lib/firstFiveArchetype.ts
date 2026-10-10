export interface BuildRow {
  strategy: string;
  sample_size: number;
  playoff_rate: number;
  championship_rate: number;
  top_3_pf_rate: number;
  average_points_for: number;
  playoff_rate_lift: number;
  confidence_level: string;
  [key: string]: unknown;
}

export interface ArchetypeRow extends BuildRow {
  exact_builds: string[];
}

/**
 * Classify a 5-pick build string (e.g. "WR/RB/QB/WR/RB") into a human-readable
 * archetype label. A single primary label (driven by RB count) gets zero or more
 * modifier tags appended for WR-heavy, early QB, and early TE tendencies.
 */
export function getBuildArchetype(buildStr: string): string {
  const pos = buildStr.split("/");
  const rb = pos.filter((p) => p === "RB").length;
  const wr = pos.filter((p) => p === "WR").length;
  const qbIdx = pos.indexOf("QB");
  const teIdx = pos.indexOf("TE");

  // Primary skeleton — based on RB count
  let primary: string;
  if (rb === 0) primary = "Zero RB";
  else if (rb === 1) primary = "Hero RB";
  else if (rb >= 3) primary = "Robust RB";
  else primary = "Balanced"; // exactly 2 RBs

  // Modifiers — positional tendencies that override the typical skeleton
  const mods: string[] = [];
  if (wr >= 3) mods.push("WR Heavy");
  if (qbIdx >= 0 && qbIdx <= 3) mods.push("Early QB"); // QB in picks 1–4
  if (teIdx >= 0 && teIdx <= 3) mods.push("Early TE"); // TE in picks 1–4

  if (mods.length === 0) return primary;
  return `${primary} + ${mods.join(" + ")}`;
}

/**
 * Collapse a list of exact-build rows into archetype groups.
 * Stats are weighted-averaged by sample_size; sample sizes are summed.
 * The returned rows are sorted by playoff_rate_lift descending.
 */
export function groupByArchetype(rows: BuildRow[]): ArchetypeRow[] {
  const map = new Map<string, { rows: BuildRow[] }>();

  for (const row of rows) {
    const key = getBuildArchetype(row.strategy);
    if (!map.has(key)) map.set(key, { rows: [] });
    map.get(key)!.rows.push(row);
  }

  const result: ArchetypeRow[] = [];

  for (const [archetype, { rows: group }] of map) {
    const totalSample = group.reduce((s, r) => s + r.sample_size, 0);

    function wavg(field: keyof BuildRow): number {
      return group.reduce((s, r) => s + (r[field] as number) * r.sample_size, 0) / totalSample;
    }

    result.push({
      strategy: archetype,
      sample_size: totalSample,
      playoff_rate: wavg("playoff_rate"),
      championship_rate: wavg("championship_rate"),
      top_3_pf_rate: wavg("top_3_pf_rate"),
      average_points_for: wavg("average_points_for"),
      playoff_rate_lift: wavg("playoff_rate_lift"),
      // confidence_level kept for type compat; TrustBadge derives from sample_size
      confidence_level: totalSample >= 5000 ? "High" : totalSample >= 1000 ? "Medium" : "Low",
      exact_builds: group.map((r) => r.strategy),
    });
  }

  return result.sort((a, b) => b.playoff_rate_lift - a.playoff_rate_lift);
}
