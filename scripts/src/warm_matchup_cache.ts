/**
 * warm_matchup_cache.ts
 *
 * Dedicated cache-warmer for matchup and bracket files.
 * Reads all league IDs from the input CSV, checks which matchup/bracket
 * files are already cached, and fetches only what's missing.
 *
 * Much faster than running the full pipeline because:
 * - Reads league settings from the local leagues/ cache (no API calls)
 * - Skips all analysis / output steps
 * - Can be run repeatedly until all files are cached
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run warm:cache
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");
const RAW_DIR = path.join(ROOT, "data/raw/sleeper");
const INPUT_CSV = path.join(ROOT, "data/input/sleeper_redraft_leagues.csv");
const SLEEPER_API = "https://api.sleeper.app/v1";
const CONCURRENCY = 80;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readInputCsv(): string[] {
  const lines = fs.readFileSync(INPUT_CSV, "utf-8").trim().split("\n");
  const [, ...rows] = lines;
  return rows
    .filter((r) => r.trim() && !r.startsWith("#"))
    .map((row) => row.split(",")[1]?.trim())
    .filter(Boolean) as string[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function cachedPath(subdir: string, filename: string): string {
  return path.join(RAW_DIR, subdir, filename);
}

function isCached(subdir: string, filename: string): boolean {
  return fs.existsSync(cachedPath(subdir, filename));
}

async function fetchAndCache<T>(subdir: string, filename: string, url: string): Promise<T> {
  const data = await fetchJson<T>(url);
  const dir = path.join(RAW_DIR, subdir);
  ensureDir(dir);
  fs.writeFileSync(cachedPath(subdir, filename), JSON.stringify(data, null, 2));
  return data;
}

function getLeagueWeeks(leagueId: string): number {
  const file = cachedPath("leagues", `${leagueId}.json`);
  if (!fs.existsSync(file)) return 14;
  try {
    const d = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>;
    const settings = (d.settings as Record<string, unknown>) || {};
    const playoff_week_start = (settings["playoff_week_start"] as number) || 15;
    const last_scored = (settings["last_scored_leg"] as number) || playoff_week_start - 1;
    return Math.min(playoff_week_start - 1, last_scored, 17);
  } catch {
    return 14;
  }
}

async function warmLeague(leagueId: string): Promise<{ fetched: number; skipped: number; errors: number }> {
  let fetched = 0;
  let skipped = 0;
  let errors = 0;

  const weeks = getLeagueWeeks(leagueId);

  const tasks: Array<{ subdir: string; filename: string; url: string }> = [];

  for (let week = 1; week <= weeks; week++) {
    const filename = `${leagueId}_week${week}.json`;
    if (!isCached("matchups", filename)) {
      tasks.push({ subdir: "matchups", filename, url: `${SLEEPER_API}/league/${leagueId}/matchups/${week}` });
    } else {
      skipped++;
    }
  }

  for (const suffix of ["winners", "losers"] as const) {
    const filename = `${leagueId}_${suffix}.json`;
    if (!isCached("brackets", filename)) {
      tasks.push({ subdir: "brackets", filename, url: `${SLEEPER_API}/league/${leagueId}/${suffix}_bracket` });
    } else {
      skipped++;
    }
  }

  await Promise.all(
    tasks.map(async ({ subdir, filename, url }) => {
      try {
        await fetchAndCache(subdir, filename, url);
        fetched++;
      } catch {
        errors++;
      }
    })
  );

  return { fetched, skipped, errors };
}

async function main() {
  console.log("\n══════════════════════════════════════════════");
  console.log("  StatChasers Matchup Cache Warmer");
  console.log("══════════════════════════════════════════════\n");

  const leagueIds = readInputCsv();
  console.log(`Found ${leagueIds.length} leagues in input CSV.`);

  ensureDir(path.join(RAW_DIR, "matchups"));
  ensureDir(path.join(RAW_DIR, "brackets"));

  let totalFetched = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let processed = 0;

  for (let i = 0; i < leagueIds.length; i += CONCURRENCY) {
    const batch = leagueIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((id) => warmLeague(id)));
    for (const r of results) {
      totalFetched += r.fetched;
      totalSkipped += r.skipped;
      totalErrors += r.errors;
    }
    processed += batch.length;
    if (processed % 500 === 0 || processed === leagueIds.length) {
      console.log(
        `  ${processed}/${leagueIds.length} leagues | fetched: ${totalFetched} | skipped: ${totalSkipped} | errors: ${totalErrors}`
      );
    }
  }

  console.log(`
══════════════════════════════════════════════
  Cache warm complete!

  Leagues processed : ${leagueIds.length}
  Files fetched     : ${totalFetched}
  Files skipped     : ${totalSkipped}
  Errors            : ${totalErrors}
══════════════════════════════════════════════
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
