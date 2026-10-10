import { useState, useMemo, Fragment } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Eye, EyeOff } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getTrustTier } from "@/lib/trustScore";
import { wilson95, fmtCiRange } from "@/lib/stats";

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

interface ScoredRow extends StrategyRow {
  safety_score: number;
  upside_score: number;
}

interface Props {
  rows: StrategyRow[];
  highlightFirst?: boolean;
  qbFormat?: "one_qb" | "superflex";
  minSample?: number;
  initialSortDir?: SortDir;
  title?: string;
  /** Show the championship ("Title %") column — used by the Overall Strategies tables. */
  showTitleRate?: boolean;
}

type SortKey = keyof ScoredRow;
type SortDir = "asc" | "desc";

function computeScores(rows: StrategyRow[]): ScoredRow[] {
  if (!rows.length) return [];

  const prs = rows.map((r) => r.playoff_rate);
  const minPR = Math.min(...prs);
  const maxPR = Math.max(...prs);

  const ups = rows.map((r) => r.championship_rate * 0.6 + r.top_3_pf_rate * 0.4);
  const minUP = Math.min(...ups);
  const maxUP = Math.max(...ups);

  const norm = (v: number, lo: number, hi: number) =>
    hi === lo ? 50 : Math.round(((v - lo) / (hi - lo)) * 100);

  return rows.map((r) => ({
    ...r,
    safety_score: norm(r.playoff_rate, minPR, maxPR),
    upside_score: norm(r.championship_rate * 0.6 + r.top_3_pf_rate * 0.4, minUP, maxUP),
  }));
}

function sortRows(rows: ScoredRow[], key: SortKey, dir: SortDir): ScoredRow[] {
  return [...rows].sort((a, b) => {
    const av = a[key] as string | number;
    const bv = b[key] as string | number;
    if (typeof av === "string" && typeof bv === "string") {
      return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return dir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });
}

function ScoreBadge({ score, type }: { score: number; type: "safety" | "upside" }) {
  const isSafety = type === "safety";

  let label: string;
  let cls: string;

  if (score >= 75) {
    label = isSafety ? "High Floor" : "High Ceiling";
    cls = isSafety
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-violet-50 text-violet-700 border-violet-200";
  } else if (score >= 50) {
    label = isSafety ? "Solid" : "Good";
    cls = isSafety
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : "bg-indigo-50 text-indigo-600 border-indigo-200";
  } else if (score >= 25) {
    label = "Average";
    cls = "bg-slate-50 text-slate-500 border-slate-200";
  } else {
    label = isSafety ? "Low" : "Limited";
    cls = "bg-amber-50 text-amber-600 border-amber-200";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
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

// Human-readable summary shown when a row is expanded — mirrors the
// "What Worked / What Didn't" detail style.
function buildRowExplanation(row: StrategyRow): string {
  const lift = row.playoff_rate_lift ?? 0;
  const baseline = row.playoff_rate * 100 - lift;
  const dir = lift >= 0 ? "above" : "below";
  const prCi = wilson95(row.playoff_rate, row.sample_size);
  const parts: string[] = [
    `In this sample, ${row.strategy} teams made the playoffs at a ${pct(row.playoff_rate)} rate — ${Math.abs(lift).toFixed(1)} percentage points ${dir} the overall baseline of ${baseline.toFixed(1)}%.`,
  ];
  if (prCi) {
    parts.push(`95% confidence interval: ${fmtCiRange(prCi)} (n=${row.sample_size.toLocaleString()}).`);
  }
  if (row.top_3_pf_rate != null) {
    parts.push(`Teams using this build also finished in the top 3 for points scored ${pct(row.top_3_pf_rate)} of the time.`);
  }
  parts.push(`Championship rate (a secondary, higher-variance result): ${pct(row.championship_rate)}.`);
  parts.push(`Confidence: ${row.confidence_level ?? getTrustTier(row.sample_size).label}.`);
  return parts.join(" ");
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey)
    return <ChevronsUpDown className="h-3.5 w-3.5 text-white/40 inline ml-1" />;
  return sortDir === "asc" ? (
    <ChevronUp className="h-3.5 w-3.5 text-[#d4af37] inline ml-1" />
  ) : (
    <ChevronDown className="h-3.5 w-3.5 text-[#d4af37] inline ml-1" />
  );
}

type ColDef = {
  key: SortKey;
  label: string;
  align?: "right" | "left";
  tooltip?: string;
  hideOnMobile?: boolean;
};

function buildColumns(showTitleRate: boolean): ColDef[] {
  return [
    { key: "strategy", label: "Strategy", align: "left" },
    { key: "playoff_rate", label: "Playoff Rate", align: "right" },
    { key: "top_3_pf_rate", label: "Top 3 PF %", align: "right", hideOnMobile: true },
    ...(showTitleRate
      ? ([
          {
            key: "championship_rate",
            label: "Title %",
            align: "right",
            tooltip: "Share of teams using this build that won the league title (secondary, higher-variance result).",
          },
        ] as ColDef[])
      : []),
    {
      key: "playoff_rate_lift",
      label: "vs Average",
      align: "right",
      tooltip: "Percentage-point difference in playoff rate vs. the overall baseline for this format.",
    },
    { key: "sample_size", label: "Sample", align: "right", hideOnMobile: true },
  ];
}

export function StrategyTable({ rows, highlightFirst, minSample, initialSortDir = "desc", title, showTitleRate = false }: Props) {
  const columns = useMemo(() => buildColumns(showTitleRate), [showTitleRate]);
  const [sortKey, setSortKey] = useState<SortKey>("playoff_rate_lift");
  const [sortDir, setSortDir] = useState<SortDir>(initialSortDir);
  const [showLowSample, setShowLowSample] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleRow(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!rows || rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No data available. Run the pipeline to populate analysis.
      </p>
    );
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "strategy" ? "asc" : "desc");
    }
  }

  const threshold = minSample ?? 0;
  const visibleRows = threshold > 0 && !showLowSample ? rows.filter((r) => r.sample_size >= threshold) : rows;
  const hiddenCount = threshold > 0 ? rows.filter((r) => r.sample_size < threshold).length : 0;

  // Scores are computed relative to the currently visible rows so each table
  // is self-calibrating — the best row in view always gets "High", worst gets "Low".
  const scored = useMemo(() => computeScores(visibleRows), [visibleRows]);
  const sorted = useMemo(() => sortRows(scored, sortKey, sortDir), [scored, sortKey, sortDir]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-2">
        {(title || threshold > 0) && (
          <div className="flex items-start justify-between gap-3">
            {title ? (
              <div>
                <h3 className="text-sm font-bold text-foreground">{title}</h3>
                <div className="mt-1 h-0.5 w-[30px] rounded-full bg-[#C9A227]" />
              </div>
            ) : (
              <span />
            )}
            {threshold > 0 && hiddenCount > 0 && (
              <button
                onClick={() => setShowLowSample((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1 transition-colors hover:bg-muted/40"
              >
                {showLowSample ? (
                  <>
                    <EyeOff className="h-3 w-3" /> Hide low-sample data
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3" /> Show {hiddenCount} low-sample directional build
                    {hiddenCount !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            )}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border-2 border-border text-xs sm:text-sm [&_td]:px-1.5 [&_td]:py-px [&_th]:px-1.5 [&_th]:h-7 [&_td_span.rounded-full]:py-0 sm:[&_td]:px-2 sm:[&_td]:py-px sm:[&_th]:px-2">
          <Table className="text-xs sm:text-sm">
            <TableHeader>
              <TableRow className="bg-[#0B1F3A] hover:bg-[#0B1F3A] border-b-0">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={`font-semibold cursor-pointer select-none hover:bg-white/10 transition-colors whitespace-normal sm:whitespace-nowrap ${col.key === sortKey ? "text-[#d4af37]" : "text-white"} ${col.align === "right" ? "text-right" : ""} ${col.hideOnMobile ? "hidden sm:table-cell" : ""}`}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row, i) => {
                const isOpen = expanded.has(row.strategy);
                return (
                  <Fragment key={row.strategy}>
                    <TableRow
                      className="transition-colors hover:bg-muted/30 cursor-pointer"
                      data-testid={`strategy-row-${i}`}
                      onClick={() => toggleRow(row.strategy)}
                    >
                      <TableCell className="font-medium text-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          {row.strategy}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{pct(row.playoff_rate)}</TableCell>
                      <TableCell className="text-right text-muted-foreground hidden sm:table-cell">
                        {row.top_3_pf_rate != null ? `${(row.top_3_pf_rate * 100).toFixed(1)}%` : "—"}
                      </TableCell>
                      {showTitleRate && (
                        <TableCell className="text-right text-muted-foreground">
                          {row.championship_rate != null ? pct(row.championship_rate) : "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <LiftCell lift={row.playoff_rate_lift ?? 0} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm hidden sm:table-cell">
                        {row.sample_size.toLocaleString()}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={columns.length}>
                          <div className="px-1 py-3 pl-6">
                            <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>Playoff 95% CI <span className="font-semibold text-foreground tabular-nums">{fmtCiRange(wilson95(row.playoff_rate, row.sample_size))}</span></span>
                              <span>Top 3 PF <span className="font-semibold text-foreground">{row.top_3_pf_rate != null ? pct(row.top_3_pf_rate) : "—"}</span></span>
                              <span>Champ <span className="text-[10px] uppercase tracking-wide opacity-70">(secondary)</span> <span className="font-semibold text-foreground">{pct(row.championship_rate)}</span></span>
                              <span>Sample <span className="font-semibold text-foreground">{row.sample_size.toLocaleString()}</span></span>
                              <span>Confidence <span className="font-semibold text-foreground">{row.confidence_level ?? getTrustTier(row.sample_size).label}</span></span>
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">{buildRowExplanation(row)}</p>
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

      </div>
    </TooltipProvider>
  );
}
