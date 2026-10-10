import { useState, useMemo } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  BarChart,
  Bar,
  Tooltip,
} from "recharts";

interface StrategyRow {
  strategy?: string;
  strategy_name?: string;
  sample_size: number;
  average_points_for: number;
  playoff_rate: number;
  championship_rate: number;
  top_3_pf_rate?: number;
  playoff_rate_lift: number;
  confidence_level: string;
}

type SortKey = "playoff_rate" | "championship_rate" | "top_3_pf_rate";

interface BarEntry {
  fullName: string;
  value: number;
  playoff_rate: number;
  championship_rate: number;
  top_3_pf_rate?: number;
  average_points_for: number;
  sample_size: number;
  confidence_level: string;
}

interface Props {
  strategies: StrategyRow[];
  baselinePlayoffRate?: number;
}

function sName(s: StrategyRow): string {
  return (s.strategy ?? s.strategy_name ?? "").trim();
}

// Refined, less "traffic-light" palette — deep green → muted green → slate →
// muted red → deep red. Shared by the bars and their legend so they stay in sync.
const BAR_TIERS = [
  { key: "majorEdge", color: "#15803d", label: "Major Edge (>5pp above avg)" },
  { key: "positive",  color: "#5ea982", label: "Positive Edge (2–5pp)" },
  { key: "neutral",   color: "#94a3b8", label: "Neutral (±2pp)" },
  { key: "negative",  color: "#cf9191", label: "Negative Edge (2–5pp)" },
  { key: "majorTrap", color: "#a83232", label: "Major Trap (>5pp below avg)" },
] as const;

// Colors relative to computed baseline — ±5pp / ±2pp tiers, neutral slate zone
function barColor(value: number, baseline: number): string {
  const lift = value - baseline;
  if (lift >= 0.05)  return BAR_TIERS[0].color;  // major edge — deep green
  if (lift >= 0.02)  return BAR_TIERS[1].color;  // positive edge — soft green
  if (lift >= -0.02) return BAR_TIERS[2].color;  // neutral — slate
  if (lift >= -0.05) return BAR_TIERS[3].color;  // negative edge — muted red
  return BAR_TIERS[4].color;                      // major trap — deep red
}

// ── Custom bar shape with raw % + lift label inside ───────────────────────────
function BarWithLabel(props: any) {
  const { x, y, width, height, value, baseline } = props;
  const color = barColor(value, baseline);
  const rawLabel = `${(value * 100).toFixed(1)}%`;
  const lift = value - baseline;
  const liftLabel = `${lift >= 0 ? "+" : ""}${(lift * 100).toFixed(1)}pp`;
  const safeW = Math.max(width ?? 0, 0);
  const isNeutral = Math.abs(lift) < 0.02;
  return (
    <g>
      <rect x={x} y={y} width={safeW} height={height} rx={3} ry={3} fill={color} />
      {safeW > 80 && (
        <>
          <text x={x + safeW - 7} y={y + height / 2 - 5}
            textAnchor="end" dominantBaseline="middle"
            fontSize={10} fontWeight={700}
            fill={isNeutral ? "#1e293b" : "white"}
            style={{ pointerEvents: "none" }}>
            {rawLabel}
          </text>
          <text x={x + safeW - 7} y={y + height / 2 + 6}
            textAnchor="end" dominantBaseline="middle"
            fontSize={8.5} fontWeight={500}
            fill={isNeutral ? "#475569" : "white"} fillOpacity={0.85}
            style={{ pointerEvents: "none" }}>
            {liftLabel}
          </text>
        </>
      )}
      {safeW > 44 && safeW <= 80 && (
        <text x={x + safeW - 7} y={y + height / 2}
          textAnchor="end" dominantBaseline="middle"
          fontSize={10} fontWeight={700}
          fill={isNeutral ? "#1e293b" : "white"}
          style={{ pointerEvents: "none" }}>
          {rawLabel}
        </text>
      )}
    </g>
  );
}

// ── Rich bar tooltip ──────────────────────────────────────────────────────────
function BarTooltip({ active, payload, baselineRate }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as BarEntry;
  const lift = d.playoff_rate - baselineRate;
  const isPos = lift >= 0;
  return (
    <div className="bg-card border border-border shadow-xl rounded-xl px-4 py-3 text-sm space-y-1.5 min-w-[220px]">
      <p className="font-bold text-foreground text-sm border-b border-border pb-1.5 mb-0.5">
        {d.fullName}
      </p>
      <div className="flex justify-between gap-6">
        <span className="text-muted-foreground">Playoff Rate</span>
        <span className="font-semibold">{(d.playoff_rate * 100).toFixed(1)}%</span>
      </div>
      <div className="flex justify-between gap-6">
        <span className="text-muted-foreground">Championship Rate</span>
        <span className="font-semibold">{(d.championship_rate * 100).toFixed(1)}%</span>
      </div>
      {d.top_3_pf_rate != null && (
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Top-3 Points</span>
          <span className="font-semibold">{(d.top_3_pf_rate * 100).toFixed(1)}%</span>
        </div>
      )}
      <div className="flex justify-between gap-6 border-t border-border pt-1.5">
        <span className="text-muted-foreground">vs League Avg</span>
        <span className={`font-semibold ${isPos ? "text-green-600" : "text-red-500"}`}>
          {isPos ? "+" : ""}{(lift * 100).toFixed(1)}%
        </span>
      </div>
      <div className="flex justify-between gap-6">
        <span className="text-muted-foreground">Sample</span>
        <span className="font-semibold">{d.sample_size.toLocaleString()} teams</span>
      </div>
      <div className="flex justify-between gap-6">
        <span className="text-muted-foreground">Confidence</span>
        <span className="font-semibold">{d.confidence_level}</span>
      </div>
    </div>
  );
}

// ── Floating avg label rendered via recharts label callback ───────────────────
function AvgLabel({ viewBox, baseline }: any) {
  if (!viewBox) return null;
  const { x, y } = viewBox as { x: number; y: number };
  const text = `League Avg ${(baseline * 100).toFixed(1)}%`;
  const pw = text.length * 6.2 + 12;
  return (
    <g>
      <rect x={x + 6} y={y + 4} width={pw} height={16} rx={4} fill="#475569" />
      <text
        x={x + 12}
        y={y + 15}
        fontSize={9.5}
        fontWeight={700}
        fill="white"
        style={{ pointerEvents: "none" }}
      >
        {text}
      </text>
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "playoff_rate", label: "Playoff Rate" },
  { key: "championship_rate", label: "Championship" },
  { key: "top_3_pf_rate", label: "Top-3 Points" },
];

export function StrategyCharts({ strategies, baselinePlayoffRate }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("playoff_rate");

  const deduped = useMemo(() => {
    const seen = new Set<string>();
    return strategies.filter((s) => {
      const n = sName(s);
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
  }, [strategies]);

  const baseline = baselinePlayoffRate ?? 0.5;

  // Bar chart — rich data, sorted by chosen key
  const barData: BarEntry[] = useMemo(() => {
    return [...deduped]
      .sort((a, b) => {
        const av = sortKey === "top_3_pf_rate"
          ? (a.top_3_pf_rate ?? 0)
          : (a[sortKey] as number);
        const bv = sortKey === "top_3_pf_rate"
          ? (b.top_3_pf_rate ?? 0)
          : (b[sortKey] as number);
        return av - bv; // ascending — recharts horizontal bars read bottom-up
      })
      .map((s) => ({
        fullName: sName(s),
        value: sortKey === "top_3_pf_rate" ? (s.top_3_pf_rate ?? 0) : (s[sortKey] as number),
        playoff_rate: s.playoff_rate,
        championship_rate: s.championship_rate,
        top_3_pf_rate: s.top_3_pf_rate,
        average_points_for: s.average_points_for,
        sample_size: s.sample_size,
        confidence_level: s.confidence_level,
      }));
  }, [deduped, sortKey]);

  // Per-metric baseline — mean of the active metric across all strategies
  const barBaseline = useMemo(() => {
    if (sortKey === "playoff_rate") return baseline;
    const metricVals = deduped
      .map((s) => (sortKey === "championship_rate" ? s.championship_rate : (s.top_3_pf_rate ?? 0)))
      .filter((v) => v > 0);
    return metricVals.length ? metricVals.reduce((a, b) => a + b, 0) / metricVals.length : baseline;
  }, [deduped, sortKey, baseline]);

  // X axis domain — tight, snapped to 5pp increments
  const vals = barData.map((d) => d.value);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  const domMin = Math.max(0, Math.floor((rawMin - 0.03) * 20) / 20);
  const domMax = Math.min(1, Math.ceil((rawMax + 0.02) * 20) / 20);

  // Baseline band ±2pp around metric average — always shown
  const showBand = true;
  const bandLo = Math.max(domMin, barBaseline - 0.02);
  const bandHi = Math.min(domMax, barBaseline + 0.02);

  // Bar height — 24px per bar + 6px gap, capped for large sets
  const barHeight = Math.max(340, barData.length * 36);

  if (deduped.length === 0) return null;

  return (
    <div className="rs-app-strategy-module">
      {/* ── Bar: Strategy Ranking ── */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h4 className="text-sm font-bold text-foreground">Strategy Ranking</h4>
            <div className="mt-1 h-0.5 w-[30px] rounded-full bg-[#C9A227]" />
          </div>
          {/* Sort toggle — segmented control, matches the Playoff %/Top 3 PF % toggle */}
          <div className="flex shrink-0 rounded-md border border-border overflow-hidden text-xs font-medium">
            {SORT_OPTIONS.map((opt, i) => (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                className={`px-3 py-1.5 transition-colors ${i > 0 ? "border-l border-border" : ""} ${
                  sortKey === opt.key
                    ? "bg-[#0B1F3A] text-white"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={barHeight}>
          <BarChart
            layout="vertical"
            data={barData}
            margin={{ top: 4, right: 14, bottom: 4, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
            <XAxis
              type="number"
              domain={[domMin, domMax]}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              tick={{ fontSize: 10, fill: "#6b7280" }}
            />
            <YAxis
              type="category"
              dataKey="fullName"
              tick={{ fontSize: 11, fill: "#374151", fontWeight: 500 }}
              width={108}
            />
            <Tooltip
              content={(p) => <BarTooltip {...p} baselineRate={barBaseline} />}
              cursor={{ fill: "#f1f5f9" }}
            />

            {/* Baseline band — rendered first so bars draw over it */}
            <ReferenceArea
              x1={bandLo}
              x2={bandHi}
              fill="#64748b"
              fillOpacity={0.18}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="4 2"
              ifOverflow="hidden"
            />

            <Bar
              dataKey="value"
              maxBarSize={26}
              shape={(props: any) => (
                <BarWithLabel {...props} baseline={barBaseline} />
              )}
            />

            {/* Baseline line — rendered after bars so it sits on top */}
            <ReferenceLine
              x={barBaseline}
              stroke="#1e293b"
              strokeDasharray="6 3"
              strokeWidth={2}
              label={<AvgLabel baseline={barBaseline} />}
            />
          </BarChart>
        </ResponsiveContainer>

      </div>
    </div>
  );
}
