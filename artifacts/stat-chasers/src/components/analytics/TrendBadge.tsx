interface Props {
  label: string;
  size?: "sm" | "xs";
}

const TREND_STYLES: Record<string, string> = {
  "Higher YoY": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Lower YoY": "bg-red-50 text-red-700 border-red-200",
  "Consistent YoY": "bg-sky-50 text-sky-700 border-sky-200",
  Volatile: "bg-amber-50 text-amber-700 border-amber-200",
  Noisy: "bg-slate-50 text-slate-500 border-slate-200",
  "Limited Data": "bg-slate-50 text-slate-400 border-slate-200",
};

const TREND_ICONS: Record<string, string> = {
  "Higher YoY": "↑",
  "Lower YoY": "↓",
  "Consistent YoY": "→",
  Volatile: "↕",
  Noisy: "~",
  "Limited Data": "?",
};

export function TrendBadge({ label, size = "sm" }: Props) {
  const cls = TREND_STYLES[label] ?? "bg-slate-50 text-slate-500 border-slate-200";
  const icon = TREND_ICONS[label] ?? "";
  const textSize = size === "xs" ? "text-[10px]" : "text-xs";
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 font-semibold ${textSize} ${cls}`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}
