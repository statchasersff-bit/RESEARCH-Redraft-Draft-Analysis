import { Info } from "lucide-react";

interface Props {
  takeaways?: string[];
}

export function Takeaways({ takeaways }: Props) {
  if (!takeaways || takeaways.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <Info className="h-4 w-4 text-accent" />
        Key Takeaways
      </h4>
      <ul className="space-y-1.5">
        {takeaways.map((t, i) => (
          <li
            key={i}
            className="text-sm text-muted-foreground pl-4 border-l-2 border-accent/40"
          >
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
