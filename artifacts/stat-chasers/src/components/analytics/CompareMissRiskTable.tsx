import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Info } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export interface CompareMissRiskRow {
  strategy: string;
  miss_rate_2021?: number;
  miss_rate_2022?: number;
  miss_rate_2023?: number;
  miss_rate_2024: number;
  miss_rate_2025: number;
  miss_rate_change_pp: number;
  sample_2021?: number;
  sample_2022?: number;
  sample_2023?: number;
  sample_2024: number;
  sample_2025: number;
  comparison_quality: string;
  trend_label: string;
}

type SortKey = "strategy" | "avg_miss_rate" | "miss_rate_2021" | "miss_rate_2022" | "miss_rate_2023" | "miss_rate_2024" | "miss_rate_2025" | "volatility";
type SortDir = "asc" | "desc";

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/40 inline ml-1" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3 w-3 text-foreground inline ml-1" />
    : <ChevronDown className="h-3 w-3 text-foreground inline ml-1" />;
}

function avgMissRate(r: CompareMissRiskRow, has2021: boolean, has2022: boolean, has2023: boolean): number {
  const vals: number[] = [];
  if (has2021 && r.miss_rate_2021 != null && (r.sample_2021 ?? 0) > 0) vals.push(r.miss_rate_2021);
  if (has2022 && r.miss_rate_2022 != null && (r.sample_2022 ?? 0) > 0) vals.push(r.miss_rate_2022);
  if (has2023 && r.miss_rate_2023 != null && (r.sample_2023 ?? 0) > 0) vals.push(r.miss_rate_2023);
  vals.push(r.miss_rate_2024, r.miss_rate_2025);
  return vals.reduce((a, v) => a + v, 0) / vals.length;
}

function calcVolatility(r: CompareMissRiskRow, has2021: boolean, has2022: boolean, has2023: boolean): number {
  const rates: number[] = [];
  if (has2021 && r.miss_rate_2021 != null && (r.sample_2021 ?? 0) > 0) rates.push(r.miss_rate_2021);
  if (has2022 && r.miss_rate_2022 != null && (r.sample_2022 ?? 0) > 0) rates.push(r.miss_rate_2022);
  if (has2023 && r.miss_rate_2023 != null && (r.sample_2023 ?? 0) > 0) rates.push(r.miss_rate_2023);
  rates.push(r.miss_rate_2024, r.miss_rate_2025);
  const mean = rates.reduce((a, v) => a + v, 0) / rates.length;
  const variance = rates.reduce((a, v) => a + (v - mean) ** 2, 0) / rates.length;
  return Math.sqrt(variance) * 100;
}

function VolatilityBadge({ pp }: { pp: number }) {
  let label: string;
  let cls: string;
  if (pp < 2) {
    label = "Low"; cls = "bg-green-100 text-green-800 border-green-200";
  } else if (pp < 5) {
    label = "Mid"; cls = "bg-amber-100 text-amber-800 border-amber-200";
  } else {
    label = "High"; cls = "bg-red-100 text-red-800 border-red-200";
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}<span className="opacity-70">±{pp.toFixed(1)}pp</span>
    </span>
  );
}

interface Props {
  rows: CompareMissRiskRow[];
  baselineMissRate2021?: number;
  baselineMissRate2022?: number;
  baselineMissRate2023?: number;
  baselineMissRate2024?: number;
  baselineMissRate2025?: number;
}

export function CompareMissRiskTable({ rows, baselineMissRate2021, baselineMissRate2022, baselineMissRate2023, baselineMissRate2024, baselineMissRate2025 }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("avg_miss_rate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  if (!rows || rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No miss risk comparison data available.</p>;
  }

  const has2021 = rows.some((r) => r.miss_rate_2021 != null && (r.sample_2021 ?? 0) > 0);
  const has2022 = rows.some((r) => r.miss_rate_2022 != null && (r.sample_2022 ?? 0) > 0);
  const has2023 = rows.some((r) => r.miss_rate_2023 != null && (r.sample_2023 ?? 0) > 0);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const qualifying = rows.filter((r) => Math.min(r.sample_2024, r.sample_2025) >= 10);
  const sorted = [...qualifying].sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    switch (sortKey) {
      case "strategy":       av = a.strategy; bv = b.strategy; break;
      case "avg_miss_rate":  av = avgMissRate(a, has2021, has2022, has2023); bv = avgMissRate(b, has2021, has2022, has2023); break;
      case "miss_rate_2021": av = a.miss_rate_2021 ?? 0; bv = b.miss_rate_2021 ?? 0; break;
      case "miss_rate_2022": av = a.miss_rate_2022 ?? 0; bv = b.miss_rate_2022 ?? 0; break;
      case "miss_rate_2023": av = a.miss_rate_2023 ?? 0; bv = b.miss_rate_2023 ?? 0; break;
      case "volatility":     av = calcVolatility(a, has2021, has2022, has2023); bv = calcVolatility(b, has2021, has2022, has2023); break;
      default:               av = (a as any)[sortKey]; bv = (b as any)[sortKey];
    }
    if (typeof av === "string") {
      return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    }
    return sortDir === "asc" ? av - (bv as number) : (bv as number) - av;
  });

  type ColDef = { key: SortKey; label: string; align?: "right" | "left"; hide?: boolean };
  const COLUMNS: ColDef[] = [
    { key: "strategy",       label: "Strategy",      align: "left" },
    { key: "miss_rate_2021", label: "Miss % (2021)", align: "right", hide: !has2021 },
    { key: "miss_rate_2022", label: "Miss % (2022)", align: "right", hide: !has2022 },
    { key: "miss_rate_2023", label: "Miss % (2023)", align: "right", hide: !has2023 },
    { key: "miss_rate_2024", label: "Miss % (2024)", align: "right" },
    { key: "miss_rate_2025", label: "Miss % (2025)", align: "right" },
    { key: "avg_miss_rate",  label: "Avg Miss %",    align: "right" },
    { key: "volatility",     label: "Volatility",    align: "right" },
  ].filter((c) => !c.hide) as ColDef[];

  const sorted_cls = (key: SortKey) =>
    sortKey === key ? "font-bold text-foreground" : "text-muted-foreground";

  const anyBaseline = baselineMissRate2021 != null || baselineMissRate2022 != null || baselineMissRate2023 != null || baselineMissRate2024 != null || baselineMissRate2025 != null;

  const earlyYearsLabel = [
    has2021 && "2021",
    has2022 && "2022",
    has2023 && "2023",
  ].filter(Boolean).join(", ");
  const allYearsLabel = [earlyYearsLabel, "2024", "2025"].filter(Boolean).join(", ");

  return (
    <div className="space-y-3">
      {anyBaseline && (
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-2.5">
          <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Baseline miss rate for 12-team leagues is 50% (6/12 teams don't make playoffs)
          </p>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  className={`font-semibold cursor-pointer select-none hover:bg-muted/60 transition-colors whitespace-nowrap text-xs ${col.align === "right" ? "text-right" : ""}`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, i) => {
              const vol = calcVolatility(row, has2021, has2022, has2023);
              return (
                <TableRow
                  key={i}
                  className="hover:bg-muted/30 transition-colors"
                  data-testid={`compare-miss-row-${i}`}
                >
                  <TableCell className={`text-sm ${sorted_cls("strategy")}`}>{row.strategy}</TableCell>
                  {has2021 && (
                    <TableCell className={`text-right text-sm ${sorted_cls("miss_rate_2021")}`}>
                      {row.miss_rate_2021 != null ? pct(row.miss_rate_2021) : "—"}
                    </TableCell>
                  )}
                  {has2022 && (
                    <TableCell className={`text-right text-sm ${sorted_cls("miss_rate_2022")}`}>
                      {row.miss_rate_2022 != null ? pct(row.miss_rate_2022) : "—"}
                    </TableCell>
                  )}
                  {has2023 && (
                    <TableCell className={`text-right text-sm ${sorted_cls("miss_rate_2023")}`}>
                      {row.miss_rate_2023 != null ? pct(row.miss_rate_2023) : "—"}
                    </TableCell>
                  )}
                  <TableCell className={`text-right text-sm ${sorted_cls("miss_rate_2024")}`}>
                    {pct(row.miss_rate_2024)}
                  </TableCell>
                  <TableCell className={`text-right text-sm ${sorted_cls("miss_rate_2025")}`}>
                    {pct(row.miss_rate_2025)}
                  </TableCell>
                  <TableCell className={`text-right text-sm font-semibold text-foreground ${sorted_cls("avg_miss_rate")}`}>
                    {pct(avgMissRate(row, has2021, has2022, has2023))}
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
      <p className="text-xs text-muted-foreground px-1">
        {allYearsLabel
          ? `Volatility = standard deviation of miss rate across ${allYearsLabel} (in pp). Lower is more consistent.`
          : "Volatility = standard deviation of miss rate across 2024 and 2025 (in pp). Lower is more consistent."}
      </p>
    </div>
  );
}
