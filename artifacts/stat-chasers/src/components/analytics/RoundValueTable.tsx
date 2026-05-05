import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";

interface PositionMetric {
  position: string;
  sample_size: number;
  average_points_for?: number;
  playoff_rate: number;
  championship_rate: number;
  top_3_pf_rate?: number;
}

interface RoundData {
  round: number;
  positions: PositionMetric[];
}

interface Props {
  rounds?: RoundData[];
}

const POSITION_COLORS: Record<string, string> = {
  RB: "text-blue-700 bg-blue-50 border-blue-200",
  WR: "text-green-700 bg-green-50 border-green-200",
  QB: "text-red-700 bg-red-50 border-red-200",
  TE: "text-purple-700 bg-purple-50 border-purple-200",
  K: "text-gray-600 bg-gray-50 border-gray-200",
  DEF: "text-orange-700 bg-orange-50 border-orange-200",
};

function pct(val: number) {
  return `${(val * 100).toFixed(1)}%`;
}

export function RoundValueTable({ rounds }: Props) {
  const [selectedRound, setSelectedRound] = useState(1);

  if (!rounds || rounds.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No round value data available yet.</p>;
  }

  const roundData = rounds.find((r) => r.round === selectedRound);
  const hasData = roundData?.positions?.some((p) => p.sample_size > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {rounds.map((r) => (
          <button
            key={r.round}
            onClick={() => setSelectedRound(r.round)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              selectedRound === r.round
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            }`}
            data-testid={`round-btn-${r.round}`}
          >
            Rd {r.round}
          </button>
        ))}
      </div>

      {!hasData ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No data for Round {selectedRound} — run the pipeline with more leagues to populate this.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold">Position</TableHead>
                <TableHead className="font-semibold text-right">Sample</TableHead>
                <TableHead className="font-semibold text-right">Playoff Rate</TableHead>
                <TableHead className="font-semibold text-right">Champ Rate</TableHead>
                <TableHead className="font-semibold text-right">Top-3 PF Rate</TableHead>
                <TableHead className="font-semibold text-right">Avg Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roundData?.positions
                ?.filter((p) => p.sample_size > 0)
                .sort((a, b) => b.playoff_rate - a.playoff_rate)
                .map((pos, i) => (
                  <TableRow
                    key={pos.position}
                    className="hover:bg-muted/30 transition-colors"
                    data-testid={`round-row-${i}`}
                  >
                    <TableCell>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded border text-xs font-bold ${POSITION_COLORS[pos.position] ?? "text-gray-600 bg-gray-50 border-gray-200"}`}
                      >
                        {pos.position}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {pos.sample_size.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {pct(pos.playoff_rate)}
                    </TableCell>
                    <TableCell className="text-right">{pct(pos.championship_rate)}</TableCell>
                    <TableCell className="text-right">
                      {pos.top_3_pf_rate != null ? pct(pos.top_3_pf_rate) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {pos.average_points_for?.toFixed(1) ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
