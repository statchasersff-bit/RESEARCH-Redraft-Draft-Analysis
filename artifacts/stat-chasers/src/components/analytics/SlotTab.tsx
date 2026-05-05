import { StrategyTable } from "./StrategyTable";

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
}

export function SlotTab({ data, label }: Props) {
  if (!data || data.sample_size === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No data for {label} slot — run the pipeline with more leagues.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h3 className="text-base font-semibold text-foreground">{label} Draft Slot</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          n={data.sample_size.toLocaleString()}
        </span>
      </div>

      {data.recommended_draft_blueprint && (
        <div className="bg-accent/5 border border-accent/30 rounded-lg px-4 py-3 text-sm">
          <span className="font-semibold text-foreground">Recommended Blueprint: </span>
          <span className="text-muted-foreground">{data.recommended_draft_blueprint}</span>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Best Strategies
        </h4>
        <StrategyTable rows={(data.best_strategies ?? []) as any} highlightFirst />
      </div>

      {data.best_first_two_pick_combos && (data.best_first_two_pick_combos as any[]).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Best First Two Pick Combos
          </h4>
          <StrategyTable rows={(data.best_first_two_pick_combos ?? []) as any} />
        </div>
      )}

      {data.best_first_five_builds && (data.best_first_five_builds as any[]).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Best First Five Builds
          </h4>
          <StrategyTable rows={(data.best_first_five_builds ?? []) as any} />
        </div>
      )}
    </div>
  );
}
