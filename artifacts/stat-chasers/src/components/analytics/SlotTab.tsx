import { StrategyTable } from "./StrategyTable";

const WHY_IT_WORKED: Record<string, string> = {
  "Robust RB":
    "RB-heavy builds produced the strongest weekly positional advantage due to RB scarcity and waiver instability. Locking in depth early insulates against season-ending injuries.",
  "Hero RB":
    "A single elite RB anchor in round 1 combined with WR depth in rounds 2–4 maximized upside at both positions while avoiding the volatility of stacking multiple injury-prone backs.",
  "Zero RB":
    "Punting RB entirely allowed teams to stack WR and TE premium assets in the first few rounds, then harvest high-volume RBs from a waiver wire that churns heavily as the season unfolds.",
  "WR Heavy":
    "Wide receiver consistency and target-share stability made WR-stacked builds the safest path to weekly floor. WR1s rarely disappear from game plans the way RBs do.",
  "Balanced":
    "Balanced builds avoided overexposure to any single position's injury risk, giving teams a reliable multi-week floor that translated into playoff qualification at an above-average rate.",
  "Elite QB":
    "Securing a QB1 in rounds 1–4 eliminated the volatility of late-round QB streaming and provided a weekly ceiling advantage in a format where QB points are amplified.",
  "Elite TE":
    "Elite TE advantage, particularly in PPR formats, creates a positional edge that compounds across a 14-week regular season, as TE is the hardest position to upgrade mid-season.",
  "Late QB":
    "Deferring QB until round 8 or later freed premium picks for RB and WR depth, where positional scarcity is highest and late-round value drops sharply.",
  "Late TE":
    "Punting TE early unlocked better value at RB and WR, where the overall talent gap between rounds 3–7 is far wider than what separates TE1 from TE10.",
};

function getWhyItWorked(blueprint: string): string | null {
  const strategy = blueprint.split("—")[0].trim();
  return WHY_IT_WORKED[strategy] ?? null;
}

interface SlotGroup {
  slot_group: string;
  sample_size: number;
  best_strategies?: unknown[];
  best_first_two_pick_combos?: unknown[];
  best_first_five_builds?: unknown[];
  recommended_draft_blueprint?: string;
}

interface Props {
  data?: SlotGroup;
  label: string;
  qbFormat?: "one_qb" | "superflex";
}

export function SlotTab({ data, label, qbFormat }: Props) {
  if (!data || data.sample_size === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No data for {label} slot. Run the pipeline with more leagues.
      </p>
    );
  }

  const whyItWorked = data.recommended_draft_blueprint
    ? getWhyItWorked(data.recommended_draft_blueprint)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h3 className="text-base font-semibold text-foreground">{label} Draft Slot</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          n={data.sample_size.toLocaleString()}
        </span>
      </div>

      {whyItWorked && (
        <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm">
          <span className="font-semibold text-foreground">Why it worked: </span>
          <span className="text-muted-foreground">{whyItWorked}</span>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Best Strategies
        </h4>
        <StrategyTable rows={(data.best_strategies ?? []) as any} highlightFirst qbFormat={qbFormat} />
      </div>

      {data.best_first_two_pick_combos && (data.best_first_two_pick_combos as any[]).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Best First Two Pick Combos
          </h4>
          <StrategyTable rows={(data.best_first_two_pick_combos ?? []) as any} qbFormat={qbFormat} />
        </div>
      )}

      {data.best_first_five_builds && (data.best_first_five_builds as any[]).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Best First Five Builds
          </h4>
          <StrategyTable rows={(data.best_first_five_builds ?? []) as any} qbFormat={qbFormat} />
        </div>
      )}
    </div>
  );
}
