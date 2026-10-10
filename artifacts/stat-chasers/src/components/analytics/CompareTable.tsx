import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { aggregate, fmtCiPp, type SeasonPoint, type Weighting } from "@/lib/stats";

export interface CompareStrategyRow {
  strategy: string;
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
  top_3_pf_rate_2021?: number;
  top_3_pf_rate_2022?: number;
  top_3_pf_rate_2023?: number;
  top_3_pf_rate_2024?: number;
  top_3_pf_rate_2025?: number;
  top_3_pf_rate_change_pp?: number;
  championship_rate_2021?: number;
  championship_rate_2022?: number;
  championship_rate_2023?: number;
  championship_rate_2024: number;
  championship_rate_2025: number;
  championship_rate_change_pp: number;
  comparison_quality: string;
  trend_label: string;
}

export interface CompareComboRow {
  combo: string;
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
  top_3_pf_rate_2021?: number;
  top_3_pf_rate_2022?: number;
  top_3_pf_rate_2023?: number;
  top_3_pf_rate_2024?: number;
  top_3_pf_rate_2025?: number;
  top_3_pf_rate_change_pp?: number;
  championship_rate_2021?: number;
  championship_rate_2022?: number;
  championship_rate_2023?: number;
  championship_rate_2024: number;
  championship_rate_2025: number;
  championship_rate_change_pp: number;
  comparison_quality: string;
  trend_label: string;
}

type SortKey =
  | "name"
  | "rate_2021"
  | "rate_2022"
  | "rate_2023"
  | "rate_2024"
  | "rate_2025"
  | "avg_rate"
  | "sample"
  | "volatility";
type SortDir = "asc" | "desc";

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

type Row = CompareStrategyRow | CompareComboRow;

function getR21(r: Row, mode: "playoff" | "pf"): number | undefined {
  return mode === "playoff" ? r.playoff_rate_2021 : r.top_3_pf_rate_2021;
}
function getR22(r: Row, mode: "playoff" | "pf"): number | undefined {
  return mode === "playoff" ? r.playoff_rate_2022 : r.top_3_pf_rate_2022;
}
function getR23(r: Row, mode: "playoff" | "pf"): number | undefined {
  return mode === "playoff" ? r.playoff_rate_2023 : r.top_3_pf_rate_2023;
}
function getR24(r: Row, mode: "playoff" | "pf"): number {
  return mode === "playoff" ? r.playoff_rate_2024 : (r.top_3_pf_rate_2024 ?? 0);
}
function getR25(r: Row, mode: "playoff" | "pf"): number {
  return mode === "playoff" ? r.playoff_rate_2025 : (r.top_3_pf_rate_2025 ?? 0);
}

// Per-season (rate, n) points for a row, restricted to the seasons the table
// is currently showing. Feeds the pooled / season-balanced aggregation and CIs.
function seasonPoints(
  r: Row,
  mode: "playoff" | "pf",
  has2021: boolean,
  has2022: boolean,
  has2023: boolean,
): SeasonPoint[] {
  const pts: SeasonPoint[] = [];
  if (has2021) pts.push({ rate: getR21(r, mode), n: r.sample_2021 });
  if (has2022) pts.push({ rate: getR22(r, mode), n: r.sample_2022 });
  if (has2023) pts.push({ rate: getR23(r, mode), n: r.sample_2023 });
  pts.push({ rate: getR24(r, mode), n: r.sample_2024 });
  pts.push({ rate: getR25(r, mode), n: r.sample_2025 });
  return pts;
}

function avgAgg(
  r: Row,
  mode: "playoff" | "pf",
  weighting: Weighting,
  has2021: boolean,
  has2022: boolean,
  has2023: boolean,
) {
  return aggregate(seasonPoints(r, mode, has2021, has2022, has2023), weighting);
}

function calcVolatility(r: Row, mode: "playoff" | "pf", has2021: boolean, has2022: boolean, has2023: boolean): number {
  const rates: number[] = [];
  const r21 = getR21(r, mode);
  if (has2021 && r21 != null && (r.sample_2021 ?? 0) > 0) rates.push(r21);
  const r22 = getR22(r, mode);
  if (has2022 && r22 != null && (r.sample_2022 ?? 0) > 0) rates.push(r22);
  const r23 = getR23(r, mode);
  if (has2023 && r23 != null && (r.sample_2023 ?? 0) > 0) rates.push(r23);
  rates.push(getR24(r, mode), getR25(r, mode));
  const mean = rates.reduce((a, v) => a + v, 0) / rates.length;
  const variance = rates.reduce((a, v) => a + (v - mean) ** 2, 0) / rates.length;
  return Math.sqrt(variance) * 100;
}

function VolatilityBadge({ pp }: { pp: number }) {
  let label: string;
  let cls: string;
  if (pp < 2) {
    label = "Low";
    cls = "text-green-700";
  } else if (pp < 5) {
    label = "Mid";
    cls = "text-amber-700";
  } else {
    label = "High";
    cls = "text-red-700";
  }
  return (
    <span className={`text-xs font-medium ${cls}`}>
      {label} <span className="opacity-70">±{pp.toFixed(1)}pp</span>
    </span>
  );
}

function WeightingToggle({
  weighting,
  onChange,
}: {
  weighting: Weighting;
  onChange: (w: Weighting) => void;
}) {
  return (
    <div className="flex shrink-0 rounded-md border border-border overflow-hidden text-xs font-medium">
      <button
        onClick={() => onChange("pooled")}
        className={`px-3 py-1.5 transition-colors ${
          weighting === "pooled"
            ? "bg-[#0B1F3A] text-white"
            : "bg-background text-muted-foreground hover:bg-muted"
        }`}
      >
        Pooled
      </button>
      <button
        onClick={() => onChange("balanced")}
        className={`px-3 py-1.5 transition-colors border-l border-border ${
          weighting === "balanced"
            ? "bg-[#0B1F3A] text-white"
            : "bg-background text-muted-foreground hover:bg-muted"
        }`}
      >
        Season-balanced
      </button>
    </div>
  );
}

interface Props {
  rows: Row[];
  nameKey?: "strategy" | "combo";
  minSample?: number;
  mode?: "playoff" | "pf";
}

export function CompareTable({ rows, nameKey = "strategy", minSample = 10, mode = "playoff" }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("avg_rate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  // Pooled = every team equal weight; Balanced = every season equal weight.
  const [weighting, setWeighting] = useState<Weighting>("pooled");

  if (!rows || rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No comparison data available.
      </p>
    );
  }

  const has2021 = rows.some((r) => {
    const r21 = getR21(r, mode);
    return r21 != null && (r.sample_2021 ?? 0) > 0;
  });
  const has2022 = rows.some((r) => {
    const r22 = getR22(r, mode);
    return r22 != null && (r.sample_2022 ?? 0) > 0;
  });
  const has2023 = rows.some((r) => {
    const r23 = getR23(r, mode);
    return r23 != null && (r.sample_2023 ?? 0) > 0;
  });

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "volatility" ? "asc" : "desc");
    }
  }

  const getName = (r: Row) =>
    nameKey === "strategy"
      ? (r as CompareStrategyRow).strategy
      : (r as CompareComboRow).combo;

  const filtered = minSample > 0
    ? rows.filter((r) => Math.min(r.sample_2024, r.sample_2025) >= minSample)
    : rows;

  const sorted = [...filtered].sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    switch (sortKey) {
      case "name":       av = getName(a); bv = getName(b); break;
      case "rate_2021":  av = getR21(a, mode) ?? 0; bv = getR21(b, mode) ?? 0; break;
      case "rate_2022":  av = getR22(a, mode) ?? 0; bv = getR22(b, mode) ?? 0; break;
      case "rate_2023":  av = getR23(a, mode) ?? 0; bv = getR23(b, mode) ?? 0; break;
      case "rate_2024":  av = getR24(a, mode); bv = getR24(b, mode); break;
      case "rate_2025":  av = getR25(a, mode); bv = getR25(b, mode); break;
      case "avg_rate":   av = avgAgg(a, mode, weighting, has2021, has2022, has2023).rate; bv = avgAgg(b, mode, weighting, has2021, has2022, has2023).rate; break;
      case "sample":     av = avgAgg(a, mode, weighting, has2021, has2022, has2023).n; bv = avgAgg(b, mode, weighting, has2021, has2022, has2023).n; break;
      case "volatility": av = calcVolatility(a, mode, has2021, has2022, has2023); bv = calcVolatility(b, mode, has2021, has2022, has2023); break;
      default: av = 0; bv = 0;
    }
    if (typeof av === "string") {
      return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    }
    return sortDir === "asc" ? av - (bv as number) : (bv as number) - av;
  });

  const metricLabel = mode === "playoff" ? "Playoff %" : "Top 3 PF %";
  const avgLabel = weighting === "pooled" ? `Pooled ${metricLabel}` : `Balanced ${metricLabel}`;

  type ColDef = { key: SortKey; label: string; align?: "right" | "left"; hideOnMobile?: boolean; hide?: boolean };
  const COLUMNS: ColDef[] = [
    { key: "name",       label: nameKey === "strategy" ? "Strategy" : "Pick Combo", align: "left" },
    { key: "rate_2021",  label: "2021", align: "right", hide: !has2021 },
    { key: "rate_2022",  label: "2022", align: "right", hide: !has2022 },
    { key: "rate_2023",  label: "2023", align: "right", hide: !has2023 },
    { key: "rate_2024",  label: "2024", align: "right" },
    { key: "rate_2025",  label: "2025", align: "right" },
    { key: "avg_rate",   label: `${avgLabel} (95% CI)`, align: "right" },
    { key: "sample",     label: "Sample", align: "right", hideOnMobile: true },
    { key: "volatility", label: "Volatility",           align: "right" },
  ].filter((c) => !c.hide) as ColDef[];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {weighting === "pooled"
            ? "Pooled: every team counts equally (larger seasons weigh more)."
            : "Season-balanced: every season counts equally (thin seasons weigh the same as large ones)."}{" "}
          Shown with 95% confidence intervals and sample sizes.
        </p>
        <WeightingToggle weighting={weighting} onChange={setWeighting} />
      </div>
    <div className="overflow-x-auto rounded-lg border-2 border-border text-xs sm:text-sm [&_td]:px-1.5 [&_td]:py-px [&_th]:px-1.5 [&_th]:h-7 [&_td_span.rounded-full]:py-0 sm:[&_td]:px-2 sm:[&_td]:py-px sm:[&_th]:px-2">
      <Table className="text-xs sm:text-sm">
        <TableHeader>
          <TableRow className="bg-[#0B1F3A] hover:bg-[#0B1F3A] border-b-0">
            {COLUMNS.map((col) => (
              <TableHead
                key={col.key}
                className={`font-semibold cursor-pointer select-none hover:bg-white/10 transition-colors whitespace-normal sm:whitespace-nowrap text-xs sm:text-sm ${col.key === sortKey ? "text-[#d4af37]" : "text-white"} ${col.align === "right" ? "text-right" : ""} ${col.hideOnMobile ? "hidden sm:table-cell" : ""}`}
                onClick={() => handleSort(col.key)}
              >
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, i) => {
            const vol = calcVolatility(row, mode, has2021, has2022, has2023);
            const sorted_cls = (key: SortKey) =>
              sortKey === key ? "font-bold text-foreground" : "text-muted-foreground";
            const r21 = getR21(row, mode);
            const r22 = getR22(row, mode);
            const r23 = getR23(row, mode);
            const r24 = getR24(row, mode);
            const r25 = getR25(row, mode);
            const agg = avgAgg(row, mode, weighting, has2021, has2022, has2023);
            return (
              <TableRow
                key={i}
                className="hover:bg-muted/30 transition-colors"
                data-testid={`compare-row-${i}`}
              >
                <TableCell className={sorted_cls("name")}>
                  {getName(row)}
                </TableCell>
                {has2021 && (
                  <TableCell className={`text-right ${sorted_cls("rate_2021")}`}>
                    {r21 != null ? pct(r21) : "—"}
                  </TableCell>
                )}
                {has2022 && (
                  <TableCell className={`text-right ${sorted_cls("rate_2022")}`}>
                    {r22 != null ? pct(r22) : "—"}
                  </TableCell>
                )}
                {has2023 && (
                  <TableCell className={`text-right ${sorted_cls("rate_2023")}`}>
                    {r23 != null ? pct(r23) : "—"}
                  </TableCell>
                )}
                <TableCell className={`text-right ${sorted_cls("rate_2024")}`}>
                  {pct(r24)}
                </TableCell>
                <TableCell className={`text-right ${sorted_cls("rate_2025")}`}>
                  {pct(r25)}
                </TableCell>
                <TableCell className={`text-right ${sorted_cls("avg_rate")}`}>
                  <span className="tabular-nums">{pct(agg.rate)}</span>
                  {agg.ci && (
                    <span className="block text-[10px] font-normal text-muted-foreground tabular-nums">
                      {fmtCiPp(agg.ci)}
                    </span>
                  )}
                </TableCell>
                <TableCell className={`text-right tabular-nums hidden sm:table-cell ${sorted_cls("sample")}`}>
                  {agg.n.toLocaleString()}
                </TableCell>
                <TableCell className={`text-right ${sortKey === "volatility" ? "font-bold" : ""}`}>
                  <VolatilityBadge pp={vol} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
    </div>
  );
}
