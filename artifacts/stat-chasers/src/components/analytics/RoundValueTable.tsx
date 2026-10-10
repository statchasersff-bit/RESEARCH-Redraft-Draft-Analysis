import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, Fragment } from "react";
import { ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MIN_SAMPLE = 250;

interface PositionMetric {
  strategy: string;
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
  title?: string;
}

function pct(val: number) {
  return `${(val * 100).toFixed(1)}%`;
}

function Delta({ val, unit }: { val: number; unit: "pp" | "pts" }) {
  if (val === 0) return <span className="text-muted-foreground">—</span>;
  const isPos = val > 0;
  const formatted =
    unit === "pp"
      ? `${isPos ? "+" : ""}${(val * 100).toFixed(1)}pp`
      : `${isPos ? "+" : ""}${Math.round(val)}`;
  return (
    <span className={`font-semibold text-sm ${isPos ? "text-green-600" : "text-red-500"}`}>
      {formatted}
    </span>
  );
}


function buildRowExplanation(pos: PositionMetric, round: number): string {
  const parts: string[] = [
    `In Round ${round}, drafting a ${pos.strategy} led to a ${pct(pos.playoff_rate)} playoff rate across ${pos.sample_size.toLocaleString()} teams.`,
    `Championship rate: ${pct(pos.championship_rate)}.`,
  ];
  if (pos.top_3_pf_rate != null) {
    parts.push(`Top-3 points finish: ${pct(pos.top_3_pf_rate)}.`);
  }
  if (pos.average_points_for != null) {
    parts.push(`Average points scored: ${Math.round(pos.average_points_for).toLocaleString()}.`);
  }
  return parts.join(" ");
}

export function RoundValueTable({ rounds, title }: Props) {
  const [selectedRound, setSelectedRound] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleRow(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!rounds || rounds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No round value data available yet.
      </p>
    );
  }

  const roundData = rounds.find((r) => r.round === selectedRound);
  const allPositions = roundData?.positions ?? [];

  const qualifying = allPositions
    .filter((p) => p.sample_size >= MIN_SAMPLE)
    .sort((a, b) => b.playoff_rate - a.playoff_rate);

  const omitted = allPositions
    .filter((p) => p.sample_size > 0 && p.sample_size < MIN_SAMPLE)
    .map((p) => p.strategy);

  const hasData = qualifying.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        {title && (
          <div>
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            <div className="mt-1 h-0.5 w-[30px] rounded-full bg-[#C9A227]" />
          </div>
        )}
        <Select value={String(selectedRound)} onValueChange={(v) => setSelectedRound(Number(v))}>
          <SelectTrigger className="h-7 w-full sm:w-[150px] px-2.5 py-1 text-xs" data-testid="round-select">
            <SelectValue placeholder="Select a round" />
          </SelectTrigger>
          <SelectContent className="text-xs">
            {rounds.map((r) => (
              <SelectItem key={r.round} value={String(r.round)} className="py-1 pr-7 text-xs">
                Rd {r.round}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hasData ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No data for Round {selectedRound} with sufficient sample. Run the pipeline with more leagues to populate this.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border-2 border-border text-xs sm:text-sm [&_td]:px-1.5 [&_td]:py-px [&_th]:px-1.5 [&_th]:h-7 [&_td_span.rounded-full]:py-0 sm:[&_td]:px-2 sm:[&_td]:py-px sm:[&_th]:px-2">
            <Table className="text-xs sm:text-sm">
              <TableHeader>
                <TableRow className="bg-[#0B1F3A] hover:bg-[#0B1F3A] border-b-0">
                  <TableHead className="font-semibold text-white whitespace-normal sm:whitespace-nowrap">Position</TableHead>
                  <TableHead className="font-semibold text-white text-right hidden sm:table-cell whitespace-normal sm:whitespace-nowrap">Sample</TableHead>
                  <TableHead className="font-semibold text-white text-right whitespace-normal sm:whitespace-nowrap">Playoff Rate</TableHead>
                  <TableHead className="font-semibold text-white text-right whitespace-normal sm:whitespace-nowrap">Champ Rate</TableHead>
                  <TableHead className="font-semibold text-white text-right hidden sm:table-cell whitespace-normal sm:whitespace-nowrap">Top-3 PF Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qualifying.map((pos, i) => {
                  const rowKey = `${selectedRound}-${pos.strategy}`;
                  const isOpen = expanded.has(rowKey);
                  return (
                    <Fragment key={rowKey}>
                      <TableRow
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        data-testid={`round-row-${i}`}
                        onClick={() => toggleRow(rowKey)}
                      >
                        <TableCell className="font-medium text-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            {pos.strategy}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm hidden sm:table-cell">
                          {pos.sample_size.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {pct(pos.playoff_rate)}
                        </TableCell>
                        <TableCell className="text-right">{pct(pos.championship_rate)}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          {pos.top_3_pf_rate != null ? pct(pos.top_3_pf_rate) : "—"}
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={5}>
                            <div className="px-1 py-3 pl-6">
                              <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>Playoff Rate <span className="font-semibold text-foreground">{pct(pos.playoff_rate)}</span></span>
                                <span>Champ <span className="font-semibold text-foreground">{pct(pos.championship_rate)}</span></span>
                                <span>Top-3 PF <span className="font-semibold text-foreground">{pos.top_3_pf_rate != null ? pct(pos.top_3_pf_rate) : "—"}</span></span>
                                <span>Sample <span className="font-semibold text-foreground">{pos.sample_size.toLocaleString()}</span></span>
                              </div>
                              <p className="text-xs leading-relaxed text-muted-foreground">{buildRowExplanation(pos, selectedRound)}</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {omitted.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{omitted.join(", ")}</span> hidden: sample too small (n &lt; {MIN_SAMPLE}) to draw reliable conclusions.
            </p>
          )}
        </>
      )}
    </div>
  );
}
