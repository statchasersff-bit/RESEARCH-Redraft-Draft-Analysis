import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Hero } from "@/components/layout/Hero";
import { SummaryCards } from "@/components/analytics/SummaryCards";
import { StrategyTable } from "@/components/analytics/StrategyTable";
import { Takeaways } from "@/components/analytics/Takeaways";
import { SlotTab } from "@/components/analytics/SlotTab";
import { FormatSection } from "@/components/analytics/FormatSection";
import { RecommendationCards } from "@/components/analytics/RecommendationCards";
import { LeagueAuditTable } from "@/components/analytics/LeagueAuditTable";
import { RoundValueTable } from "@/components/analytics/RoundValueTable";
import { NegativeStrategies } from "@/components/analytics/NegativeStrategies";
import { NoDataState } from "@/components/analytics/NoDataState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetRedraftSummary,
  useGetRedraftBySlot,
  useGetRedraftByFormat,
  useGetRedraftFirstTwoPicks,
  useGetRedraftFirstFiveBuilds,
  useGetRedraftRoundValue,
  useGetRedraftRecommendations,
  useGetRedraftLeagueAudit,
  useGetRedraftNegativeStrategies,
  useGetRedraftPlayoffMissRisk,
} from "@workspace/api-client-react";
import { ChevronDown } from "lucide-react";

const MAIN_TABS = [
  { id: "overall", label: "Overall" },
  { id: "slot", label: "Draft Slot" },
  { id: "format", label: "Scoring Format" },
  { id: "first-two", label: "First Two Picks" },
  { id: "first-five", label: "First Five Rounds" },
  { id: "round-value", label: "Round Value" },
] as const;

const REC_TABS = [
  { id: "overall", label: "Overall", key: "overall" },
  { id: "early_slot", label: "Early Slot", key: "early_slot" },
  { id: "middle_slot", label: "Middle Slot", key: "middle_slot" },
  { id: "late_slot", label: "Late Slot", key: "late_slot" },
  { id: "ppr", label: "PPR", key: "ppr" },
  { id: "half_ppr", label: "Half PPR", key: "half_ppr" },
  { id: "superflex", label: "Superflex", key: "superflex" },
] as const;

const SLOT_TABS = [
  { id: "early", label: "Early" },
  { id: "middle", label: "Middle" },
  { id: "late", label: "Late" },
] as const;

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function TabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: readonly { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-border pb-0 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
            active === tab.id
              ? "border-primary text-primary bg-card"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
          data-testid={`tab-${tab.id}`}
        >
          {tab.label}
        </button>
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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("overall");
  const [activeSlot, setActiveSlot] = useState<string>("early");
  const [activeRec, setActiveRec] = useState<string>("overall");
  const [auditOpen, setAuditOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useGetRedraftSummary();
  const { data: bySlot, isLoading: slotLoading } = useGetRedraftBySlot();
  const { data: byFormat, isLoading: formatLoading } = useGetRedraftByFormat();
  const { data: firstTwo, isLoading: firstTwoLoading } = useGetRedraftFirstTwoPicks();
  const { data: firstFive, isLoading: firstFiveLoading } = useGetRedraftFirstFiveBuilds();
  const { data: roundValue, isLoading: roundValueLoading } = useGetRedraftRoundValue();
  const { data: recommendations, isLoading: recsLoading } = useGetRedraftRecommendations();
  const { data: audit, isLoading: auditLoading } = useGetRedraftLeagueAudit();
  const { data: negativeStrategies, isLoading: negativeLoading } = useGetRedraftNegativeStrategies();
  const { data: playoffMissRisk, isLoading: missRiskLoading } = useGetRedraftPlayoffMissRisk();

  // Show no-data state when summary returns 404
  const isNoData = summaryError && (summaryError as { status?: number })?.status === 404;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />

      {isNoData ? (
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          <NoDataState />
        </div>
      ) : (
        <div className="container mx-auto px-4 py-10 max-w-6xl space-y-10">

          {/* ── Summary Cards ───────────────────────────────────────────── */}
          <section data-testid="summary-cards">
            <SectionHeader
              title="At a Glance"
              sub="High-level statistics from the analyzed league sample"
            />
            <SummaryCards data={summary as any} isLoading={summaryLoading} />
          </section>

          {/* ── Main Analytics Tabs ─────────────────────────────────────── */}
          <section data-testid="analytics-tabs">
            <SectionHeader
              title="Draft Strategy Analysis"
              sub="Which draft builds correlated with the best fantasy results in this sample"
            />
            <TabBar tabs={MAIN_TABS} active={activeTab} onSelect={setActiveTab} />

            {/* Overall */}
            {activeTab === "overall" && (
              <div className="space-y-6" data-testid="tab-content-overall">
                {summaryLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <>
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Best Overall Strategies
                      </h3>
                      <StrategyTable
                        rows={((summary as any)?.best_overall_strategies ?? []) as any}
                        highlightFirst
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Worst Overall Strategies
                      </h3>
                      <StrategyTable
                        rows={((summary as any)?.worst_overall_strategies ?? []) as any}
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Best First Round Positions
                      </h3>
                      <StrategyTable
                        rows={((summary as any)?.best_first_round_positions ?? []) as any}
                      />
                    </div>
                    <Takeaways takeaways={(summary as any)?.key_takeaways} />
                  </>
                )}
              </div>
            )}

            {/* Draft Slot */}
            {activeTab === "slot" && (
              <div data-testid="tab-content-slot">
                <div className="flex flex-wrap gap-2 mb-6">
                  {SLOT_TABS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setActiveSlot(t.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                        activeSlot === t.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:bg-muted"
                      }`}
                      data-testid={`slot-tab-${t.id}`}
                    >
                      {t.label} Slot
                    </button>
                  ))}
                </div>
                {slotLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <>
                    {activeSlot === "early" && (
                      <SlotTab data={(bySlot as any)?.early} label="Early" />
                    )}
                    {activeSlot === "middle" && (
                      <SlotTab data={(bySlot as any)?.middle} label="Middle" />
                    )}
                    {activeSlot === "late" && (
                      <SlotTab data={(bySlot as any)?.late} label="Late" />
                    )}
                  </>
                )}
              </div>
            )}

            {/* Scoring Format */}
            {activeTab === "format" && (
              <div data-testid="tab-content-format">
                {formatLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <FormatSection data={byFormat as any} />
                )}
              </div>
            )}

            {/* First Two Picks */}
            {activeTab === "first-two" && (
              <div data-testid="tab-content-first-two">
                <p className="text-sm text-muted-foreground mb-4">
                  Performance metrics for all first-two-pick position combinations (e.g. RB/WR means RB in round 1, WR in round 2).
                </p>
                {firstTwoLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <StrategyTable
                    rows={((firstTwo as any)?.combos ?? []) as any}
                    highlightFirst
                  />
                )}
              </div>
            )}

            {/* First Five Rounds */}
            {activeTab === "first-five" && (
              <div data-testid="tab-content-first-five">
                <p className="text-sm text-muted-foreground mb-4">
                  Performance metrics grouped by the positional sequence of the first five picks (e.g. RB/WR/WR/RB/QB).
                </p>
                {firstFiveLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <StrategyTable
                    rows={((firstFive as any)?.builds ?? []) as any}
                    highlightFirst
                  />
                )}
              </div>
            )}

            {/* Round Value */}
            {activeTab === "round-value" && (
              <div data-testid="tab-content-round-value">
                <p className="text-sm text-muted-foreground mb-4">
                  Which positions performed best when drafted in each round. Select a round to view position-level metrics.
                </p>
                {roundValueLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <RoundValueTable rounds={(roundValue as any)?.rounds} />
                )}
              </div>
            )}
          </section>

          {/* ── Recommendations ─────────────────────────────────────────── */}
          <section data-testid="recommendations">
            <SectionHeader
              title="Draft Recommendations"
              sub="Plain-English guidance derived from the data. Based on correlated performance — not guarantees."
            />
            <TabBar tabs={REC_TABS} active={activeRec} onSelect={setActiveRec} />
            {recsLoading ? (
              <LoadingSkeleton />
            ) : (
              <>
                {activeRec === "overall" && (
                  <RecommendationCards
                    group={(recommendations as any)?.overall}
                    label="Overall"
                  />
                )}
                {activeRec === "early_slot" && (
                  <RecommendationCards
                    group={(recommendations as any)?.early_slot}
                    label="Early Slot"
                  />
                )}
                {activeRec === "middle_slot" && (
                  <RecommendationCards
                    group={(recommendations as any)?.middle_slot}
                    label="Middle Slot"
                  />
                )}
                {activeRec === "late_slot" && (
                  <RecommendationCards
                    group={(recommendations as any)?.late_slot}
                    label="Late Slot"
                  />
                )}
                {activeRec === "ppr" && (
                  <RecommendationCards
                    group={(recommendations as any)?.ppr}
                    label="PPR"
                  />
                )}
                {activeRec === "half_ppr" && (
                  <RecommendationCards
                    group={(recommendations as any)?.half_ppr}
                    label="Half PPR"
                  />
                )}
                {activeRec === "superflex" && (
                  <RecommendationCards
                    group={(recommendations as any)?.superflex}
                    label="Superflex"
                  />
                )}
              </>
            )}
          </section>

          {/* ── Negative Strategies ─────────────────────────────────────── */}
          <section data-testid="negative-strategies">
            <SectionHeader
              title="Draft Strategies That Miss the Playoffs"
              sub="Strategies that consistently underperformed in this sample. Avoid unless league-specific conditions justify them."
            />
            <NegativeStrategies
              negativeData={negativeStrategies as any}
              missRiskData={playoffMissRisk as any}
              isLoading={negativeLoading || missRiskLoading}
            />
          </section>

          {/* ── League Audit ─────────────────────────────────────────────── */}
          <section data-testid="league-audit">
            <button
              className="w-full text-left"
              onClick={() => setAuditOpen((o) => !o)}
              data-testid="audit-toggle"
            >
              <div className="flex items-center justify-between bg-card border rounded-xl px-5 py-4 hover:bg-muted/30 transition-colors">
                <div>
                  <h2 className="text-base font-bold text-foreground">League Processing Audit</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Per-league status log — which leagues were analyzed, skipped, or failed
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform flex-shrink-0 ml-4 ${auditOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>
            {auditOpen && (
              <div className="mt-4">
                {auditLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <LeagueAuditTable data={audit as any} />
                )}
              </div>
            )}
          </section>

        </div>
      )}

      {/* Footer */}
      <footer className="border-t mt-16 py-8 text-center text-sm text-muted-foreground bg-card">
        <p className="font-medium text-foreground">StatChasers Redraft Draft Strategy Analyzer</p>
        <p className="mt-1">
          Data sourced from Sleeper public API. Results show correlations in this sample — not guarantees of future performance.
        </p>
        <p className="mt-1 text-xs">
          Run <code className="bg-muted px-1 rounded font-mono">pnpm run redraft:update</code> to refresh analysis data.
        </p>
      </footer>
    </div>
  );
}
