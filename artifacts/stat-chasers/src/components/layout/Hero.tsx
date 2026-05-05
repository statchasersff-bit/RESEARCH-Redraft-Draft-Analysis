import { useGetRedraftSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export function Hero() {
  const { data: summary, isLoading, isError } = useGetRedraftSummary();

  return (
    <div className="bg-primary py-16 lg:py-24 text-primary-foreground border-b-4 border-accent">
      <div className="container mx-auto px-4 max-w-4xl text-center">
        <div className="inline-block bg-primary-foreground/10 px-3 py-1 rounded-full text-xs font-semibold tracking-wider text-accent mb-6 uppercase">
          Premium Analytics Report
        </div>
        <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-6">
          The Optimal Redraft Draft Strategy:
          <span className="block text-accent mt-2">What 5 Years of Sleeper Drafts Reveal</span>
        </h1>
        <p className="text-lg lg:text-xl text-primary-foreground/80 max-w-3xl mx-auto leading-relaxed">
          We analyzed real Sleeper redraft leagues to find which draft builds actually lead to playoff teams, high-scoring rosters, and championships.
        </p>
        
        <div className="mt-8 flex items-center justify-center gap-4 text-sm font-medium text-primary-foreground/70">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-white">
              {isLoading ? <Skeleton className="h-8 w-24 mb-1 bg-white/20" /> : summary?.total_leagues_analyzed?.toLocaleString() || "0"}
            </span>
            <span>Leagues</span>
          </div>
          <div className="w-px h-8 bg-white/20 mx-4"></div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-white">
              {isLoading ? <Skeleton className="h-8 w-24 mb-1 bg-white/20" /> : summary?.total_teams_analyzed?.toLocaleString() || "0"}
            </span>
            <span>Teams</span>
          </div>
        </div>
      </div>
    </div>
  );
}
