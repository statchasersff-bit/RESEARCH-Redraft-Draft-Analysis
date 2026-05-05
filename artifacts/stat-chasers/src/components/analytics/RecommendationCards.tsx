import { Badge } from "@/components/ui/badge";

interface Recommendation {
  headline: string;
  body?: string;
  sample_size?: number;
  confidence: string;
  metrics?: Record<string, number>;
}

interface RecommendationGroup {
  headline: string;
  recommendations: Recommendation[];
}

interface Props {
  group?: RecommendationGroup;
  label: string;
}

function ConfidenceBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    High: "bg-green-100 text-green-800 border-green-200",
    Medium: "bg-blue-100 text-blue-800 border-blue-200",
    Low: "bg-yellow-100 text-yellow-800 border-yellow-200",
    "Very Low": "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${map[level] ?? map["Very Low"]}`}>
      {level}
    </span>
  );
}

export function RecommendationCards({ group, label }: Props) {
  if (!group) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No {label} recommendations available yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground bg-muted/50 rounded-lg px-4 py-3 border-l-4 border-accent">
        {group.headline}
      </p>
      {group.recommendations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Insufficient data for recommendations. Add more leagues to the input CSV.</p>
      ) : (
        <div className="grid gap-3">
          {group.recommendations.map((rec, i) => (
            <div
              key={i}
              className="bg-card border rounded-xl p-4 shadow-sm hover:shadow transition-shadow"
              data-testid={`rec-card-${label}-${i}`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <h4 className="font-semibold text-foreground text-sm leading-snug flex-1">
                  {rec.headline}
                </h4>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {rec.sample_size != null && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      n={rec.sample_size.toLocaleString()}
                    </span>
                  )}
                  <ConfidenceBadge level={rec.confidence} />
                </div>
              </div>
              {rec.body && (
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{rec.body}</p>
              )}
              {rec.metrics && Object.keys(rec.metrics).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3 pt-3 border-t border-border/60">
                  {rec.metrics.playoff_rate != null && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Playoff Rate: </span>
                      <span className="font-semibold text-foreground">{(rec.metrics.playoff_rate * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {rec.metrics.championship_rate != null && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Champ Rate: </span>
                      <span className="font-semibold text-foreground">{(rec.metrics.championship_rate * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {rec.metrics.average_points_for != null && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Avg Pts: </span>
                      <span className="font-semibold text-foreground">{rec.metrics.average_points_for.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
