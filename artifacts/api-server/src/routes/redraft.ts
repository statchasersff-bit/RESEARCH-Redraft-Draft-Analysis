import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, "../../../data/output");
const RAW_PICKS_DIR = path.resolve(__dirname, "../../../data/raw/sleeper/picks");

const router = Router();

function readOutputFile(filename: string): unknown | null {
  const file = path.join(OUTPUT_DIR, filename);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function serveOutput(filename: string) {
  return (_req: Request, res: Response) => {
    const data = readOutputFile(filename);
    if (!data) {
      res.status(404).json({
        error: "not_found",
        message: `No data available yet. Run 'pnpm run redraft:update' to generate output files.`,
      });
      return;
    }
    res.json(data);
  };
}

router.get("/redraft/summary", serveOutput("redraft_strategy_summary.json"));
router.get("/redraft/by-slot", serveOutput("redraft_strategy_by_slot.json"));
router.get("/redraft/by-format", serveOutput("redraft_strategy_by_format.json"));
router.get("/redraft/first-two-picks", serveOutput("redraft_first_two_pick_combos.json"));
router.get("/redraft/first-five-builds", serveOutput("redraft_first_five_builds.json"));
router.get("/redraft/round-value", serveOutput("redraft_round_value.json"));
router.get("/redraft/recommendations", serveOutput("redraft_strategy_recommendations.json"));
router.get("/redraft/league-audit", serveOutput("redraft_strategy_league_audit.json"));
router.get("/redraft/negative-strategies", serveOutput("redraft_negative_strategies.json"));
router.get("/redraft/playoff-miss-risk", serveOutput("redraft_playoff_miss_risk.json"));
// In-memory cache for the large filter-combos file so we don't re-parse 12 MB on every request
let _filterCombosCache: { data: any; mtime: number } | null = null;
function getFilterCombosData(): any | null {
  const file = path.join(OUTPUT_DIR, "redraft_by_filter_combo.json");
  if (!fs.existsSync(file)) return null;
  const mtime = fs.statSync(file).mtimeMs;
  if (!_filterCombosCache || _filterCombosCache.mtime !== mtime) {
    try {
      _filterCombosCache = { data: JSON.parse(fs.readFileSync(file, "utf-8")), mtime };
    } catch {
      return null;
    }
  }
  return _filterCombosCache.data;
}

router.get("/redraft/filter-combos", (req: Request, res: Response) => {
  const data = getFilterCombosData();
  if (!data) {
    res.status(404).json({ error: "not_found", message: "No data available yet. Run 'pnpm run redraft:update' to generate output files." });
    return;
  }
  const keyParam = req.query.key as string | undefined;
  if (!keyParam) {
    res.json(data);
    return;
  }
  const keys = keyParam.split(",").map((k) => k.trim()).filter(Boolean);
  const filteredCombos: Record<string, any> = {};
  for (const k of keys) {
    if (data.combos[k] !== undefined) filteredCombos[k] = data.combos[k];
  }
  res.json({ generated_at: data.generated_at, combos: filteredCombos });
});
router.get("/redraft/filter-trends", serveOutput("redraft_by_filter_trends.json"));
router.get("/redraft/draft-examples", serveOutput("redraft_draft_examples.json"));

type QbType = "one_qb" | "superflex";
type ScoringType = "ppr" | "half_ppr" | "standard";

interface CuratedDraft {
  id: string;
  label: string;
  size: 10 | 12;
  scoring: ScoringType;
  qb_type: QbType;
}

// Curated list of real Sleeper draft IDs with descriptive labels.
// All verified from cached picks files: teams × rounds noted.
const CURATED_DRAFTS: CuratedDraft[] = [
  // 12-team PPR 1QB
  { id: "1036810729875275776", label: "12-Team PPR · Slot 1 goes Robust RB", size: 12, scoring: "ppr", qb_type: "one_qb" },
  { id: "1040373379007639552", label: "12-Team PPR · Mixed strategies", size: 12, scoring: "ppr", qb_type: "one_qb" },
  { id: "1044042872896557056", label: "12-Team PPR · Hero RB & Zero RB clash", size: 12, scoring: "ppr", qb_type: "one_qb" },
  // 10-team PPR 1QB
  { id: "1038894729859059712", label: "10-Team PPR · Robust RB dominates", size: 10, scoring: "ppr", qb_type: "one_qb" },
  { id: "1040014433634103296", label: "10-Team PPR · WR Heavy opens round 1", size: 10, scoring: "ppr", qb_type: "one_qb" },
  { id: "1042510591354609664", label: "10-Team PPR · Late QB experiment", size: 10, scoring: "ppr", qb_type: "one_qb" },
  { id: "1043638188797075456", label: "10-Team PPR · Balanced field", size: 10, scoring: "ppr", qb_type: "one_qb" },
  // 12-team Superflex
  { id: "1156399235006459904", label: "12-Team Superflex · QB run starts early", size: 12, scoring: "ppr", qb_type: "superflex" },
  { id: "1150986269871382528", label: "12-Team Superflex · Mixed QB timing", size: 12, scoring: "ppr", qb_type: "superflex" },
  // 10-team Superflex
  { id: "1146884017845837824", label: "10-Team Superflex · Double QB builds", size: 10, scoring: "ppr", qb_type: "superflex" },
  { id: "1143836913158332416", label: "10-Team Superflex · Late QB still viable", size: 10, scoring: "ppr", qb_type: "superflex" },
  // 12-team Half PPR
  { id: "1126621733789741057", label: "12-Team Half PPR · RB-heavy field", size: 12, scoring: "half_ppr", qb_type: "one_qb" },
  { id: "1119496673396375552", label: "12-Team Half PPR · Zero RB experiment", size: 12, scoring: "half_ppr", qb_type: "one_qb" },
  // 10-team Half PPR
  { id: "1136702966175682560", label: "10-Team Half PPR · Balanced builds", size: 10, scoring: "half_ppr", qb_type: "one_qb" },
  { id: "1154100073262014464", label: "10-Team Half PPR · WR Heavy start", size: 10, scoring: "half_ppr", qb_type: "one_qb" },
];

function detectStrategy(picks: any[], slot: number): string {
  const early = picks.filter((p) => p.draft_slot === slot && p.round <= 5);
  const rbs = early.filter((p) => p.metadata.position === "RB").length;
  const wrs = early.filter((p) => p.metadata.position === "WR").length;
  const qbRounds = picks
    .filter((p) => p.draft_slot === slot && p.metadata.position === "QB")
    .map((p) => p.round);
  const teRounds = picks
    .filter((p) => p.draft_slot === slot && p.metadata.position === "TE")
    .map((p) => p.round);
  const firstQB = qbRounds.length ? Math.min(...qbRounds) : 99;
  const firstTE = teRounds.length ? Math.min(...teRounds) : 99;

  const parts: string[] = [];

  if (rbs === 0) parts.push("Zero RB");
  else if (rbs === 1) parts.push("Hero RB");
  else if (rbs >= 3) parts.push("Robust RB");
  else parts.push("Balanced");

  if (wrs >= 3) parts.push("WR Heavy");
  if (firstQB <= 4) parts.push("Elite QB");
  if (firstTE <= 2) parts.push("Elite TE");
  if (firstQB >= 8) parts.push("Late QB");

  return parts.join(" + ");
}

router.get("/redraft/draft-board", (req: Request, res: Response) => {
  const sizeParam = req.query.size as string | undefined;
  const scoringParam = req.query.scoring as string | undefined;
  const qbTypeParam = req.query.qb_type as string | undefined;

  // Build filtered list — apply each filter only if the param was provided.
  // Cascade fallback: exact match → size+scoring match → size-only match → all drafts.
  let pool = CURATED_DRAFTS;
  if (sizeParam || scoringParam || qbTypeParam) {
    const sizeNum = sizeParam ? parseInt(sizeParam, 10) : undefined;

    // Exact match
    let exact = pool.filter((d) => {
      if (sizeNum && d.size !== sizeNum) return false;
      if (scoringParam && d.scoring !== scoringParam) return false;
      if (qbTypeParam && d.qb_type !== qbTypeParam) return false;
      return true;
    });

    if (exact.length > 0) {
      pool = exact;
    } else {
      // Fallback 1: size + qb_type (ignore scoring)
      let fallback1 = CURATED_DRAFTS.filter((d) => {
        if (sizeNum && d.size !== sizeNum) return false;
        if (qbTypeParam && d.qb_type !== qbTypeParam) return false;
        return true;
      });
      if (fallback1.length > 0) {
        pool = fallback1;
      } else {
        // Fallback 2: size only
        const fallback2 = sizeNum ? CURATED_DRAFTS.filter((d) => d.size === sizeNum) : [];
        pool = fallback2.length > 0 ? fallback2 : CURATED_DRAFTS;
      }
    }
  }

  const rawIndex = parseInt((req.query.index as string) ?? "0", 10);
  const index = isNaN(rawIndex) || rawIndex < 0 ? 0 : Math.min(rawIndex, pool.length - 1);
  const { id: draftId, label } = pool[index];

  const picksFile = path.join(RAW_PICKS_DIR, `${draftId}_picks.json`);
  if (!fs.existsSync(picksFile)) {
    res.status(404).json({ error: "not_found", message: `Picks cache not found for draft ${draftId}.` });
    return;
  }

  const rawPicks: any[] = JSON.parse(fs.readFileSync(picksFile, "utf-8"));
  const slots = Array.from(new Set(rawPicks.map((p) => p.draft_slot as number))).sort((a, b) => a - b);

  const strategies = slots.map((slot) => ({
    strategy: detectStrategy(rawPicks, slot),
    roster_id: rawPicks.find((p) => p.draft_slot === slot)?.roster_id ?? 0,
    slot,
  }));

  const picks = rawPicks.map((p) => ({
    round: p.round as number,
    slot: p.draft_slot as number,
    roster_id: p.roster_id as number,
    pick_no: p.pick_no as number,
    player_id: (p.player_id ?? p.metadata?.player_id ?? "") as string,
    name: `${p.metadata.first_name} ${p.metadata.last_name}`,
    position: p.metadata.position as string,
    nfl_team: p.metadata.team as string,
  }));

  res.json({
    draft_id: draftId,
    label,
    index,
    total: pool.length,
    num_teams: slots.length,
    num_rounds: new Set(rawPicks.map((p) => p.round)).size,
    strategies,
    picks,
  });
});

export default router;
