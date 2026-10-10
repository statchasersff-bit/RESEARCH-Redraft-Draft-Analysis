import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { FilterBar, filtersToKey } from "@/components/layout/FilterBar";
import type { Filters, QbFilter, ScoringFilter, TepFilter, SizeFilter, SeasonFilter } from "@/components/layout/FilterBar";
import { coerceSupportedFormat } from "@/lib/filter-utils";
import { FormatContextBar } from "@/components/layout/FormatContextBar";
import { StrategyTable } from "@/components/analytics/StrategyTable";
import { RoundValueTable } from "@/components/analytics/RoundValueTable";
import { StrategyCharts } from "@/components/analytics/StrategyCharts";
import { NoDataState } from "@/components/analytics/NoDataState";
import DraftBoard from "@/components/analytics/DraftBoard";
import { CompareTable } from "@/components/analytics/CompareTable";
import { CompareRoundValueTable } from "@/components/analytics/CompareRoundValueTable";
import { RobustRbRebound } from "@/components/analytics/RobustRbRebound";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetRedraftSummary,
  useGetRedraftRecommendations,
  useGetRedraftNegativeStrategies,
  useGetRedraftPlayoffMissRisk,
  useGetRedraftFilterTrends,
} from "@workspace/api-client-react";
import { ChevronDown, BookOpen } from "lucide-react";

const REC_TABS = [
  { id: "overall", label: "Overall", key: "overall" },
] as const;

const DEFAULT_FILTERS: Filters = {
  qb: "one_qb",
  scoring: "ppr",
  tep: "no_tep",
  size: "12",
  season: "2025",
};

function urlToFilters(params: Partial<Record<string, string>>): Filters {
  const qbMap: Record<string, QbFilter> = { superflex: "superflex", "1qb": "one_qb" };
  const scoringMap: Record<string, ScoringFilter> = { ppr: "ppr", "half-ppr": "half_ppr" };
  const tepMap: Record<string, TepFilter> = { tep: "tep", "no-tep": "no_tep" };
  const sizeMap: Record<string, SizeFilter> = { "10": "10", "12": "12" };
  const seasonMap: Record<string, SeasonFilter> = { "2021": "2021", "2022": "2022", "2023": "2023", "2024": "2024", "2025": "2025", compare: "compare" };
  return coerceSupportedFormat({
    qb: qbMap[params.qb ?? ""] ?? DEFAULT_FILTERS.qb,
    scoring: scoringMap[params.scoring ?? ""] ?? DEFAULT_FILTERS.scoring,
    tep: tepMap[params.tep ?? ""] ?? DEFAULT_FILTERS.tep,
    size: sizeMap[params.size ?? ""] ?? DEFAULT_FILTERS.size,
    season: seasonMap[params.season ?? ""] ?? DEFAULT_FILTERS.season,
  });
}

function filtersToPath(f: Filters): string {
  const qb = f.qb === "superflex" ? "superflex" : "1qb";
  const scoring = f.scoring === "half_ppr" ? "half-ppr" : f.scoring;
  const tep = f.tep === "no_tep" ? "no-tep" : "tep";
  return `/redraft-draft-strategy-analysis/${f.season}/${qb}/${scoring}/${tep}/${f.size}`;
}

// Merge best + worst strategy lists into one deduped set (by strategy name,
// keeping the first occurrence). The combined table sorts by "vs Average" so
// best strategies land at the top and worst at the bottom automatically.
function mergeStrategies(...lists: Array<any[] | undefined>): any[] {
  const byName = new Map<string, any>();
  for (const list of lists) {
    for (const row of list ?? []) {
      if (row?.strategy != null && !byName.has(row.strategy)) byName.set(row.strategy, row);
    }
  }
  return Array.from(byName.values());
}

function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="h-4 w-1 rounded-full bg-[#C9A227]" aria-hidden />
          <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
        </div>
        {sub && <p className="text-sm text-muted-foreground mt-1.5 ml-[14px]">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

const GLOSSARY_SECTIONS = [
  {
    title: "Core Draft Strategies",
    subtitle: "Each team belongs to exactly one core archetype based on rounds 1–5.",
    entries: [
      { name: "Zero RB",   def: "0 RBs in rounds 1–5. Prioritizes WRs and other positions early, targeting RB value in mid/late rounds." },
      { name: "Hero RB",   def: "Exactly 1 RB in rounds 1–5. One high-upside RB anchor paired with heavy WR investment." },
      { name: "Robust RB", def: "3+ RBs in rounds 1–5. Heavy early investment in the RB position for depth and volume." },
      { name: "WR Heavy",  def: "3+ WRs in rounds 1–5 with fewer than 3 RBs. Commits to wide receiver depth and upside." },
      { name: "Balanced",  def: "Exactly 2 RBs and fewer than 3 WRs in rounds 1–5. A mixed start without extreme positional concentration." },
    ],
  },
  {
    title: "Positional Timing",
    subtitle: "Independent overlays — a team can be Hero RB + Late QB at the same time.",
    entries: [
      { name: "Elite QB", def: "First QB drafted in rounds 1–4." },
      { name: "Late QB",  def: "First QB not drafted until round 8 or later." },
      { name: "Elite TE", def: "First TE drafted in rounds 1–2." },
      { name: "Late TE",  def: "First TE not drafted until round 8 or later." },
    ],
  },
  {
    title: "Draft Openings",
    subtitle: "First two picks — tracked separately as an additional analysis layer.",
    entries: [
      { name: "RB/RB", def: "RB in both rounds 1 and 2." },
      { name: "WR/WR", def: "WR in both rounds 1 and 2." },
      { name: "RB/WR", def: "RB in round 1, WR in round 2." },
      { name: "WR/RB", def: "WR in round 1, RB in round 2." },
    ],
  },
];

// Compact toggle — anchored inside the Draft Data section header
function GlossaryToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="strategy-glossary-panel"
      className="inline-flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-1 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1F3A]/30 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      data-testid="glossary-toggle"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#0B1F3A]/[0.06] text-[#0B1F3A]/70">
        <BookOpen className="h-3.5 w-3.5" />
      </span>
      <span className="flex flex-col leading-tight min-w-0">
        <span className="text-xs font-semibold text-foreground">Strategy Glossary</span>
        <span className="text-[11px] text-muted-foreground hidden sm:block">What each draft strategy means</span>
      </span>
      <ChevronDown
        className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      />
    </button>
  );
}

// Full-width expandable panel — drops below the section header when open
function GlossaryPanel() {
  return (
    <div
      id="strategy-glossary-panel"
      className="rounded-xl border border-border bg-card px-5 py-4 space-y-6"
    >
      {GLOSSARY_SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{section.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
            {section.entries.map((e) => (
              <div key={e.name} className="flex gap-2.5">
                <span className="mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full bg-[#0B1F3A]/50 relative top-[5px]" />
                <div>
                  <span className="font-semibold text-sm text-foreground">{e.name}</span>
                  <span className="text-sm text-muted-foreground">: {e.def}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-3/4" />
    </div>
  );
}

function MetricToggle({
  mode,
  onChange,
}: {
  mode: "playoff" | "pf";
  onChange: (mode: "playoff" | "pf") => void;
}) {
  return (
    <div className="flex shrink-0 rounded-md border border-border overflow-hidden text-xs font-medium">
      <button
        onClick={() => onChange("playoff")}
        className={`px-3 py-1.5 transition-colors ${
          mode === "playoff"
            ? "bg-[#0B1F3A] text-white"
            : "bg-background text-muted-foreground hover:bg-muted"
        }`}
      >
        Playoff %
      </button>
      <button
        onClick={() => onChange("pf")}
        className={`px-3 py-1.5 transition-colors border-l border-border ${
          mode === "pf"
            ? "bg-[#0B1F3A] text-white"
            : "bg-background text-muted-foreground hover:bg-muted"
        }`}
      >
        Top 3 PF %
      </button>
    </div>
  );
}

export default function Dashboard() {
  const params = useParams<{ season: string; qb: string; scoring: string; tep: string; size: string }>();
  const [, navigate] = useLocation();
  const filters = useMemo(() => urlToFilters(params), [params.season, params.qb, params.scoring, params.tep, params.size]);
  const handleFiltersChange = (f: Filters) => navigate(filtersToPath(f));

  const [activeTab, setActiveTab] = useState<string>("overall");
  const [overallMetricMode, setOverallMetricMode] = useState<"playoff" | "pf">("playoff");
  const [firstTwoMetricMode, setFirstTwoMetricMode] = useState<"playoff" | "pf">("playoff");
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const isCompareMode = filters.season === "compare";
  const comboKey = filtersToKey(filters);
  const baseKey = `${filters.qb}__${filters.scoring}__${filters.tep}__${filters.size}`;
  const comboKeys = isCompareMode
    ? [`${baseKey}__2021`, `${baseKey}__2022`, `${baseKey}__2023`, `${baseKey}__2024`, `${baseKey}__2025`]
    : [comboKey];

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useGetRedraftSummary();
  const { data: recommendations, isLoading: recsLoading } = useGetRedraftRecommendations();
  const { data: negativeStrategies, isLoading: negativeLoading } = useGetRedraftNegativeStrategies();
  const { data: playoffMissRisk, isLoading: missRiskLoading } = useGetRedraftPlayoffMissRisk();
  const { data: filterCombos, isLoading: combosLoading } = useQuery({
    queryKey: ["redraft-filter-combos", comboKeys],
    queryFn: async ({ signal }) => {
      const url = `/api/redraft/filter-combos?key=${comboKeys.join(",")}`;
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error("Failed to fetch filter combos");
      return res.json() as Promise<{ generated_at: string; combos: Record<string, any> }>;
    },
  });
  const { data: filterTrends, isLoading: trendsLoading } = useGetRedraftFilterTrends({
    query: { enabled: isCompareMode } as any,
  });
  const filteredSlice = useMemo(() => {
    if (!filterCombos || isCompareMode) return null;
    return (filterCombos as any)?.combos?.[comboKey] ?? null;
  }, [filterCombos, comboKey, isCompareMode]);

  // Trends key has no season dimension: 4-part key
  const trendsKey = `${filters.qb}__${filters.scoring}__${filters.tep}__${filters.size}`;
  const trendsSlice = useMemo(() => {
    if (!filterTrends || !isCompareMode) return null;
    return (filterTrends as any)?.trends?.[trendsKey] ?? null;
  }, [filterTrends, trendsKey, isCompareMode]);

  const isFiltered = !!filteredSlice;
  const isLoading = isCompareMode ? trendsLoading : combosLoading;

  const isNoData = summaryError && (summaryError as { status?: number })?.status === 404;

  // StrategyCharts data for compare mode — weighted averages across all available years
  const chartsDataForCompare = useMemo(() => {
    if (!isCompareMode || !trendsSlice) return [];
    const ts = trendsSlice as any;
    const strats: any[] = ts.overall_strategies ?? [];
    const b21: number = ts.baseline_playoff_rate_2021 ?? 0;
    const b22: number = ts.baseline_playoff_rate_2022 ?? 0;
    const b23: number = ts.baseline_playoff_rate_2023 ?? 0;
    const b24: number = ts.baseline_playoff_rate_2024 ?? 0;
    const b25: number = ts.baseline_playoff_rate_2025 ?? 0;
    const bN21: number = ts.sample_2021 ?? 0;
    const bN22: number = ts.sample_2022 ?? 0;
    const bN23: number = ts.sample_2023 ?? 0;
    const bN24: number = ts.sample_2024 ?? 0;
    const bN25: number = ts.sample_2025 ?? 0;
    const bTotal = bN21 + bN22 + bN23 + bN24 + bN25;
    const baseline = bTotal > 0
      ? (b21 * bN21 + b22 * bN22 + b23 * bN23 + b24 * bN24 + b25 * bN25) / bTotal
      : (b24 + b25) / 2;
    return strats.map((s: any) => {
      const n21: number = s.sample_2021 ?? 0;
      const n22: number = s.sample_2022 ?? 0;
      const n23: number = s.sample_2023 ?? 0;
      const n24: number = s.sample_2024;
      const n25: number = s.sample_2025;
      const total = n21 + n22 + n23 + n24 + n25;
      const wa = (v21: number, v22: number, v23: number, v24: number, v25: number) =>
        total > 0 ? (v21 * n21 + v22 * n22 + v23 * n23 + v24 * n24 + v25 * n25) / total : (v24 + v25) / 2;
      const playoff_rate = wa(s.playoff_rate_2021 ?? 0, s.playoff_rate_2022 ?? 0, s.playoff_rate_2023 ?? 0, s.playoff_rate_2024, s.playoff_rate_2025);
      const championship_rate = wa(s.championship_rate_2021 ?? 0, s.championship_rate_2022 ?? 0, s.championship_rate_2023 ?? 0, s.championship_rate_2024, s.championship_rate_2025);
      const top_3_pf_rate = wa(s.top_3_pf_rate_2021 ?? 0, s.top_3_pf_rate_2022 ?? 0, s.top_3_pf_rate_2023 ?? 0, s.top_3_pf_rate_2024 ?? 0, s.top_3_pf_rate_2025 ?? 0);
      const average_points_for = wa(s.avg_pts_2021 ?? 0, s.avg_pts_2022 ?? 0, s.avg_pts_2023 ?? 0, s.avg_pts_2024, s.avg_pts_2025);
      return {
        strategy: s.strategy,
        sample_size: total,
        average_points_for,
        playoff_rate,
        championship_rate,
        top_3_pf_rate,
        playoff_rate_lift: (playoff_rate - baseline) * 100,
        confidence_level: s.comparison_quality,
      };
    });
  }, [isCompareMode, trendsSlice]);

  const chartsBaselineForCompare = useMemo(() => {
    if (!isCompareMode || !trendsSlice) return undefined;
    const ts = trendsSlice as any;
    const n21: number = ts.sample_2021 ?? 0;
    const n22: number = ts.sample_2022 ?? 0;
    const n23: number = ts.sample_2023 ?? 0;
    const n24: number = ts.sample_2024 ?? 0;
    const n25: number = ts.sample_2025 ?? 0;
    const total = n21 + n22 + n23 + n24 + n25;
    const b21: number = ts.baseline_playoff_rate_2021 ?? 0;
    const b22: number = ts.baseline_playoff_rate_2022 ?? 0;
    const b23: number = ts.baseline_playoff_rate_2023 ?? 0;
    const b24: number = ts.baseline_playoff_rate_2024 ?? 0;
    const b25: number = ts.baseline_playoff_rate_2025 ?? 0;
    return total > 0 ? (b21 * n21 + b22 * n22 + b23 * n23 + b24 * n24 + b25 * n25) / total : (b24 + b25) / 2;
  }, [isCompareMode, trendsSlice]);

  const firstFiveRows = useMemo(
    () => (filteredSlice?.best_first_five_builds ?? []) as any[],
    [filteredSlice]
  );

  const roundValueHeading = (
    <>
      <h3 className="text-sm font-bold text-foreground">
        Round Value
      </h3>
      <div className="mt-1 mb-3 h-0.5 w-[30px] rounded-full bg-[#C9A227]" />
    </>
  );

  const roundValueSection = (
    <div>
      {isFiltered && filteredSlice ? (
        isLoading ? (
          <>
            {roundValueHeading}
            <LoadingSkeleton />
          </>
        ) : (filteredSlice as any)?.round_value?.rounds ? (
          <RoundValueTable rounds={(filteredSlice as any).round_value.rounds} title="Round Value" />
        ) : (
          <>
            {roundValueHeading}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Filtered round value not yet computed. Run <code className="font-mono text-xs bg-amber-100 px-1 rounded">pnpm run redraft:update</code> to regenerate the analysis with format-locked round data.
            </div>
          </>
        )
      ) : (
        <>
          {roundValueHeading}
          <div className="rounded-lg border border-border bg-muted/30 px-5 py-8 text-center space-y-3">
            <p className="text-base font-semibold text-foreground">Format context required</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Round value changes significantly by format. Round 1 QB in Superflex is a completely different
              decision than in 1QB leagues. Select your QB format, scoring, and TEP settings above to see
              format-specific round value.
            </p>
            <p className="text-xs text-muted-foreground">
              Use the filter bar above to lock in your league settings.
            </p>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="rs-app-draft-guide-app min-h-screen bg-background">
      <div className="rs-app-draft-analysis-shell">
      <FilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        trailing={<GlossaryToggle open={glossaryOpen} onToggle={() => setGlossaryOpen((o) => !o)} />}
      />
      {glossaryOpen && (
        <div className="w-full pb-4">
          <GlossaryPanel />
        </div>
      )}
      <FormatContextBar
        filters={filters}
        leagueCount={filteredSlice?.league_count ?? (summary as any)?.total_leagues_analyzed}
        teamCount={filteredSlice?.sample_size ?? (summary as any)?.total_teams_analyzed}
        teamCount2021={(trendsSlice as any)?.sample_2021}
        teamCount2022={(trendsSlice as any)?.sample_2022}
        teamCount2023={(trendsSlice as any)?.sample_2023}
        teamCount2024={(trendsSlice as any)?.sample_2024}
        teamCount2025={(trendsSlice as any)?.sample_2025}
      />

      {isNoData ? (
        <div className="w-full py-5">
          <NoDataState />
        </div>
      ) : (
        <div className="w-full py-5 space-y-10">

          {/* ── Main Analytics Tabs ─────────────────────────────────────── */}
          <section data-testid="analytics-tabs">
            {isCompareMode ? (
              <div className="space-y-6">
                {/* ── Always-visible graphs ── */}
                {isLoading ? (
                  <LoadingSkeleton />
                ) : trendsSlice ? (
                  <>
                    <StrategyCharts
                      strategies={chartsDataForCompare as any}
                      baselinePlayoffRate={chartsBaselineForCompare}
                    />

                    {/* ── Comparison tables — directly below the graphs ── */}
                    <div className="pt-2">
                      <div className="space-y-8" data-testid="tab-content-overall">
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-bold text-foreground">
                              Playoff % by Year
                            </h3>
                            <MetricToggle mode={overallMetricMode} onChange={setOverallMetricMode} />
                          </div>
                          <div className="mt-1 mb-3 h-0.5 w-[30px] rounded-full bg-[#C9A227]" />
                          <CompareTable rows={(trendsSlice as any).overall_strategies ?? []} nameKey="strategy" mode={overallMetricMode} />
                        </div>

                        {/* First Two Picks */}
                        <div data-testid="section-first-two">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-bold text-foreground">
                              First Two Picks
                            </h3>
                            <MetricToggle mode={firstTwoMetricMode} onChange={setFirstTwoMetricMode} />
                          </div>
                          <div className="mt-1 mb-3 h-0.5 w-[30px] rounded-full bg-[#C9A227]" />
                          <CompareTable
                            rows={(trendsSlice as any).first_two_pick_combos ?? []}
                            nameKey="combo"
                            minSample={25}
                            mode={firstTwoMetricMode}
                          />
                        </div>

                        {/* Round Value */}
                        <div data-testid="section-round-value">
                          <CompareRoundValueTable rounds={(trendsSlice as any).round_value ?? []} title="Playoff % by Round" />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Year-over-year comparison data not yet generated. Run{" "}
                    <code className="font-mono text-xs bg-amber-100 px-1 rounded">pnpm run redraft:analyze</code> to
                    produce the trends file.
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Overall */}
                {activeTab === "overall" && (
                  <div className="space-y-6" data-testid="tab-content-overall">
                    {isLoading ? (
                      <LoadingSkeleton />
                    ) : filteredSlice ? (
                      <>
                        <StrategyCharts
                          strategies={[
                            ...((filteredSlice.best_strategies ?? []) as any[]),
                            ...((filteredSlice.worst_strategies ?? []) as any[]),
                          ]}
                          baselinePlayoffRate={(filteredSlice.baseline as any)?.playoff_rate}
                        />
                        <div>
                          <h3 className="text-sm font-bold text-foreground">
                            Overall Strategies
                          </h3>
                          <div className="mt-1 mb-3 h-0.5 w-[30px] rounded-full bg-[#C9A227]" />
                          <StrategyTable rows={mergeStrategies(filteredSlice.best_strategies as any, filteredSlice.worst_strategies as any) as any} highlightFirst showTitleRate qbFormat={filters.qb} />
                        </div>
                        {roundValueSection}
                        {(filteredSlice.best_first_two_pick_combos ?? []).length > 0 && (
                          <div>
                            <h3 className="text-sm font-bold text-foreground">
                              First Two Picks
                            </h3>
                            <div className="mt-1 mb-3 h-0.5 w-[30px] rounded-full bg-[#C9A227]" />
                            <StrategyTable
                              rows={(filteredSlice.best_first_two_pick_combos ?? []) as any}
                              highlightFirst
                              qbFormat={filters.qb}
                            />
                          </div>
                        )}
                        {firstFiveRows.length > 0 && (
                          <div>
                            <StrategyTable
                              rows={firstFiveRows}
                              highlightFirst
                              qbFormat={filters.qb}
                              minSample={250}
                              title="First Five Rounds"
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div>
                          <h3 className="text-sm font-bold text-foreground">
                            Overall Strategies
                          </h3>
                          <div className="mt-1 mb-3 h-0.5 w-[30px] rounded-full bg-[#C9A227]" />
                          <StrategyTable rows={mergeStrategies((summary as any)?.best_overall_strategies, (summary as any)?.worst_overall_strategies) as any} highlightFirst showTitleRate qbFormat={filters.qb} />
                        </div>
                        {roundValueSection}
                      </>
                    )}
                  </div>
                )}

              </>
            )}
          </section>

          {/* ── Why Did Robust RB Rebound? ───────────────────────────────── */}
          {isCompareMode && (
            <section data-testid="robust-rb-rebound">
              <RobustRbRebound trendsSlice={trendsSlice as any} />
            </section>
          )}

          {/* ── Real Draft Board ─────────────────────────────────────────── */}
          {!isCompareMode && (
            <section data-testid="draft-board">
              <SectionHeader
                title="Real Draft Examples"
              />
              <DraftBoard filters={{ qb: filters.qb, scoring: filters.scoring, size: filters.size }} />
            </section>
          )}

        </div>
      )}
      </div>{/* /rs-app-draft-analysis-shell */}
    </div>
  );
}
