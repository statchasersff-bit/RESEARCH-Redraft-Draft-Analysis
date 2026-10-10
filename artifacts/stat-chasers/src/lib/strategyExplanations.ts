// Context-aware "Why It Worked / Why It Didn't" explanations for each strategy.
// Keys match the strategy names coming from the pipeline.
// Provide a `qb` key ("one_qb" | "superflex") for format-sensitive overrides.

type QbFormat = "one_qb" | "superflex";

interface ExplanationEntry {
  default: string;
  one_qb?: string;
  superflex?: string;
}

const EXPLANATIONS: Record<string, ExplanationEntry> = {
  "Robust RB": {
    default:
      "RB is the scarcest position in redraft. Elite backs rarely reach the waiver wire. Stacking 3+ in rounds 1–5 builds weekly floor and injury depth, creating a consistent edge over teams forced to plug in replacement-level carries.",
    superflex:
      "Even in Superflex, RB scarcity remains the dominant roster edge. Securing 3+ early locks in weekly scoring floor while others over-invest in the extra QB tier that Superflex creates.",
  },

  "Late TE": {
    default:
      "Outside the top 3–4 TEs, the scoring curve is remarkably flat. The TE7 and the TE11 produce nearly identical weekly numbers, so waiting until round 8+ and redirecting those early picks to scarcer RBs and WRs is almost always more efficient.",
  },

  "Balanced": {
    default:
      "Spreading picks across RB and WR through round 5 avoids over-committing to a single positional bet. It preserves trade flexibility mid-season and keeps your roster functional when one starter inevitably misses time.",
  },

  "Late QB": {
    default:
      "In 1QB formats, a competent starter is reliably available in rounds 8–12. The points gap between the QB8 and QB16 is narrower than any other position, making early QB picks one of the least efficient investments in redraft.",
    superflex:
      "Waiting on QB is a structural disadvantage in Superflex: you need two starting QBs, and elite passers get scooped early. Late QB here often means settling for a QB2-tier player at a position that now scores like a premium flex.",
  },

  "Elite QB": {
    default:
      "In 1QB formats, the gap between a QB1 and QB12 is far smaller than at RB or WR. A reliable starter can be found in rounds 8–12, so paying round 2–4 price for a QB is inefficient: you're overpaying for availability you don't need.",
    superflex:
      "Superflex changes the math entirely. With two starting QBs required, elite passers become as scarce as top RBs. Locking one in rounds 1–4 is strategically justified, as the positional advantage compounds all season.",
  },

  "Zero RB": {
    default:
      "RBs score too many points in redraft to skip entirely. Zero RB relies on WR depth and waiver-wire RBs compensating for a gaping hole at the sport's most injury-prone position. In practice, viable waiver RBs are gone quickly, and the playoff rate penalty reflects it.",
  },

  "Elite TE": {
    default:
      "Top TEs like Kelce create real mismatches, but the opportunity cost is steep: you're trading a top-2 pick for a position with one true elite outlier. Most teams who draft TE in rounds 1–2 don't land that outlier and pay the cost all season.",
    one_qb:
      "In 1QB formats, the TE opportunity cost is highest. You're giving up an early RB or WR at the round where positional scarcity is most severe, for a TE advantage that the data shows rarely converts to playoff appearances.",
  },

  "Hero RB": {
    default:
      "Taking only 1 RB in rounds 1–5 leaves your roster one injury away from a season-ending floor problem. The 'hero' approach bets on elite WR depth compensating for RB scarcity, a gamble that doesn't pay off consistently enough in the data.",
  },

  "WR Heavy": {
    default:
      "Loading 3+ WRs in rounds 1–5 sacrifices critical RB picks during the window where the positional gap between a starter and a replacement is steepest. WRs are deeper positionally, making the opportunity cost of going WR-heavy higher than it initially appears.",
  },

  // ── First-round positions ────────────────────────────────────────────────

  WR: {
    default:
      "Wide receivers offer the most durable weekly production in PPR formats. Target share is more predictable than RB carries, and opening with a WR1 locks in a consistent scorer while avoiding the high injury exposure that comes with round-1 RBs.",
  },

  RB: {
    default:
      "Round-1 RBs are elite, but RB is the position most likely to miss significant time. Taking an RB first maximizes scoring upside but front-loads the roster's biggest injury risk. The data reflects the volatility: strong upside, but worse average playoff rates than WR-first.",
  },

  QB: {
    default:
      "In 1QB formats, QBs simply aren't scarce enough to justify a round-1 pick. The scoring gap between QB1 and QB12 is narrower than any other position, making this the least efficient first-round investment in standard formats.",
    superflex:
      "Round-1 QBs make sense in Superflex: the position doubles in demand, and elite passers are genuinely scarce. The data in Superflex formats shows this outperforming other round-1 options.",
  },

  TE: {
    default:
      "Only 1–2 TEs create a true roster-level edge each season. Paying round-1 price for a TE is a binary bet: if you land the outlier (Kelce tier), you've won the position. If you don't, or your pick goes wrong, the cost is an entire season of suboptimal round-1 value.",
  },
};

export function getStrategyExplanation(
  strategy: string,
  qbFormat?: QbFormat
): string | undefined {
  const entry = EXPLANATIONS[strategy];
  if (!entry) return undefined;
  if (qbFormat && entry[qbFormat]) return entry[qbFormat];
  return entry.default;
}
