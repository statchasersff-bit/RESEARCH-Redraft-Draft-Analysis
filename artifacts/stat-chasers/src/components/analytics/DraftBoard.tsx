import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  badgeColor,
  shellColor,
  abbreviateFirstName,
  initialsOf,
} from "@/lib/adpColors";
import { useGetRedraftDraftBoard } from "@workspace/api-client-react";
import type {
  BoardPick,
  GetRedraftDraftBoardSize,
  GetRedraftDraftBoardScoring,
  GetRedraftDraftBoardQbType,
} from "@workspace/api-client-react";

export interface DraftBoardFilters {
  qb: string;
  scoring: string;
  size: string;
}

interface Props {
  filters?: DraftBoardFilters;
}

const MAX_ROUNDS_SHOWN = 20;

export default function DraftBoard({ filters }: Props) {
  const [boardIndex, setBoardIndex] = useState(0);
  const [activeStrategy, setActiveStrategy] = useState<string>("");

  const sizeParam = filters?.size as GetRedraftDraftBoardSize | undefined;
  const scoringParam = filters?.scoring as GetRedraftDraftBoardScoring | undefined;
  const qbTypeParam = filters?.qb as GetRedraftDraftBoardQbType | undefined;

  // Reset to first board whenever filters change
  useEffect(() => {
    setBoardIndex(0);
    setActiveStrategy("");
  }, [sizeParam, scoringParam, qbTypeParam]);

  const { data, isLoading } = useGetRedraftDraftBoard({
    index: boardIndex,
    size: sizeParam,
    scoring: scoringParam,
    qb_type: qbTypeParam,
  });

  const strategies = data?.strategies ?? [];
  const chosen = activeStrategy || strategies[0]?.strategy;
  const activeSlots = useMemo(
    () => new Set(strategies.filter((s) => s.strategy === chosen).map((s) => s.slot)),
    [strategies, chosen],
  );

  const total = data?.total ?? 1;

  const handlePrev = () => {
    setBoardIndex((i) => Math.max(0, i - 1));
    setActiveStrategy("");
  };
  const handleNext = () => {
    setBoardIndex((i) => Math.min(total - 1, i + 1));
    setActiveStrategy("");
  };

  // Real snake grid, keyed by the actual (round, slot) — NOT re-sorted by ADP.
  const grid = useMemo(() => {
    const g = new Map<number, Map<number, BoardPick>>();
    for (const pick of data?.picks ?? []) {
      if (pick.round > MAX_ROUNDS_SHOWN) continue;
      if (!g.has(pick.round)) g.set(pick.round, new Map());
      g.get(pick.round)!.set(pick.slot, pick);
    }
    return g;
  }, [data]);

  // Positional draft rank (3rd RB off the board → "RB3"), keyed by overall pick_no.
  const posRankByPick = useMemo(() => {
    const m = new Map<number, number>();
    const counts: Record<string, number> = {};
    [...(data?.picks ?? [])]
      .sort((a, b) => a.pick_no - b.pick_no)
      .forEach((p) => {
        counts[p.position] = (counts[p.position] ?? 0) + 1;
        m.set(p.pick_no, counts[p.position]);
      });
    return m;
  }, [data]);

  const { ref: gridRef, width: containerW } = useContainerWidth<HTMLDivElement>();
  // Track viewport width live so the label-column width, min cell size and
  // initials-only name mode stay correct across resize / device rotation.
  const [viewportW, setViewportW] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isMobile = viewportW < 640;
  const veryCompactNames = viewportW < 400;

  if (isLoading) {
    return (
      <div className="rounded-[14px] border border-card-border bg-card p-6">
        <div className="h-5 w-48 animate-pulse rounded bg-muted mb-4" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!data) return null;

  const numTeams = data.num_teams;
  const totalRounds = Math.min(data.num_rounds, MAX_ROUNDS_SHOWN);
  const slots = Array.from({ length: numTeams }, (_, i) => i + 1);

  // Column sizing — fixed pixel widths measured from the container.
  // Columns always expand to fill the full container width (no max cap), so the
  // board never leaves trailing whitespace on the right. MIN_CELL_W only applies
  // when the container is too narrow, in which case the board scrolls horizontally.
  const labelColW = isMobile ? 30 : 34;
  const MIN_CELL_W = isMobile ? 80 : 82;
  // Exact fractional width (no floor) so labelColW + numTeams * cellW === containerW,
  // leaving zero trailing whitespace. MIN_CELL_W only applies when the container is
  // too narrow to fit every column, in which case the board scrolls horizontally.
  const cellW =
    containerW <= 0
      ? isMobile
        ? 84
        : 104
      : Math.max(MIN_CELL_W, (containerW - labelColW) / numTeams);
  const cellH = Math.max(50, Math.min(70, Math.round(cellW * 0.56)));

  // Strategy → slots, for the tab pills.
  const strategyGroups = Array.from(
    strategies.reduce((map, s) => {
      const list = map.get(s.strategy) ?? [];
      map.set(s.strategy, [...list, s.slot]);
      return map;
    }, new Map<string, number[]>()),
  );

  return (
    <>
      {/* ── Module header: strategy selector + carousel on one row ───────────── */}
      <div className="rs-app-board-module mb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          {/* Strategy selector */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
              Strategy examples
            </p>
            <Select value={chosen} onValueChange={setActiveStrategy}>
              <SelectTrigger className="h-7 w-full sm:w-[255px] px-2.5 py-1 text-xs">
                <SelectValue placeholder="Select a strategy" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                {strategyGroups.map(([strategyName, groupSlots]) => {
                  const slotLabel =
                    groupSlots.length === 1
                      ? `Slot ${groupSlots[0]}`
                      : `Slots ${[...groupSlots].sort((a, b) => a - b).join(", ")}`;
                  return (
                    <SelectItem key={strategyName} value={strategyName} className="py-1 pr-7 text-xs">
                      <span className="text-foreground">{strategyName}</span>
                      <span className="text-muted-foreground"> · {slotLabel}</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Carousel */}
          <div className="flex items-center gap-1.5 flex-shrink-0 self-start sm:self-auto">
            <span className="text-xs font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
              Draft Board {boardIndex + 1} of {total}
            </span>
            <button
              onClick={handlePrev}
              disabled={boardIndex === 0}
              className="p-1.5 rounded-lg border border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous draft example"
            >
              <ChevronLeft className="h-4 w-4 text-foreground" />
            </button>
            <button
              onClick={handleNext}
              disabled={boardIndex === total - 1}
              className="p-1.5 rounded-lg border border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next draft example"
            >
              <ChevronRight className="h-4 w-4 text-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Board surface: grid + legend ──────────────────────────────────── */}
      <div className="rs-app-board-surface rounded-lg border-2 border-border overflow-hidden">
      {/* Board — horizontally scrollable */}
      <div ref={gridRef} className="overflow-x-auto overflow-y-hidden">
        <div className="inline-block min-w-full">
          {/* Slot header row */}
          <div className="flex sticky top-0 z-30 bg-card border-b border-[var(--adp-hairline)]">
            <div
              className="sticky left-0 z-40 flex items-center justify-center text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--rs-app-text-muted)] border-r border-[var(--adp-hairline)] bg-card"
              style={{ width: labelColW, height: 22, flexShrink: 0 }}
            >
              R
            </div>
            {slots.map((slot) => {
              const isMe = activeSlots.has(slot);
              return (
                <div
                  key={slot}
                  className={cn(
                    "flex items-center justify-center gap-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] border-r border-[var(--adp-hairline)]",
                    isMe ? "bg-primary text-primary-foreground" : "text-[var(--rs-app-text-muted)]",
                  )}
                  style={{ width: cellW, height: 22, flexShrink: 0 }}
                >
                  {isMe && <Star className="h-2.5 w-2.5 fill-current" />}
                  Slot {slot}
                </div>
              );
            })}
          </div>

          {/* Round rows */}
          {Array.from({ length: totalRounds }, (_, rIdx) => {
            const round = rIdx + 1;
            const isOdd = round % 2 === 1;
            const rowPicks = grid.get(round);
            const isStrategyRound = round <= 5;
            return (
              <div
                key={round}
                className={cn(
                  "flex",
                  round > 1 && "border-t border-[var(--adp-hairline)]",
                  round % 2 === 0 && "bg-black/[0.015] dark:bg-white/[0.015]",
                  round === 5 && "border-b-2 border-b-accent/30",
                )}
              >
                <div
                  className="sticky left-0 z-20 flex items-center justify-center border-r border-[var(--adp-hairline)] bg-card"
                  style={{ width: labelColW, flexShrink: 0, minHeight: cellH }}
                >
                  <span
                    className={cn(
                      "text-[9px] font-bold uppercase tracking-[0.18em] tabular-nums",
                      isStrategyRound ? "text-accent" : "text-[var(--rs-app-text-muted)]",
                    )}
                  >
                    R{round}
                  </span>
                </div>
                {slots.map((slot) => {
                  const pick = rowPicks?.get(slot) ?? null;
                  // Snake in-round pick order for the "1.01" label.
                  const pickInRound = pick
                    ? pick.pick_no - (round - 1) * numTeams
                    : isOdd
                      ? slot
                      : numTeams - slot + 1;
                  return (
                    <DraftPickCell
                      key={slot}
                      pick={pick}
                      round={round}
                      pickInRound={pickInRound}
                      positionalRank={pick ? posRankByPick.get(pick.pick_no) : undefined}
                      width={cellW}
                      height={cellH}
                      featured={activeSlots.has(slot)}
                      veryCompactNames={veryCompactNames}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      </div>
    </>
  );
}

function DraftPickCell({
  pick,
  round,
  pickInRound,
  positionalRank,
  width,
  height,
  featured,
  veryCompactNames,
}: {
  pick: BoardPick | null;
  round: number;
  pickInRound: number;
  positionalRank?: number;
  width: number;
  height: number;
  featured: boolean;
  veryCompactNames: boolean;
}) {
  const pickLabel = `${round}.${String(pickInRound).padStart(2, "0")}`;
  const nameFontPx = Math.max(10, Math.min(13, Math.round(width * 0.115)));
  const metaFontPx = Math.max(7, Math.min(10, Math.round(width * 0.085)));

  const FEATURED_RING = "inset 0 0 0 2px rgba(212,175,55,0.55)";

  // Empty / future slot — keeps pick numbers anchored.
  if (!pick) {
    return (
      <div className="p-px" style={{ width, minHeight: height, flexShrink: 0 }}>
        <div
          className="w-full h-full rounded-[2px] bg-[var(--adp-surface)] flex items-center justify-between px-1.5 border border-[var(--adp-hairline)]"
          style={featured ? { boxShadow: FEATURED_RING } : undefined}
        >
          <ChevronRight className="w-3 h-3 text-[var(--rs-app-text-muted)] opacity-40" />
          <span
            className="font-semibold tabular-nums text-[var(--rs-app-text-muted)] opacity-50"
            style={{ fontSize: metaFontPx }}
          >
            {pickLabel}
          </span>
        </div>
      </div>
    );
  }

  const shell = shellColor(pick.position);
  const badge = badgeColor(pick.position);
  const posTeam = `${pick.position}${pick.nfl_team ? ` · ${pick.nfl_team}` : ""}`;
  const rankLabel =
    positionalRank != null ? `${pick.position}${positionalRank}` : pick.position;

  return (
    <div className="p-px" style={{ width, minHeight: height, flexShrink: 0 }}>
      <div
        className="group relative w-full h-full rounded-[3px] overflow-hidden transition-all duration-150 hover:-translate-y-px hover:z-10"
        style={{
          background: `linear-gradient(${shell.tint}, ${shell.tint}), var(--adp-tile)`,
          boxShadow: featured
            ? `${FEATURED_RING}, inset 0 0 0 3px ${shell.border}`
            : `inset 0 0 0 1px ${shell.border}`,
        }}
        title={`${pickLabel} · ${pick.name} · ${rankLabel}`}
      >
        {/* Hover wash + glow */}
        <div
          className="absolute inset-0 rounded-[3px] transition-opacity duration-200 opacity-0 group-hover:opacity-100 pointer-events-none"
          style={{
            background: `linear-gradient(${shell.hoverTint}, ${shell.hoverTint})`,
            boxShadow: `inset 0 0 0 1.5px ${shell.hoverBorder}, inset 0 0 14px ${shell.glow}`,
          }}
        />
        {/* Top-left: position rank */}
        <span
          className={cn(
            "absolute top-[3px] left-1 px-1 py-px rounded border font-bold uppercase tracking-wider leading-none bg-[var(--adp-overlay)]",
            badge.text,
            badge.border,
          )}
          style={{ fontSize: metaFontPx }}
        >
          {rankLabel}
        </span>
        {/* Top-right: pick number */}
        <span
          className="absolute top-[3px] right-1 px-1 py-[1px] rounded-[3px] bg-[var(--adp-overlay)] font-bold tabular-nums text-[var(--rs-app-text)] leading-none"
          style={{ fontSize: metaFontPx }}
        >
          {pickLabel}
        </span>
        {/* Player name */}
        <div className="absolute inset-x-1 top-[16px] bottom-[14px] flex items-center pr-[30px]">
          <span
            className="block w-full font-bold text-[var(--rs-app-text)] leading-[1.05] tracking-tight line-clamp-2"
            style={{ fontSize: nameFontPx }}
            title={pick.name}
          >
            {abbreviateFirstName(pick.name, veryCompactNames)}
          </span>
        </div>
        {/* Bottom-left: pos · team */}
        <span
          className="absolute bottom-[3px] left-1 font-semibold uppercase tracking-wider leading-none truncate max-w-[60%] text-[var(--rs-app-text-muted)]"
          style={{ fontSize: metaFontPx }}
        >
          {posTeam}
        </span>
        {/* Bottom-right: headshot */}
        <div className="absolute bottom-0.5 right-0.5">
          <PlayerImageCircle playerId={pick.player_id} name={pick.name} />
        </div>
      </div>
    </div>
  );
}

function PlayerImageCircle({ playerId, name }: { playerId: string; name: string }) {
  const [imgErr, setImgErr] = useState(false);
  const showImage = !imgErr && !!playerId;
  return (
    <div
      className="w-[26px] h-[26px] sm:w-8 sm:h-8 rounded-full overflow-hidden bg-[var(--adp-surface)] flex items-center justify-center"
      style={{ boxShadow: "inset 0 0 0 1px var(--adp-hairline)" }}
    >
      {showImage ? (
        <img
          src={`https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`}
          alt={name}
          className="w-full h-full object-cover object-top"
          onError={() => setImgErr(true)}
        />
      ) : (
        <span className="text-[9px] font-bold text-[var(--rs-app-text-muted)]">
          {initialsOf(name)}
        </span>
      )}
    </div>
  );
}
