import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RoundPositionCompare {
  position: string;
  sample_2021?: number;
  sample_2022?: number;
  sample_2023?: number;
  sample_2024: number;
  sample_2025: number;
  playoff_rate_2021?: number;
  playoff_rate_2022?: number;
  playoff_rate_2023?: number;
  playoff_rate_2024: number;
  playoff_rate_2025: number;
  playoff_rate_change_pp: number;
  comparison_quality: string;
  trend_label: string;
}

interface RoundCompare {
  round: number;
  positions: RoundPositionCompare[];
}

interface Props {
  rounds?: RoundCompare[];
  title?: string;
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function calcVolatility(pos: RoundPositionCompare, has2021: boolean, has2022: boolean, has2023: boolean): number {
  const rates: number[] = [];
  if (has2021 && pos.playoff_rate_2021 != null && (pos.sample_2021 ?? 0) > 0) rates.push(pos.playoff_rate_2021);
  if (has2022 && pos.playoff_rate_2022 != null && (pos.sample_2022 ?? 0) > 0) rates.push(pos.playoff_rate_2022);
  if (has2023 && pos.playoff_rate_2023 != null && (pos.sample_2023 ?? 0) > 0) rates.push(pos.playoff_rate_2023);
  rates.push(pos.playoff_rate_2024, pos.playoff_rate_2025);
  const mean = rates.reduce((a, v) => a + v, 0) / rates.length;
  const variance = rates.reduce((a, v) => a + (v - mean) ** 2, 0) / rates.length;
  return Math.sqrt(variance) * 100;
}

function VolatilityBadge({ pp }: { pp: number }) {
  let label: string;
  let cls: string;
  if (pp < 2) {
    label = "Low"; cls = "text-green-700";
  } else if (pp < 5) {
    label = "Mid"; cls = "text-amber-700";
  } else {
    label = "High"; cls = "text-red-700";
  }
  return (
    <span className={`text-xs font-medium ${cls}`}>
      {label} <span className="opacity-70">±{pp.toFixed(1)}pp</span>
    </span>
  );
}

function avgPlayoffRate(pos: RoundPositionCompare, has2021: boolean, has2022: boolean, has2023: boolean): number {
  const vals: number[] = [];
  if (has2021 && pos.playoff_rate_2021 != null && (pos.sample_2021 ?? 0) > 0) vals.push(pos.playoff_rate_2021);
  if (has2022 && pos.playoff_rate_2022 != null && (pos.sample_2022 ?? 0) > 0) vals.push(pos.playoff_rate_2022);
  if (has2023 && pos.playoff_rate_2023 != null && (pos.sample_2023 ?? 0) > 0) vals.push(pos.playoff_rate_2023);
  vals.push(pos.playoff_rate_2024, pos.playoff_rate_2025);
  return vals.reduce((a, v) => a + v, 0) / vals.length;
}

export function CompareRoundValueTable({ rounds, title }: Props) {
  const [selectedRound, setSelectedRound] = useState(1);

  if (!rounds || rounds.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No round value comparison data.</p>;
  }

  const roundData = rounds.find((r) => r.round === selectedRound);
  const positions = roundData?.positions ?? [];
  const has2021 = positions.some((p) => p.playoff_rate_2021 != null && (p.sample_2021 ?? 0) > 0);
  const has2022 = positions.some((p) => p.playoff_rate_2022 != null && (p.sample_2022 ?? 0) > 0);
  const has2023 = positions.some((p) => p.playoff_rate_2023 != null && (p.sample_2023 ?? 0) > 0);
  const qualifying = positions.filter((p) => Math.min(p.sample_2024, p.sample_2025) >= 50);

  const earlyYearsLabel = [
    has2021 && "2021",
    has2022 && "2022",
    has2023 && "2023",
  ].filter(Boolean).join(", ");
  const allYearsLabel = [earlyYearsLabel, "2024", "2025"].filter(Boolean).join(" and ");

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        {title ? (
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        ) : (
          <span />
        )}
        <Select value={String(selectedRound)} onValueChange={(v) => setSelectedRound(Number(v))}>
          <SelectTrigger className="w-[120px] h-[25px] py-0 text-sm" data-testid="compare-round-select">
            <SelectValue placeholder="Select a round" />
          </SelectTrigger>
          <SelectContent>
            {rounds.map((r) => (
              <SelectItem key={r.round} value={String(r.round)}>
                Round {r.round}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {title && <div className="mt-1 mb-3 h-0.5 w-[30px] rounded-full bg-[#C9A227]" />}

      <div className="space-y-4">
      {qualifying.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Insufficient sample for Round {selectedRound} position comparison.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border-2 border-border text-xs sm:text-sm [&_td]:px-1.5 [&_td]:py-px [&_th]:px-1.5 [&_th]:h-7 [&_td_span.rounded-full]:py-0 sm:[&_td]:px-2 sm:[&_td]:py-px sm:[&_th]:px-2">
          <Table className="text-xs sm:text-sm">
            <TableHeader>
              <TableRow className="bg-[#0B1F3A] hover:bg-[#0B1F3A] border-b-0">
                <TableHead className="font-semibold text-xs sm:text-sm text-white">Position</TableHead>
                {has2021 && (
                  <TableHead className="font-semibold text-xs sm:text-sm text-right text-white">2021</TableHead>
                )}
                {has2022 && (
                  <TableHead className="font-semibold text-xs sm:text-sm text-right text-white">2022</TableHead>
                )}
                {has2023 && (
                  <TableHead className="font-semibold text-xs sm:text-sm text-right text-white">2023</TableHead>
                )}
                <TableHead className="font-semibold text-xs sm:text-sm text-right text-white">2024</TableHead>
                <TableHead className="font-semibold text-xs sm:text-sm text-right text-white">2025</TableHead>
                <TableHead className="font-semibold text-xs sm:text-sm text-right text-white">Avg</TableHead>
                <TableHead className="font-semibold text-xs sm:text-sm text-right text-white">Volatility</TableHead>
                {has2021 && (
                  <TableHead className="font-semibold text-xs sm:text-sm text-right text-white">n (2021)</TableHead>
                )}
                {has2022 && (
                  <TableHead className="font-semibold text-xs sm:text-sm text-right text-white">n (2022)</TableHead>
                )}
                {has2023 && (
                  <TableHead className="font-semibold text-xs sm:text-sm text-right text-white">n (2023)</TableHead>
                )}
                <TableHead className="font-semibold text-xs sm:text-sm text-right text-white">n (2024)</TableHead>
                <TableHead className="font-semibold text-xs sm:text-sm text-right text-white">n (2025)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...qualifying]
                .sort((a, b) => b.playoff_rate_2025 - a.playoff_rate_2025)
                .map((pos, i) => (
                  <TableRow
                    key={pos.position}
                    className={`hover:bg-muted/30 transition-colors ${i === 0 ? "bg-accent/5 border-l-2 border-l-accent" : ""}`}
                  >
                    <TableCell className="font-medium text-foreground">
                      {pos.position}
                    </TableCell>
                    {has2021 && (
                      <TableCell className="text-right text-muted-foreground">
                        {pos.playoff_rate_2021 != null ? pct(pos.playoff_rate_2021) : "—"}
                      </TableCell>
                    )}
                    {has2022 && (
                      <TableCell className="text-right text-muted-foreground">
                        {pos.playoff_rate_2022 != null ? pct(pos.playoff_rate_2022) : "—"}
                      </TableCell>
                    )}
                    {has2023 && (
                      <TableCell className="text-right text-muted-foreground">
                        {pos.playoff_rate_2023 != null ? pct(pos.playoff_rate_2023) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right text-muted-foreground">
                      {pct(pos.playoff_rate_2024)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {pct(pos.playoff_rate_2025)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">
                      {pct(avgPlayoffRate(pos, has2021, has2022, has2023))}
                    </TableCell>
                    <TableCell className="text-right">
                      <VolatilityBadge pp={calcVolatility(pos, has2021, has2022, has2023)} />
                    </TableCell>
                    {has2021 && (
                      <TableCell className="text-right text-muted-foreground">
                        {(pos.sample_2021 ?? 0).toLocaleString()}
                      </TableCell>
                    )}
                    {has2022 && (
                      <TableCell className="text-right text-muted-foreground">
                        {(pos.sample_2022 ?? 0).toLocaleString()}
                      </TableCell>
                    )}
                    {has2023 && (
                      <TableCell className="text-right text-muted-foreground">
                        {(pos.sample_2023 ?? 0).toLocaleString()}
                      </TableCell>
                    )}
                    <TableCell className="text-right text-muted-foreground">
                      {pos.sample_2024.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {pos.sample_2025.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground px-1">
        Positions with fewer than 50 teams in either 2024 or 2025 are excluded. Volatility = standard deviation across {allYearsLabel || "2024 and 2025"}.
      </p>
      </div>
    </div>
  );
}
