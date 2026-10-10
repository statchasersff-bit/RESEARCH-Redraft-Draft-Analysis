import { useState, Fragment } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrustBadge, getTrustTier } from "@/lib/trustScore";

interface MissRiskEntry {
  strategy_name: string;
  format_context: string;
  sample_size: number;
  probability_of_missing_playoffs: number;
  relative_risk_vs_baseline: number;
  percentile_rank: number;
  confidence_level: string;
}

interface MissRiskData {
  baseline_miss_rate: number;
  entries: MissRiskEntry[];
}

type SortKey =
  | "strategy_name"
  | "probability_of_missing_playoffs"
  | "vs_baseline"
  | "relative_risk_vs_baseline"
  | "percentile_rank"
  | "sample_size"
  | "confidence_level";

type SortDir = "asc" | "desc";

function pct(val: number) {
  return `${(val * 100).toFixed(1)}%`;
}

// Human-readable summary shown when a miss-risk row is expanded.
function buildRowExplanation(entry: MissRiskEntry, baseline: number): string {
  const lift = (entry.probability_of_missing_playoffs - baseline) * 100;
  const dir = lift >= 0 ? "above" : "below";
  const risk = lift > 0 ? "riskier than average" : "safer than average";
  const parts: string[] = [
    `In this sample, ${entry.strategy_name} teams missed the playoffs at a ${pct(entry.probability_of_missing_playoffs)} rate — ${Math.abs(lift).toFixed(1)} percentage points ${dir} the league-average miss rate of ${pct(baseline)}.`,
    `That makes this build ${risk}.`,
    `Sample size: ${entry.sample_size.toLocaleString()}.`,
    `Confidence: ${entry.confidence_level ?? getTrustTier(entry.sample_size).label}.`,
  ];
  return parts.join(" ");
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3.5 w-3.5 text-white/40 inline ml-1" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 text-[#d4af37] inline ml-1" />
    : <ChevronDown className="h-3.5 w-3.5 text-[#d4af37] inline ml-1" />;
}

interface Props {
  data?: MissRiskData;
  isLoading?: boolean;
}

export function MissRiskTable({ data, isLoading }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("probability_of_missing_playoffs");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleRow(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 bg-muted rounded" />
        ))}
      </div>
    );
  }

  if (!data?.entries?.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No miss risk data available yet.
      </p>
    );
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "strategy_name" ? "asc" : "desc");
    }
  }

  const baseline = data.baseline_miss_rate ?? 0;

  const sorted = [...data.entries].sort((a, b) => {
    let av: number;
    let bv: number;
    if (sortKey === "strategy_name") {
      return sortDir === "asc"
        ? a.strategy_name.localeCompare(b.strategy_name)
        : b.strategy_name.localeCompare(a.strategy_name);
    }
    if (sortKey === "vs_baseline") {
      av = a.probability_of_missing_playoffs - baseline;
      bv = b.probability_of_missing_playoffs - baseline;
    } else if (sortKey === "confidence_level") {
      av = getTrustTier(a.sample_size).rank;
      bv = getTrustTier(b.sample_size).rank;
    } else {
      av = a[sortKey] as number;
      bv = b[sortKey] as number;
    }
    return sortDir === "asc" ? av - bv : bv - av;
  });

  type ColDef = { key: SortKey; label: string; align?: "right" | "left"; hideOnMobile?: boolean };
  const COLUMNS: ColDef[] = [
    { key: "strategy_name", label: "Strategy", align: "left" },
    { key: "probability_of_missing_playoffs", label: "Miss Rate", align: "right" },
    { key: "vs_baseline", label: "vs Avg", align: "right" },
    { key: "sample_size", label: "Sample", align: "right", hideOnMobile: true },
    { key: "confidence_level", label: "Trust Score", align: "left" },
  ];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border-2 border-border text-xs sm:text-sm [&_td]:px-1.5 [&_td]:py-px [&_th]:px-1.5 [&_th]:h-7 [&_td_span.rounded-full]:py-0 sm:[&_td]:px-2 sm:[&_td]:py-px sm:[&_th]:px-2">
        <Table className="text-xs sm:text-sm">
          <TableHeader>
            <TableRow className="bg-[#0B1F3A] hover:bg-[#0B1F3A] border-b-0">
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  className={`font-semibold cursor-pointer select-none hover:bg-white/10 transition-colors whitespace-normal sm:whitespace-nowrap ${col.key === sortKey ? "text-[#d4af37]" : "text-white"} ${col.align === "right" ? "text-right" : ""} ${col.hideOnMobile ? "hidden sm:table-cell" : ""}`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((entry, i) => {
              const liftVsBaseline = entry.probability_of_missing_playoffs - baseline;
              const isRisky = liftVsBaseline > 0.05;
              const rowKey = `${entry.strategy_name}-${i}`;
              const isOpen = expanded.has(rowKey);
              return (
                <Fragment key={rowKey}>
                  <TableRow
                    className={`hover:bg-muted/30 transition-colors cursor-pointer ${isRisky ? "bg-red-50/20" : ""}`}
                    data-testid={`miss-risk-row-${i}`}
                    onClick={() => toggleRow(rowKey)}
                  >
                    <TableCell className="font-medium text-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        {entry.strategy_name}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold ${isRisky ? "text-red-600" : "text-foreground"}`}>
                        {pct(entry.probability_of_missing_playoffs)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold ${liftVsBaseline > 0 ? "text-red-500" : "text-green-600"}`}>
                        {liftVsBaseline > 0 ? "+" : ""}{(liftVsBaseline * 100).toFixed(1)}pp
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm hidden sm:table-cell">
                      {entry.sample_size.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <TrustBadge sampleSize={entry.sample_size} />
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={COLUMNS.length}>
                        <div className="px-1 py-3 pl-6">
                          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>Miss Rate <span className="font-semibold text-foreground">{pct(entry.probability_of_missing_playoffs)}</span></span>
                            <span>vs Avg <span className="font-semibold text-foreground">{liftVsBaseline > 0 ? "+" : ""}{(liftVsBaseline * 100).toFixed(1)}pp</span></span>
                            <span>Sample <span className="font-semibold text-foreground">{entry.sample_size.toLocaleString()}</span></span>
                            <span>Confidence <span className="font-semibold text-foreground">{entry.confidence_level ?? getTrustTier(entry.sample_size).label}</span></span>
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground">{buildRowExplanation(entry, baseline)}</p>
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
      <p className="text-xs text-muted-foreground px-1">
        pp = percentage points relative to the league-average miss playoff rate.
      </p>
    </div>
  );
}
