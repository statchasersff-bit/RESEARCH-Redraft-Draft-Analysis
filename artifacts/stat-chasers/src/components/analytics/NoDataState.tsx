import { Database } from "lucide-react";

export function NoDataState() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="bg-card border rounded-2xl shadow-sm p-10 max-w-lg w-full">
        <div className="flex justify-center mb-5">
          <div className="bg-primary/10 p-4 rounded-full">
            <Database className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">No Analysis Data Yet</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          The data pipeline hasn't been run yet. Add your Sleeper league IDs to{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
            data/input/sleeper_redraft_leagues.csv
          </code>{" "}
          then generate the analysis.
        </p>
        <div className="bg-muted rounded-lg px-4 py-3 text-left">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Run this command:
          </p>
          <code className="text-sm font-mono text-foreground">
            pnpm run redraft:update
          </code>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Use <code className="bg-muted px-1 rounded font-mono">--refresh</code> flag to force re-fetch all Sleeper data
        </p>
      </div>
    </div>
  );
}
