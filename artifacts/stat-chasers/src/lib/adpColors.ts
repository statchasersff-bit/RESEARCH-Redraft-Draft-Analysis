// Position color maps + tiny name helpers for the tile-based draft board (DraftBoard).
// Colors are entirely position-driven; everything else is a neutral theme token.

export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "PICK";

type BadgeColor = { text: string; border: string };
type ShellColor = {
  tint: string;
  border: string;
  hoverTint: string;
  hoverBorder: string;
  glow: string;
};

// Tailwind classes for the position-rank pill (text + border).
const BADGE: Record<Position, BadgeColor> = {
  QB:   { text: "text-rose-600 dark:text-rose-300",       border: "border-rose-400 dark:border-rose-500/40" },
  RB:   { text: "text-emerald-600 dark:text-emerald-300", border: "border-emerald-400 dark:border-emerald-500/40" },
  WR:   { text: "text-sky-600 dark:text-sky-300",         border: "border-sky-400 dark:border-sky-500/40" },
  TE:   { text: "text-amber-600 dark:text-amber-300",     border: "border-amber-400 dark:border-amber-500/40" },
  K:    { text: "text-purple-600 dark:text-purple-300",   border: "border-purple-400 dark:border-purple-500/40" },
  PICK: { text: "text-[#b8901f] dark:text-[#d4af37]",     border: "border-[#d4af37]/40" },
};

// Raw rgba strings fed into inline linear-gradient / boxShadow for the tile wash.
const SHELL: Record<Position, ShellColor> = {
  QB:   { tint: "rgba(244,63,94,0.12)",  border: "rgba(244,63,94,0.28)",  hoverTint: "rgba(244,63,94,0.28)",  hoverBorder: "rgba(244,63,94,0.85)",  glow: "rgba(244,63,94,0.45)" },
  RB:   { tint: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.28)", hoverTint: "rgba(16,185,129,0.28)", hoverBorder: "rgba(16,185,129,0.85)", glow: "rgba(16,185,129,0.45)" },
  WR:   { tint: "rgba(14,165,233,0.12)", border: "rgba(14,165,233,0.28)", hoverTint: "rgba(14,165,233,0.28)", hoverBorder: "rgba(14,165,233,0.85)", glow: "rgba(14,165,233,0.45)" },
  TE:   { tint: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.28)", hoverTint: "rgba(245,158,11,0.28)", hoverBorder: "rgba(245,158,11,0.85)", glow: "rgba(245,158,11,0.45)" },
  K:    { tint: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.28)", hoverTint: "rgba(168,85,247,0.28)", hoverBorder: "rgba(168,85,247,0.85)", glow: "rgba(168,85,247,0.45)" },
  PICK: { tint: "rgba(212,175,55,0.14)", border: "rgba(212,175,55,0.32)", hoverTint: "rgba(212,175,55,0.32)", hoverBorder: "rgba(212,175,55,0.9)",  glow: "rgba(212,175,55,0.55)" },
};

// Neutral slate fallback for positions the maps don't cover (DEF/DST, DL, LB, DB…).
const NEUTRAL_BADGE: BadgeColor = { text: "text-slate-500 dark:text-slate-300", border: "border-slate-400 dark:border-slate-500/40" };
const NEUTRAL_SHELL: ShellColor = {
  tint: "rgba(100,116,139,0.10)", border: "rgba(100,116,139,0.26)",
  hoverTint: "rgba(100,116,139,0.24)", hoverBorder: "rgba(100,116,139,0.8)", glow: "rgba(100,116,139,0.4)",
};

// Real draft boards include more positions than the six tinted ones — look up with a
// neutral fallback so K/DEF/IDP tiles still render cleanly.
export function badgeColor(position: string): BadgeColor {
  return BADGE[position as Position] ?? NEUTRAL_BADGE;
}
export function shellColor(position: string): ShellColor {
  return SHELL[position as Position] ?? NEUTRAL_SHELL;
}

// Exposed for the legend.
export const LEGEND_POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K"];

export function abbreviateFirstName(name: string, veryCompact = false): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts.slice(1).join(" ");
  if (veryCompact) return parts.map((p) => p[0]).join("").toUpperCase();
  return `${parts[0][0]}. ${last}`;
}

export function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[p.length - 1]?.[0] ?? "")).toUpperCase();
}
