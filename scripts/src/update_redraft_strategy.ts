/**
 * update_redraft_strategy.ts
 *
 * Main entry point. Orchestrates fetch + analyze + export.
 *
 * Usage:
 *   npx tsx scripts/src/update_redraft_strategy.ts
 *   npx tsx scripts/src/update_redraft_strategy.ts --refresh
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readInputCsv, fetchAllDataForLeague, fetchNflPlayers } from "./fetch_sleeper_redraft_data.js";
import { analyzeAll } from "./analyze_redraft_strategy.js";
import type { FetchedLeagueData } from "./fetch_sleeper_redraft_data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");
const OUTPUT_DIR = path.join(ROOT, "data/output");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeOutput(filename: string, data: unknown) {
  const file = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`  ✓ Written: data/output/${filename}`);
}

async function main() {
  console.log("\n══════════════════════════════════════════════");
  console.log("  StatChasers Redraft Strategy Analyzer");
  console.log("══════════════════════════════════════════════\n");

  ensureDir(OUTPUT_DIR);

  // Step 1: Read input CSV
  console.log("Step 1: Reading league input CSV...");
  let leagues: ReturnType<typeof readInputCsv>;
  try {
    leagues = readInputCsv();
    console.log(`  Found ${leagues.length} leagues.\n`);
  } catch (err) {
    console.error(`  ERROR: ${(err as Error).message}`);
    process.exit(1);
  }

  // Step 2: Fetch NFL players (used to enrich draft picks)
  console.log("Step 2: Fetching NFL player data...");
  let nflPlayers: Record<string, { full_name?: string; position?: string; team?: string }> = {};
  try {
    nflPlayers = await fetchNflPlayers();
    const playerCount = Object.keys(nflPlayers).length;
    console.log(`  Loaded ${playerCount} NFL players.\n`);
  } catch (err) {
    console.warn(`  WARNING: Could not fetch NFL players: ${(err as Error).message}`);
    console.warn("  Will proceed with pick metadata only.\n");
  }

  // Step 3: Fetch raw data for all leagues
  console.log("Step 3: Fetching Sleeper league data...");
  const fetchResults: Array<{
    data: FetchedLeagueData | null;
    input: typeof leagues[number];
    error?: string;
  }> = [];

  for (const league of leagues) {
    process.stdout.write(`  League ${league.league_id} (${league.season})... `);
    try {
      const data = await fetchAllDataForLeague(league);
      fetchResults.push({ data, input: league });
      console.log("✓");
    } catch (err) {
      const message = (err as Error).message;
      fetchResults.push({ data: null, input: league, error: message });
      console.log(`✗ ${message}`);
    }
  }
  console.log();

  // Step 4: Analyze
  console.log("Step 4: Analyzing draft strategies...\n");
  const result = analyzeAll(fetchResults, nflPlayers);

  // Step 5: Write outputs
  console.log("Step 5: Writing output files...");
  writeOutput("redraft_strategy_summary.json", result.summary);
  writeOutput("redraft_strategy_by_slot.json", result.bySlot);
  writeOutput("redraft_strategy_by_format.json", result.byFormat);
  writeOutput("redraft_first_two_pick_combos.json", result.firstTwoPicks);
  writeOutput("redraft_first_five_builds.json", result.firstFiveBuilds);
  writeOutput("redraft_round_value.json", result.roundValue);
  writeOutput("redraft_strategy_recommendations.json", result.recommendations);
  writeOutput("redraft_strategy_league_audit.json", result.audit);

  const auditData = result.audit as {
    total_leagues: number;
    succeeded: number;
    skipped: number;
    failed: number;
  };

  console.log(`
══════════════════════════════════════════════
  Done!

  Leagues processed : ${auditData.total_leagues}
  Succeeded         : ${auditData.succeeded}
  Skipped           : ${auditData.skipped}
  Failed            : ${auditData.failed}

  Output: data/output/
══════════════════════════════════════════════
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
