import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BuildRow {
  strategy: string;
  rate2021?: number;
  rate2022?: number;
  rate2023?: number;
  rate2024?: number;
  rate2025?: number;
  avg: number;
  volatilityPp: number;
  pf2021?: number;
  pf2022?: number;
  pf2023?: number;
  pf2024?: number;
  pf2025?: number;
  pfAvg: number;
  pfVolatilityPp: number;
  n2021?: number;
  n2022?: number;
  n2023?: number;
  n2024?: number;
  n2025?: number;
}

interface Props {
  rows: BuildRow[];
  mode: Mode;
}

type Mode = "playoff" | "pf";
type SortDir = "asc" | "desc";
type SortKey =
  | "strategy"
  | "yr2021" | "yr2022" | "yr2023" | "yr2024" | "yr2025"
  | "avg"
  | "vol"
  | "n2021" | "n2022" | "n2023" | "n2024" | "n2025";

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function OptCell({ v }: { v?: number }) {
  if (v == null) return <span className="text-muted-foreground/40">—</span>;
  return <span>{pct(v)}</span>;
}

function NCell({ v }: { v?: number }) {
  if (v == null) return <span className="text-muted-foreground/40">—</span>;
  return <span>{v.toLocaleString()}</span>;
}

function volatilityLabel(pp: number) {
  if (pp < 2) return "Stable";
  if (pp < 5) return "Moderate";
  return "High";
}

function volatilityClasses(pp: number) {
  if (pp < 2) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (pp < 5) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-muted-foreground/30 ml-1">↕</span>;
  return <span className="text-foreground ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

interface ColDef {
  key: SortKey;
  label: string;
  sub: string;
  align: "left" | "right";
  desktop?: boolean;
  hide?: boolean;
}

function getColumns(mode: Mode, has2021: boolean, has2022: boolean, has2023: boolean): ColDef[] {
  const metricSub = mode === "playoff" ? "Playoff %" : "Top 3 PF %";
  return [
    { key: "strategy", label: "Pick Combo", sub: "", align: "left" },
    { key: "yr2021", label: "2021", sub: metricSub, align: "right", hide: !has2021 },
    { key: "yr2022", label: "2022", sub: metricSub, align: "right", hide: !has2022 },
    { key: "yr2023", label: "2023", sub: metricSub, align: "right", hide: !has2023 },
    { key: "yr2024", label: "2024", sub: metricSub, align: "right" },
    { key: "yr2025", label: "2025", sub: metricSub, align: "right" },
    { key: "avg", label: "Avg", sub: metricSub, align: "right" },
    { key: "vol", label: "Volatility", sub: "", align: "right" },
    { key: "n2021", label: "n", sub: "(2021)", align: "right", desktop: true, hide: !has2021 },
    { key: "n2022", label: "n", sub: "(2022)", align: "right", desktop: true, hide: !has2022 },
    { key: "n2023", label: "n", sub: "(2023)", align: "right", desktop: true, hide: !has2023 },
    { key: "n2024", label: "n", sub: "(2024)", align: "right", desktop: true },
    { key: "n2025", label: "n", sub: "(2025)", align: "right", desktop: true },
  ].filter((c) => !c.hide) as ColDef[];
}

function getVal(row: BuildRow, key: SortKey, mode: Mode): number | string | undefined {
  switch (key) {
    case "strategy": return row.strategy;
    case "yr2021": return mode === "playoff" ? row.rate2021 : row.pf2021;
    case "yr2022": return mode === "playoff" ? row.rate2022 : row.pf2022;
    case "yr2023": return mode === "playoff" ? row.rate2023 : row.pf2023;
    case "yr2024": return mode === "playoff" ? row.rate2024 : row.pf2024;
    case "yr2025": return mode === "playoff" ? row.rate2025 : row.pf2025;
    case "avg":    return mode === "playoff" ? row.avg : row.pfAvg;
    case "vol":    return mode === "playoff" ? row.volatilityPp : row.pfVolatilityPp;
    case "n2021":  return row.n2021;
    case "n2022":  return row.n2022;
    case "n2023":  return row.n2023;
    case "n2024":  return row.n2024;
    case "n2025":  return row.n2025;
  }
}

export function CompareFirstFiveTable({ rows, mode }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("avg");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "strategy" ? "asc" : "desc");
    }
  }

  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No data available for this filter combination.
      </p>
    );
  }

  const has2021 = rows.some((r) => r.n2021 != null && r.n2021 > 0);
  const has2022 = rows.some((r) => r.n2022 != null && r.n2022 > 0);
  const has2023 = rows.some((r) => r.n2023 != null && r.n2023 > 0);

  const columns = getColumns(mode, has2021, has2022, has2023);

  const sorted = [...rows].sort((a, b) => {
    const av = getVal(a, sortKey, mode) ?? (sortDir === "desc" ? -Infinity : Infinity);
    const bv = getVal(b, sortKey, mode) ?? (sortDir === "desc" ? -Infinity : Infinity);
    if (typeof av === "string" && typeof bv === "string")
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const volPp = (row: BuildRow) =>
    mode === "playoff" ? row.volatilityPp : row.pfVolatilityPp;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={[
                      col.align === "right" ? "text-right" : "",
                      col.desktop ? "hidden md:table-cell" : "",
                      "cursor-pointer select-none whitespace-nowrap",
                    ].join(" ")}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex flex-col items-end gap-0">
                      <span className="text-xs font-semibold text-foreground leading-tight">
                        {col.label}
                        <SortIcon active={sortKey === col.key} dir={sortDir} />
                      </span>
                      {col.sub && (
                        <span className="text-[10px] text-muted-foreground font-normal leading-tight">
                          {col.sub}
                        </span>
                      )}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row, i) => {
                const vpp = volPp(row);
                const yr21 = mode === "playoff" ? row.rate2021 : row.pf2021;
                const yr22 = mode === "playoff" ? row.rate2022 : row.pf2022;
                const yr23 = mode === "playoff" ? row.rate2023 : row.pf2023;
                const yr24 = mode === "playoff" ? row.rate2024 : row.pf2024;
                const yr25 = mode === "playoff" ? row.rate2025 : row.pf2025;
                const avg  = mode === "playoff" ? row.avg : row.pfAvg;
                return (
                  <TableRow
                    key={row.strategy}
                    className={`transition-colors hover:bg-muted/30 ${i === 0 ? "bg-accent/5 border-l-2 border-l-accent" : ""}`}
                  >
                    <TableCell className="font-mono text-sm font-semibold text-foreground">
                      {row.strategy}
                    </TableCell>
                    {has2021 && (
                      <TableCell className="text-right text-muted-foreground">
                        <OptCell v={yr21} />
                      </TableCell>
                    )}
                    {has2022 && (
                      <TableCell className="text-right text-muted-foreground">
                        <OptCell v={yr22} />
                      </TableCell>
                    )}
                    {has2023 && (
                      <TableCell className="text-right text-muted-foreground">
                        <OptCell v={yr23} />
                      </TableCell>
                    )}
                    <TableCell className="text-right text-muted-foreground">
                      <OptCell v={yr24} />
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">
                      <OptCell v={yr25} />
                    </TableCell>
                    <TableCell className="text-right font-bold text-foreground">
                      {pct(avg)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${volatilityClasses(vpp)}`}>
                        {volatilityLabel(vpp)}
                      </span>
                    </TableCell>
                    {has2021 && (
                      <TableCell className="text-right text-muted-foreground text-sm hidden md:table-cell">
                        <NCell v={row.n2021} />
                      </TableCell>
                    )}
                    {has2022 && (
                      <TableCell className="text-right text-muted-foreground text-sm hidden md:table-cell">
                        <NCell v={row.n2022} />
                      </TableCell>
                    )}
                    {has2023 && (
                      <TableCell className="text-right text-muted-foreground text-sm hidden md:table-cell">
                        <NCell v={row.n2023} />
                      </TableCell>
                    )}
                    <TableCell className="text-right text-muted-foreground text-sm hidden md:table-cell">
                      <NCell v={row.n2024} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm hidden md:table-cell">
                      <NCell v={row.n2025} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
