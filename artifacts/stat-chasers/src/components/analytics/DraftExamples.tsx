import { useState } from "react";
import { ChevronDown, ChevronUp, Dumbbell } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraftPick {
  name: string;
  position: string;
  team: string;
}

interface DraftRound {
  round: number;
  picks: DraftPick[];
}

interface DraftExample {
  strategy: string;
  draft_id: string;
  roster_id: number;
  rounds: DraftRound[];
}

interface Props {
  examples?: DraftExample[];
  isLoading?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  RB:  { bg: "bg-green-100",  text: "text-green-800",  border: "border-green-200" },
  WR:  { bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-200" },
  QB:  { bg: "bg-red-100",    text: "text-red-800",    border: "border-red-200" },
  TE:  { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-200" },
};

const STRATEGY_DESCRIPTIONS: Record<string, string> = {
  "Robust RB": "3+ RBs in rounds 1–5. Heavy early investment in the running back position for volume and depth.",
  "Zero RB":   "0 RBs in rounds 1–5. Loads up on WRs early and targets RB value in the mid-to-late rounds.",
  "Hero RB":   "Exactly 1 RB in rounds 1–5. One high-upside RB anchor paired with heavy WR depth.",
  "WR Heavy":  "3+ WRs in rounds 1–5. Commits to wide receiver depth and upside across the early rounds.",
  "Balanced":  "Exactly 2 RBs and fewer than 3 WRs in rounds 1–5. A mixed start without extreme positional concentration.",
};

const STRATEGY_COLOR: Record<string, string> = {
  "Robust RB": "border-l-green-500",
  "Zero RB":   "border-l-red-500",
  "Hero RB":   "border-l-blue-500",
  "WR Heavy":  "border-l-indigo-500",
  "Balanced":  "border-l-sky-600",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function PosBadge({ position }: { position: string }) {
  const s = POS_STYLES[position] ?? POS_STYLES.DEF;
  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-5 rounded text-[10px] font-bold border ${s.bg} ${s.text} ${s.border}`}
    >
      {position}
    </span>
  );
}

function RoundRow({ round, picks }: DraftRound) {
  // For snake drafts each roster gets one pick per round (the main pick)
  const pick = picks[0];
  if (!pick) return null;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
      <span className="w-16 shrink-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Round {round}
      </span>
      <PosBadge position={pick.position} />
      <span className="font-medium text-sm text-foreground flex-1">{pick.name}</span>
      {pick.team && (
        <span className="text-xs text-muted-foreground shrink-0">{pick.team}</span>
      )}
    </div>
  );
}

function ExampleCard({ example, defaultOpen }: { example: DraftExample; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const accentBorder = STRATEGY_COLOR[example.strategy] ?? "border-l-gray-400";
  const desc = STRATEGY_DESCRIPTIONS[example.strategy];

  // Summary: first 3 rounds as a quick visual
  const preview = example.rounds.slice(0, 5);

  return (
    <div className={`bg-card border border-border border-l-4 ${accentBorder} rounded-xl shadow-sm overflow-hidden`}>
      {/* Header */}
      <button
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Dumbbell className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-foreground text-sm">{example.strategy} Build</p>
            {desc && <p className="text-xs text-muted-foreground truncate">{desc}</p>}
          </div>
        </div>

        {/* Quick round-1–5 position strip */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {preview.map((r) =>
            r.picks[0] ? (
              <PosBadge key={r.round} position={r.picks[0].position} />
            ) : null
          )}
          <span className="text-xs text-muted-foreground ml-1">…</span>
        </div>

        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded draft board */}
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-3 italic">
            Real draft from the analyzed dataset · Rounds 1–8 shown
          </p>
          <div>
            {example.rounds.map((r) => (
              <RoundRow key={r.round} {...r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function DraftExamples({ examples, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (!examples?.length) return null;

  return (
    <div className="space-y-3">
      <div className="mb-1">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
          Real Draft Examples
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Actual drafts pulled from the analyzed dataset, one per strategy. Click to expand.
        </p>
      </div>
      {examples.map((ex, i) => (
        <ExampleCard key={ex.strategy} example={ex} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
