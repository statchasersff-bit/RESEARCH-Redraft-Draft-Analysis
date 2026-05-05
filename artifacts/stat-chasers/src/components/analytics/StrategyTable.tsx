import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StrategyRow {
  strategy: string;
  sample_size: number;
  playoff_rate: number;
  championship_rate: number;
  top_3_pf_rate: number;
  average_points_for: number;
  playoff_rate_lift: number;
  confidence_level: string;
}

interface Props {
  rows: StrategyRow[];
  highlightFirst?: boolean;
}

function ConfidenceBadge({ level }: { level: string }) {
  const variants: Record<string, string> = {
    High: "bg-green-100 text-green-800 border-green-200",
    Medium: "bg-blue-100 text-blue-800 border-blue-200",
    Low: "bg-yellow-100 text-yellow-800 border-yellow-200",
    "Very Low": "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variants[level] ?? variants["Very Low"]}`}
    >
      {level}
    </span>
  );
}

function LiftCell({ lift }: { lift: number }) {
  if (lift === 0) return <span className="text-muted-foreground">—</span>;
  const isPos = lift > 0;
  return (
    <span className={`font-semibold text-sm ${isPos ? "text-green-600" : "text-red-500"}`}>
      {isPos ? "+" : ""}
      {lift.toFixed(1)}pp
    </span>
  );
}

function pct(val: number) {
  return `${(val * 100).toFixed(1)}%`;
}

export function StrategyTable({ rows, highlightFirst }: Props) {
  if (!rows || rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No data available — run the pipeline to populate analysis.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="font-semibold text-foreground">Strategy</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Sample</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Playoff Rate</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Champ Rate</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Top-3 PF</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Avg Pts</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Lift vs Baseline</TableHead>
            <TableHead className="font-semibold text-foreground">Confidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={row.strategy}
              className={`transition-colors hover:bg-muted/30 ${highlightFirst && i === 0 ? "bg-accent/5 border-l-2 border-l-accent" : ""}`}
              data-testid={`strategy-row-${i}`}
            >
              <TableCell className="font-medium text-foreground">
                {row.strategy}
                {row.sample_size < 25 && (
                  <span className="ml-2 text-xs text-muted-foreground italic">
                    Low sample — directional only
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-sm">
                {row.sample_size.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-semibold">{pct(row.playoff_rate)}</TableCell>
              <TableCell className="text-right">{pct(row.championship_rate)}</TableCell>
              <TableCell className="text-right">{pct(row.top_3_pf_rate)}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {row.average_points_for?.toFixed(1) ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                <LiftCell lift={row.playoff_rate_lift ?? 0} />
              </TableCell>
              <TableCell>
                <ConfidenceBadge level={row.confidence_level} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
