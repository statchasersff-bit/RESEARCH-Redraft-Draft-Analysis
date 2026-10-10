/**
 * Copies pre-computed data files into dist/public/data/ for the Replit
 * static preview build. Run this AFTER vite build --config vite.config.static.ts.
 */
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DATA_OUTPUT = path.join(ROOT, "data/output");
const DATA_RAW_PICKS = path.join(ROOT, "data/raw/sleeper/picks");

// Accept an optional output directory as a CLI argument so this script can
// populate both dist/public/data (production build) and public/data (dev mode).
const outArg = process.argv[2];
const STATIC_DATA_DIR = outArg
  ? path.resolve(ROOT, outArg)
  : path.join(ROOT, "artifacts/stat-chasers/dist/public/data");

const CURATED_DRAFTS: { id: string; label: string }[] = [
  { id: "1036810729875275776", label: "12-Team PPR · Slot 1 goes Robust RB" },
  { id: "1040373379007639552", label: "12-Team PPR · Mixed strategies" },
  { id: "1044042872896557056", label: "12-Team PPR · Hero RB & Zero RB clash" },
  { id: "1038894729859059712", label: "10-Team PPR · Robust RB dominates" },
  { id: "1040014433634103296", label: "10-Team PPR · WR Heavy opens round 1" },
  { id: "1042510591354609664", label: "10-Team PPR · Late QB experiment" },
  { id: "1043638188797075456", label: "10-Team PPR · Balanced field" },
];

const DATA_FILES: { src: string; dest: string }[] = [
  { src: "redraft_strategy_summary.json",        dest: "redraft_strategy_summary.json" },
  { src: "redraft_round_value.json",              dest: "redraft_round_value.json" },
  { src: "redraft_strategy_recommendations.json", dest: "redraft_strategy_recommendations.json" },
  { src: "redraft_negative_strategies.json",      dest: "redraft_negative_strategies.json" },
  { src: "redraft_playoff_miss_risk.json",        dest: "redraft_playoff_miss_risk.json" },
  { src: "redraft_by_filter_trends.json",         dest: "redraft_by_filter_trends.json" },
];

function detectStrategy(picks: any[], slot: number): string {
  const early = picks.filter((p) => p.draft_slot === slot && p.round <= 5);
  const rbs = early.filter((p) => p.metadata.position === "RB").length;
  const wrs = early.filter((p) => p.metadata.position === "WR").length;
  const qbRounds = picks.filter((p) => p.draft_slot === slot && p.metadata.position === "QB").map((p) => p.round as number);
  const teRounds = picks.filter((p) => p.draft_slot === slot && p.metadata.position === "TE").map((p) => p.round as number);
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

function buildDraftBoards(): object[] {
  return CURATED_DRAFTS.map((draft, index) => {
    const picksFile = path.join(DATA_RAW_PICKS, `${draft.id}_picks.json`);
    if (!fs.existsSync(picksFile)) {
      console.warn(`  ⚠  Missing picks file for draft ${draft.id} — skipping`);
      return null;
    }
    const rawPicks: any[] = JSON.parse(fs.readFileSync(picksFile, "utf8"));
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
      name: `${p.metadata.first_name} ${p.metadata.last_name}`,
      position: p.metadata.position as string,
      nfl_team: p.metadata.team as string,
    }));
    return { draft_id: draft.id, label: draft.label, index, total: CURATED_DRAFTS.length, num_teams: slots.length, num_rounds: new Set(rawPicks.map((p) => p.round)).size, strategies, picks };
  }).filter(Boolean);
}

console.log("\nPreparing static preview data...");

fs.mkdirSync(STATIC_DATA_DIR, { recursive: true });

// Copy flat data files
for (const { src, dest } of DATA_FILES) {
  const srcPath = path.join(DATA_OUTPUT, src);
  if (!fs.existsSync(srcPath)) {
    console.warn(`  ⚠  Missing: ${src} — skipping`);
    continue;
  }
  fs.copyFileSync(srcPath, path.join(STATIC_DATA_DIR, dest));
  const kb = Math.round(fs.statSync(srcPath).size / 1024);
  console.log(`  ✓ Copied ${dest} (${kb} KB)`);
}

// Split filter-combos into per-key files
const combosFile = path.join(DATA_OUTPUT, "redraft_by_filter_combo.json");
if (fs.existsSync(combosFile)) {
  const combosData = JSON.parse(fs.readFileSync(combosFile, "utf8")) as { combos: Record<string, unknown> };
  const combosDir = path.join(STATIC_DATA_DIR, "combos");
  fs.mkdirSync(combosDir, { recursive: true });
  let count = 0;
  for (const [key, value] of Object.entries(combosData.combos)) {
    fs.writeFileSync(path.join(combosDir, `${key}.json`), JSON.stringify(value));
    count++;
  }
  console.log(`  ✓ Split filter-combos into ${count} files under data/combos/`);
} else {
  console.warn("  ⚠  Missing: redraft_by_filter_combo.json — skipping combo split");
}

// Pre-compute draft boards
try {
  const boards = buildDraftBoards();
  fs.writeFileSync(path.join(STATIC_DATA_DIR, "redraft_draft_boards.json"), JSON.stringify(boards));
  console.log(`  ✓ Written redraft_draft_boards.json (${boards.length} boards)`);
} catch (e) {
  console.warn(`  ⚠  Could not build draft boards: ${e}`);
}

console.log("  Done! Static data ready at dist/public/data/\n");
