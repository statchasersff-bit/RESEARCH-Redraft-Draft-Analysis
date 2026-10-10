import { pooled, fmtPct, fmtCiPp, type SeasonPoint } from "@/lib/stats";

interface StrategyRow {
  strategy: string;
  playoff_rate_2021?: number;
  playoff_rate_2022?: number;
  playoff_rate_2023?: number;
  playoff_rate_2024: number;
  playoff_rate_2025: number;
  sample_2021?: number;
  sample_2022?: number;
  sample_2023?: number;
  sample_2024: number;
  sample_2025: number;
}

interface Props {
  trendsSlice?: any;
}

function periodPoints(
  s: StrategyRow,
  period: "early" | "late",
): SeasonPoint[] {
  return period === "early"
    ? [
        { rate: s.playoff_rate_2021, n: s.sample_2021 },
        { rate: s.playoff_rate_2022, n: s.sample_2022 },
        { rate: s.playoff_rate_2023, n: s.sample_2023 },
      ]
    : [
        { rate: s.playoff_rate_2024, n: s.sample_2024 },
        { rate: s.playoff_rate_2025, n: s.sample_2025 },
      ];
}

function getStrategy(strats: StrategyRow[], name: string) {
  const s = strats.find((r) => r.strategy === name);
  if (!s) return null;
  return {
    early: pooled(periodPoints(s, "early")),
    late: pooled(periodPoints(s, "late")),
  };
}

type Period = ReturnType<typeof pooled>;

function StatChip({
  label,
  early,
  late,
}: {
  label: string;
  early: Period;
  late: Period;
}) {
  const diff =
    early.n > 0 && late.n > 0 ? (late.rate - early.rate) * 100 : null;
  const positive = diff != null && diff > 0;
  return (
    <div className="flex-1 min-w-[220px] rounded-xl border border-border bg-white/60 px-4 py-3 space-y-2">
      <p
        className="text-xs font-bold uppercase tracking-wide"
        style={{ color: "#0B1F3A" }}
      >
        {label}
      </p>
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-xs text-muted-foreground block">
            2021–2023 playoff rate
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {early.n > 0 ? fmtPct(early.rate) : "—"}
          </span>
          <span className="block text-[10px] text-muted-foreground tabular-nums">
            {early.n > 0 ? `${fmtCiPp(early.ci)} · n=${early.n.toLocaleString()}` : ""}
          </span>
        </div>
        <div className="text-muted-foreground/40 text-lg">→</div>
        <div>
          <span className="text-xs text-muted-foreground block">
            2024–2025 playoff rate
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {late.n > 0 ? fmtPct(late.rate) : "—"}
          </span>
          <span className="block text-[10px] text-muted-foreground tabular-nums">
            {late.n > 0 ? `${fmtCiPp(late.ci)} · n=${late.n.toLocaleString()}` : ""}
          </span>
        </div>
        {diff != null && (
          <div
            className="ml-auto text-xs font-bold tabular-nums px-2 py-0.5 rounded-full"
            style={{
              background: positive ? "#dcfce7" : "#fee2e2",
              color: positive ? "#15803d" : "#dc2626",
            }}
          >
            Change: {positive ? "+" : ""}
            {diff.toFixed(1)} pp
          </div>
        )}
      </div>
    </div>
  );
}

const POSSIBLE_EXPLANATIONS = [
  "Better production from early-round running backs",
  "Different RB and WR ADP environments",
  "A stronger early-round RB player pool",
  "Weaker results from early-round wide receivers",
  "Better late-round WR availability",
  "Changes in NFL scoring or offensive usage",
  "Injuries",
  "Normal season-to-season variance",
];

export function RobustRbRebound({ trendsSlice }: Props) {
  const strats: StrategyRow[] = trendsSlice?.overall_strategies ?? [];
  const robustRb = getStrategy(strats, "Robust RB");
  const zeroRb = getStrategy(strats, "Zero RB");
  const hasData = robustRb != null || zeroRb != null;

  return (
    <section
      className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
      data-testid="robust-rb-rebound"
    >
      {/* Gold accent bar */}
      <div className="h-1 w-full" style={{ background: "#C9A227" }} />

      <div className="px-8 py-8 space-y-6">
        {/* Kicker */}
        <p
          className="text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: "#C9A227" }}
        >
          StatChasers Analysis
        </p>

        {/* Heading */}
        <div className="space-y-1">
          <h2
            className="text-2xl font-bold leading-tight"
            style={{ color: "#0B1F3A" }}
          >
            Why Did Robust RB Rebound?
          </h2>
          <p className="text-base font-semibold text-foreground">
            Robust RB improved sharply in 2024–2025, but the data cannot tell us
            exactly why.
          </p>
        </div>

        {/* Body — observed outcomes only */}
        <div className="space-y-4 text-sm text-foreground/80 leading-relaxed">
          <p>
            Across the 2021–2025 sample, most redraft draft strategies did not
            show a clear year-over-year trend. WR Heavy, Late TE, and Balanced
            builds were fairly steady, while several other strategies moved
            around without forming a strong long-term pattern.
          </p>
          <p>The biggest exception was RB-heavy construction.</p>
          <p>
            <strong>Robust RB</strong> struggled from 2021–2023, then improved
            substantially in 2024 and remained strong in 2025. <strong>Zero RB</strong>{" "}
            moved in the opposite direction, performing well earlier in the
            sample before declining in 2024 and 2025.
          </p>
          <p>
            These are observed fantasy-team outcomes only. They show what
            happened, not why it happened.
          </p>
        </div>

        {/* Dynamic stat chips — observed playoff rates with 95% CIs and sample sizes */}
        {hasData && (
          <div className="flex flex-wrap gap-3">
            {robustRb && (
              <StatChip label="Robust RB" early={robustRb.early} late={robustRb.late} />
            )}
            {zeroRb && (
              <StatChip label="Zero RB" early={zeroRb.early} late={zeroRb.late} />
            )}
          </div>
        )}

        {/* What this project can and cannot say */}
        <div className="space-y-4 text-sm text-foreground/80 leading-relaxed">
          <p>
            <strong>This project cannot determine the cause of the Robust RB
            rebound.</strong>{" "}
            The dashboard measures how draft builds performed, but it does not
            track why individual players produced, missed time, or changed roles.
          </p>
          <p>Several factors could have contributed, including:</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {POSSIBLE_EXPLANATIONS.map((reason) => (
              <li key={reason} className="flex gap-2.5">
                <span
                  className="mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full relative top-[6px]"
                  style={{ background: "#0B1F3A80" }}
                />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
          <p>
            These are <em>possible explanations, not conclusions</em>.
          </p>
          <p>
            We do <strong>not</strong> claim that running backs became safer or
            more durable. That question would require injury-level data that is
            not included in this project.
          </p>
        </div>

        {/* Methodology note */}
        <div
          className="rounded-lg border px-4 py-3 text-xs leading-relaxed text-muted-foreground space-y-2"
          style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}
          data-testid="methodology-note"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/70">
            Methodology
          </p>
          <p>
            This dashboard measures strategy <strong className="text-foreground">outcomes</strong>,
            not the causes behind those outcomes.
          </p>
          <p>
            Results are based on observed fantasy-team outcomes from the
            2021–2025 team dataset.{" "}
            <strong className="text-foreground">Top-Three Points Rate</strong> and{" "}
            <strong className="text-foreground">Playoff Rate</strong> are the
            primary evaluation metrics.{" "}
            <strong className="text-foreground">Championship Rate</strong> is
            included as a secondary result because it is more volatile.
          </p>
          <p>Strategy comparisons include sample sizes and 95% confidence intervals.</p>
          <p>
            Confidence intervals treat teams as independent. In reality, teams
            from the same league are not fully independent because each league
            has a fixed number of playoff spots. That means the true uncertainty
            is likely somewhat wider than shown.
          </p>
          <p>
            League-level clustered intervals would require per-strategy league
            identifiers, which are not currently included in the aggregated
            dataset.
          </p>
        </div>

        {/* Key takeaway — framed as an open question, not a conclusion */}
        <div
          className="rounded-xl px-5 py-4 flex items-start gap-3"
          style={{ background: "#0B1F3A" }}
        >
          <div
            className="flex-shrink-0 w-1 self-stretch rounded-full"
            style={{ background: "#C9A227" }}
          />
          <div className="space-y-0.5">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: "#C9A227" }}
            >
              Key Takeaway
            </p>
            <p className="text-sm text-white/90 leading-relaxed">
              Robust RB's recent improvement is real and worth watching, but the
              cause remains unresolved.
            </p>
            <p className="text-sm text-white/90 leading-relaxed pt-2">
              The old assumption that early running backs are always the fragile
              bet may be worth re-examining. This data does not prove that
              RB-heavy drafting is safer now, but it does show that RB-heavy
              builds performed much better in the 2024–2025 sample than they did
              from 2021–2023.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
