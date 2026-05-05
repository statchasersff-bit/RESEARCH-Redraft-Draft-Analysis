import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Users, Calendar, Trophy, Target } from "lucide-react";

interface SummaryData {
  total_leagues_analyzed: number;
  total_teams_analyzed: number;
  seasons_included?: string[];
  best_overall_strategies?: Array<{ strategy: string; playoff_rate: number }>;
  baseline?: { playoff_rate: number; championship_rate: number };
}

interface Props {
  data?: SummaryData;
  isLoading?: boolean;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  isLoading?: boolean;
  accent?: boolean;
}

function StatCard({ label, value, sub, icon, isLoading, accent }: StatCardProps) {
  return (
    <div
      className={`bg-card rounded-xl border p-5 flex flex-col gap-2 shadow-sm hover:shadow transition-shadow ${accent ? "border-accent/40" : "border-border"}`}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={`p-1.5 rounded-md ${accent ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
          {icon}
        </div>
      </div>
      {isLoading ? (
        <>
          <Skeleton className="h-8 w-24" />
          {sub && <Skeleton className="h-4 w-32" />}
        </>
      ) : (
        <>
          <div className="text-2xl font-bold text-foreground">{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </>
      )}
    </div>
  );
}

export function SummaryCards({ data, isLoading }: Props) {
  const bestStrategy = data?.best_overall_strategies?.[0];
  const seasons = data?.seasons_included;
  const seasonStr = seasons && seasons.length > 0
    ? `${seasons[0]}–${seasons[seasons.length - 1]}`
    : "—";

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <StatCard
        label="Leagues Analyzed"
        value={isLoading ? "—" : (data?.total_leagues_analyzed?.toLocaleString() ?? "0")}
        icon={<Trophy className="h-4 w-4" />}
        isLoading={isLoading}
      />
      <StatCard
        label="Teams Analyzed"
        value={isLoading ? "—" : (data?.total_teams_analyzed?.toLocaleString() ?? "0")}
        icon={<Users className="h-4 w-4" />}
        isLoading={isLoading}
      />
      <StatCard
        label="Seasons Covered"
        value={isLoading ? "—" : seasonStr}
        sub={seasons ? `${seasons.length} season${seasons.length !== 1 ? "s" : ""}` : undefined}
        icon={<Calendar className="h-4 w-4" />}
        isLoading={isLoading}
      />
      <StatCard
        label="Baseline Playoff Rate"
        value={isLoading ? "—" : (data?.baseline?.playoff_rate != null ? `${(data.baseline.playoff_rate * 100).toFixed(1)}%` : "—")}
        sub="Overall across all teams"
        icon={<Target className="h-4 w-4" />}
        isLoading={isLoading}
      />
      <StatCard
        label="Best Strategy"
        value={isLoading ? "—" : (bestStrategy?.strategy ?? "—")}
        sub={bestStrategy ? `${(bestStrategy.playoff_rate * 100).toFixed(1)}% playoff rate` : undefined}
        icon={<TrendingUp className="h-4 w-4" />}
        isLoading={isLoading}
        accent
      />
    </div>
  );
}
