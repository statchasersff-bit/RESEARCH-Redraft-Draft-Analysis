import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Users, Calendar, Trophy, Target } from "lucide-react";

interface SummaryData {
  total_leagues_analyzed?: number;
  total_teams_analyzed?: number;
  seasons_included?: string[];
  best_overall_strategies?: Array<{ strategy: string; playoff_rate: number }>;
  baseline?: { playoff_rate: number; championship_rate: number };
}

interface Props {
  data?: SummaryData;
  isLoading?: boolean;
  baselineSub?: string;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  isLoading?: boolean;
  accent?: boolean;
}

function StatCard({ label, value, sub, icon, isLoading, accent }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-3 ${
        accent
          ? "border-[#C9A227]/45 bg-[#C9A227]/[0.06] shadow-[0_1px_3px_rgba(201,162,39,0.10)]"
          : "border-border bg-card shadow-[0_1px_2px_rgba(11,31,58,0.04)]"
      }`}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
          {label}
        </span>
        <span className={`shrink-0 ${accent ? "text-[#C9A227]" : "text-muted-foreground/45"}`} aria-hidden>
          {icon}
        </span>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-24" />
          {sub && <Skeleton className="h-3.5 w-28" />}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className={`text-2xl font-bold leading-none tracking-tight ${accent ? "text-[#0B1F3A]" : "text-foreground"}`}>
            {value}
          </div>
          {sub && <div className="text-xs text-muted-foreground leading-snug">{sub}</div>}
        </div>
      )}
    </div>
  );
}

export function SummaryCards({ data, isLoading, baselineSub }: Props) {
  const bestStrategy = data?.best_overall_strategies?.[0];
  const baselineRate = data?.baseline?.playoff_rate;
  const bestLift =
    bestStrategy && baselineRate != null
      ? (bestStrategy.playoff_rate - baselineRate) * 100
      : null;
  const seasons = data?.seasons_included;
  const seasonStr = seasons && seasons.length > 0
    ? seasons.length === 1
      ? seasons[0]
      : `${seasons[0]}–${seasons[seasons.length - 1]}`
    : "—";

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
      <StatCard
        label="Leagues Analyzed"
        value={isLoading ? "—" : (data?.total_leagues_analyzed != null ? data.total_leagues_analyzed.toLocaleString() : "—")}
        sub="Current filter sample"
        icon={<Trophy className="h-4 w-4" />}
        isLoading={isLoading}
      />
      <StatCard
        label="Teams Analyzed"
        value={isLoading ? "—" : (data?.total_teams_analyzed != null ? data.total_teams_analyzed.toLocaleString() : "—")}
        sub="Drafted rosters in sample"
        icon={<Users className="h-4 w-4" />}
        isLoading={isLoading}
      />
      <StatCard
        label="Seasons Covered"
        value={isLoading ? "—" : seasonStr}
        sub={seasons ? `${seasons.length} season${seasons.length !== 1 ? "s" : ""} of drafts` : undefined}
        icon={<Calendar className="h-4 w-4" />}
        isLoading={isLoading}
      />
      <StatCard
        label="Baseline Playoff Rate"
        value={isLoading ? "—" : (data?.baseline?.playoff_rate != null ? `${(data.baseline.playoff_rate * 100).toFixed(1)}%` : "—")}
        sub={baselineSub ?? "Overall across all teams"}
        icon={<Target className="h-4 w-4" />}
        isLoading={isLoading}
      />
      <StatCard
        label="Best Strategy"
        value={isLoading ? "—" : (bestStrategy?.strategy ?? "—")}
        sub={
          bestStrategy ? (
            <span className="flex flex-col gap-0.5">
              <span>{(bestStrategy.playoff_rate * 100).toFixed(1)}% playoff rate</span>
              {bestLift != null && (
                <span className="font-semibold text-[#9A7A1C]">
                  {bestLift >= 0 ? "+" : ""}{bestLift.toFixed(1)} pts vs baseline
                </span>
              )}
            </span>
          ) : undefined
        }
        icon={<Sparkles className="h-4 w-4" />}
        isLoading={isLoading}
        accent
      />
    </div>
  );
}
