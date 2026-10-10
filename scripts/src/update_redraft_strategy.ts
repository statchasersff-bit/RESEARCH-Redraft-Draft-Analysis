/**
 * update_redraft_strategy.ts
 *
 * Streaming batch pipeline — loads leagues in large parallel batches,
 * extracts TeamRecords immediately, then discards raw data.
 * This keeps peak memory low and completes within the timeout.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run redraft:update          — full pipeline
 *   pnpm --filter @workspace/scripts run redraft:update:refresh  — full pipeline, force re-fetch
 *   pnpm --filter @workspace/scripts run redraft:analyze         — Steps 4–7 only (from cache)
 */

import fs from "fs";
import readline from "readline";
import path from "path";
import { fileURLToPath } from "url";
import {
  readInputCsv,
  fetchCoreDataForLeague,
  fetchNflPlayers,
} from "./fetch_sleeper_redraft_data.js";
import {
  validateLeague,
  buildTeamRecords,
  computeAnalysisFromTeams,
  computeAllFilteredCombos,
  computeTrendsOutput,
} from "./analyze_redraft_strategy.js";
import { analyzeNegativeStrategies } from "./analyze_negative_strategies.js";
import type { LeagueAuditEntry, TeamRecord } from "./analyze_redraft_strategy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");
const OUTPUT_DIR = path.join(ROOT, "data/output");
const TMP_DIR = path.join(ROOT, "data/tmp");
const TEAM_RECORDS_CACHE = path.join(TMP_DIR, "team_records_cache.json");
const TEAM_RECORDS_CACHE_TEAMS = path.join(TMP_DIR, "team_records_cache_teams.ndjson");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Read an NDJSON file line-by-line without loading the whole file as one string. */
async function loadNdjsonTeams(filePath: string): Promise<TeamRecord[]> {
  const teams: TeamRecord[] = [];
  if (!fs.existsSync(filePath)) return teams;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim()) teams.push(JSON.parse(line) as TeamRecord);
  }
  return teams;
}

function writeOutput(filename: string, data: unknown) {
  const file = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`  ✓ Written: data/output/${filename}`);
}

async function runFetchPhase(): Promise<{
  allTeams: TeamRecord[];
  auditEntries: LeagueAuditEntry[];
  processedSeasons: Set<string>;
  leaguesAnalyzed: number;
  totalLeagues: number;
}> {
  // Step 1: Read input CSV
  console.log("Step 1: Reading league input CSV...");
  const leagues = readInputCsv();
  console.log(`  Found ${leagues.length} leagues.\n`);

  // Step 2: Fetch NFL players
  console.log("Step 2: Fetching NFL player data...");
  let nflPlayers: Record<string, { full_name?: string; position?: string; team?: string }> = {};
  try {
    nflPlayers = await fetchNflPlayers();
    console.log(`  Loaded ${Object.keys(nflPlayers).length} NFL players.\n`);
  } catch (err) {
    console.warn(`  WARNING: Could not fetch NFL players: ${(err as Error).message}\n`);
  }

  // Step 3: Stream-process leagues, resuming from existing cache where possible.
  console.log("Step 3: Loading + analyzing Sleeper league data (streaming)...");

  const CONCURRENCY = 300;
  const SAVE_EVERY = 600; // save incremental cache every N leagues
  const allTeams: TeamRecord[] = [];
  const auditEntries: LeagueAuditEntry[] = [];
  const processedSeasons = new Set<string>();
  let leaguesAnalyzed = 0;
  let completed = 0;

  // Load existing cache to skip already-processed leagues
  // Format: team_records_cache.json (metadata + audit) + team_records_cache_teams.ndjson (one team/line)
  const processedLeagueIds = new Set<string>();
  // Track how many teams are already flushed to the NDJSON file so incremental
  // saves only APPEND new records rather than rewriting the whole file.
  let teamsWrittenCount = 0;

  if (fs.existsSync(TEAM_RECORDS_CACHE)) {
    try {
      const meta = JSON.parse(fs.readFileSync(TEAM_RECORDS_CACHE, "utf-8")) as {
        allTeams?: TeamRecord[];
        auditEntries: LeagueAuditEntry[];
        processedSeasons: string[];
      };
      // Load teams: prefer NDJSON sidecar, fall back to embedded allTeams (legacy)
      if (fs.existsSync(TEAM_RECORDS_CACHE_TEAMS)) {
        const loaded = await loadNdjsonTeams(TEAM_RECORDS_CACHE_TEAMS);
        for (const t of loaded) allTeams.push(t);
        teamsWrittenCount = allTeams.length;
      } else if (meta.allTeams) {
        for (const t of meta.allTeams) allTeams.push(t);
        // Legacy format — full rewrite needed on first save, so teamsWrittenCount stays 0
      }
      for (const a of meta.auditEntries) {
        auditEntries.push(a);
        processedLeagueIds.add(a.league_id);
      }
      for (const s of meta.processedSeasons) processedSeasons.add(s);
      leaguesAnalyzed = meta.auditEntries.filter((a) => a.status === "success").length;
      completed = processedLeagueIds.size;
      if (processedLeagueIds.size > 0) {
        console.log(`  Resuming from cache: ${processedLeagueIds.size} leagues already processed (${allTeams.length} team records).\n`);
      }
    } catch {
      console.warn("  Could not load existing cache — starting fresh.\n");
    }
  }

  function saveCache() {
    ensureDir(TMP_DIR);
    // Write metadata JSON (small — no allTeams embedded)
    const metaTmp = TEAM_RECORDS_CACHE + ".tmp";
    fs.writeFileSync(metaTmp, JSON.stringify({
      generated_at: new Date().toISOString(),
      total_leagues: leagues.length,
      leaguesAnalyzed,
      processedSeasons: Array.from(processedSeasons),
      auditEntries,
    }));
    fs.renameSync(metaTmp, TEAM_RECORDS_CACHE);
    // Append only NEW teams to NDJSON (avoids rewriting the whole file each save)
    if (allTeams.length > teamsWrittenCount) {
      const newTeams = allTeams.slice(teamsWrittenCount);
      const lines = newTeams.map(t => JSON.stringify(t)).join("\n") + "\n";
      fs.appendFileSync(TEAM_RECORDS_CACHE_TEAMS, lines);
      teamsWrittenCount = allTeams.length;
    }
  }

  const newLeagues = leagues.filter((l) => !processedLeagueIds.has(l.league_id));
  let newCompleted = 0;

  for (let i = 0; i < newLeagues.length; i += CONCURRENCY) {
    const batch = newLeagues.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (input) => {
        let data;
        try {
          data = await fetchCoreDataForLeague(input);
        } catch (err) {
          auditEntries.push({
            league_id: input.league_id,
            season: input.season,
            status: "failed",
            reason: (err as Error).message,
            notes: input.notes,
          });
          completed++;
          newCompleted++;
          return;
        }

        const league = data.league as Parameters<typeof validateLeague>[0];
        const validation = validateLeague(
          league,
          data.drafts,
          data.draftDetails as Parameters<typeof validateLeague>[2]
        );

        if (!validation.valid) {
          auditEntries.push({
            league_id: input.league_id,
            season: input.season,
            status: "skipped",
            reason: validation.reason,
            notes: input.notes,
          });
          completed++;
          newCompleted++;
          return;
        }

        let teams: TeamRecord[] = [];
        try {
          teams = buildTeamRecords(data, validation, nflPlayers);
        } catch (err) {
          auditEntries.push({
            league_id: input.league_id,
            season: input.season,
            status: "failed",
            reason: `buildTeamRecords: ${(err as Error).message}`,
            notes: input.notes,
          });
          completed++;
          newCompleted++;
          return;
        }

        if (teams.length === 0) {
          auditEntries.push({
            league_id: input.league_id,
            season: input.season,
            status: "skipped",
            reason: "No team records built (missing draft/roster data)",
            notes: input.notes,
          });
          completed++;
          newCompleted++;
          return;
        }

        allTeams.push(...teams);
        processedSeasons.add(input.season);
        leaguesAnalyzed++;
        auditEntries.push({
          league_id: input.league_id,
          season: input.season,
          status: "success",
          notes: input.notes,
        });
        completed++;
        newCompleted++;
      })
    );

    console.log(`  Processed ${completed}/${leagues.length} leagues...`);

    // Save incremental cache so restarts resume from here
    if (newCompleted % SAVE_EVERY === 0 || i + CONCURRENCY >= newLeagues.length) {
      saveCache();
    }
  }

  console.log(
    `  Done — ${leaguesAnalyzed} valid leagues → ${allTeams.length} team records.\n`
  );

  // Final cache write (saveCache already handles split format)
  saveCache();
  console.log(`  ✓ Team records cache written: data/tmp/team_records_cache.json\n`);

  return { allTeams, auditEntries, processedSeasons, leaguesAnalyzed, totalLeagues: leagues.length };
}

async function loadFromCache(): Promise<{
  allTeams: TeamRecord[];
  auditEntries: LeagueAuditEntry[];
  processedSeasons: Set<string>;
  leaguesAnalyzed: number;
  totalLeagues: number;
}> {
  if (!fs.existsSync(TEAM_RECORDS_CACHE)) {
    throw new Error(
      "No team records cache found. Run `pnpm run redraft:update` first to build the cache."
    );
  }
  console.log("Loading team records from cache (skipping Steps 1–3)...");
  const meta = JSON.parse(fs.readFileSync(TEAM_RECORDS_CACHE, "utf8")) as {
    allTeams?: TeamRecord[];
    auditEntries: LeagueAuditEntry[];
    processedSeasons: string[];
    leaguesAnalyzed: number;
    total_leagues: number;
    generated_at: string;
  };
  const processedSeasons = new Set<string>(meta.processedSeasons);
  // Load teams from NDJSON sidecar if present, else fall back to embedded allTeams (legacy)
  const allTeams: TeamRecord[] = await loadNdjsonTeams(TEAM_RECORDS_CACHE_TEAMS);
  if (allTeams.length === 0 && meta.allTeams) {
    for (const t of meta.allTeams) allTeams.push(t);
  }
  console.log(
    `  ✓ Loaded ${allTeams.length} team records from ${meta.leaguesAnalyzed} leagues (generated ${meta.generated_at})\n`
  );
  return {
    allTeams,
    auditEntries: meta.auditEntries,
    processedSeasons,
    leaguesAnalyzed: meta.leaguesAnalyzed,
    totalLeagues: meta.total_leagues,
  };
}

async function runAnalysisPhase(
  allTeams: TeamRecord[],
  auditEntries: LeagueAuditEntry[],
  processedSeasons: Set<string>,
  leaguesAnalyzed: number,
  totalLeagues: number
) {
  // Step 4: Aggregate analysis
  console.log("Step 4: Analyzing draft strategies...");
  const result = computeAnalysisFromTeams(
    allTeams,
    auditEntries,
    totalLeagues,
    processedSeasons,
    leaguesAnalyzed
  );
  console.log("  Done.\n");

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

  // Step 6: Negative strategy analysis
  console.log("\nStep 6: Analyzing negative strategies...");
  const { negativeStrategies, playoffMissRisk } = analyzeNegativeStrategies(result.teams);
  writeOutput("redraft_negative_strategies.json", negativeStrategies);
  writeOutput("redraft_playoff_miss_risk.json", playoffMissRisk);

  // Step 7: Pre-compute all filter combinations (QB × Scoring × TEP × Team Size × Season)
  console.log("\nStep 7: Pre-computing filtered combos (QB × Scoring × TEP × Team Size × Season)...");
  const filteredCombos = computeAllFilteredCombos(allTeams);
  writeOutput("redraft_by_filter_combo.json", filteredCombos);
  console.log(`  Done — ${Object.keys(filteredCombos.combos).length} combinations computed.`);

  // Step 8: Year-over-year trends (36 combos: QB × Scoring × TEP × Team Size)
  console.log("\nStep 8: Computing year-over-year trends (2024 vs 2025)...");
  const trendsOutput = computeTrendsOutput(allTeams);
  writeOutput("redraft_by_filter_trends.json", trendsOutput);
  console.log(`  Done — ${Object.keys(trendsOutput.trends).length} trend combos computed.`);

  const audit = result.audit;
  console.log(`
══════════════════════════════════════════════
  Done!

  Leagues processed : ${audit.total_leagues}
  Succeeded         : ${audit.succeeded}
  Skipped           : ${audit.skipped}
  Failed            : ${audit.failed}
  Teams analyzed    : ${allTeams.length}

  Output: data/output/
══════════════════════════════════════════════
`);
}

async function main() {
  const analyzeOnly = process.argv.includes("--analyze-only");
  const fetchOnly = process.argv.includes("--fetch-only");

  console.log("\n══════════════════════════════════════════════");
  console.log("  StatChasers Redraft Strategy Analyzer");
  if (analyzeOnly) console.log("  Mode: Analyze-only (from team records cache)");
  if (fetchOnly) console.log("  Mode: Fetch-only (build team records cache, then exit)");
  console.log("══════════════════════════════════════════════\n");

  ensureDir(OUTPUT_DIR);

  if (analyzeOnly) {
    const fetchResult = await loadFromCache();
    await runAnalysisPhase(
      fetchResult.allTeams,
      fetchResult.auditEntries,
      fetchResult.processedSeasons,
      fetchResult.leaguesAnalyzed,
      fetchResult.totalLeagues
    );
    return;
  }

  const fetchResult = await runFetchPhase();

  if (fetchOnly) {
    console.log("Fetch-only mode: cache written. Run `pnpm run redraft:analyze` to complete Steps 4–7.");
    return;
  }

  await runAnalysisPhase(
    fetchResult.allTeams,
    fetchResult.auditEntries,
    fetchResult.processedSeasons,
    fetchResult.leaguesAnalyzed,
    fetchResult.totalLeagues
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
