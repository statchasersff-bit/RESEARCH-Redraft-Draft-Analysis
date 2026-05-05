/**
 * fetch_sleeper_redraft_data.ts
 *
 * Fetches raw Sleeper API data for each league in the input CSV.
 * Caches responses under data/raw/sleeper/.
 * Pass --refresh to force re-fetch all data.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");

const RAW_DIR = path.join(ROOT, "data/raw/sleeper");
const INPUT_CSV = path.join(ROOT, "data/input/sleeper_redraft_leagues.csv");
const SLEEPER_API = "https://api.sleeper.app/v1";

const REFRESH = process.argv.includes("--refresh");

// ─── Utilities ───────────────────────────────────────────────────────────────

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function cachePath(subdir: string, filename: string): string {
  const dir = path.join(RAW_DIR, subdir);
  ensureDir(dir);
  return path.join(dir, filename);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

async function cachedFetch<T>(
  subdir: string,
  filename: string,
  url: string
): Promise<T> {
  const file = cachePath(subdir, filename);
  if (!REFRESH && fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  }
  const data = await fetchJson<T>(url);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return data;
}

// ─── CSV Parser ──────────────────────────────────────────────────────────────

export interface LeagueInput {
  season: string;
  league_id: string;
  notes: string;
}

export function readInputCsv(): LeagueInput[] {
  if (!fs.existsSync(INPUT_CSV)) {
    throw new Error(`Input CSV not found: ${INPUT_CSV}`);
  }
  const lines = fs.readFileSync(INPUT_CSV, "utf-8").trim().split("\n");
  const [header, ...rows] = lines;
  const cols = header.split(",");
  return rows
    .filter((r) => r.trim() && !r.startsWith("#"))
    .map((row) => {
      const vals = row.split(",");
      const obj: Record<string, string> = {};
      cols.forEach((col, i) => {
        obj[col.trim()] = (vals[i] || "").trim();
      });
      return obj as unknown as LeagueInput;
    });
}

// ─── Fetchers ────────────────────────────────────────────────────────────────

export async function fetchLeague(leagueId: string) {
  return cachedFetch(
    "leagues",
    `${leagueId}.json`,
    `${SLEEPER_API}/league/${leagueId}`
  );
}

export async function fetchLeagueUsers(leagueId: string) {
  return cachedFetch(
    "leagues",
    `${leagueId}_users.json`,
    `${SLEEPER_API}/league/${leagueId}/users`
  );
}

export async function fetchLeagueRosters(leagueId: string) {
  return cachedFetch(
    "rosters",
    `${leagueId}.json`,
    `${SLEEPER_API}/league/${leagueId}/rosters`
  );
}

export async function fetchLeagueMatchups(
  leagueId: string,
  week: number
): Promise<unknown[]> {
  return cachedFetch(
    "matchups",
    `${leagueId}_week${week}.json`,
    `${SLEEPER_API}/league/${leagueId}/matchups/${week}`
  ) as Promise<unknown[]>;
}

export async function fetchWinnersBracket(leagueId: string) {
  return cachedFetch(
    "brackets",
    `${leagueId}_winners.json`,
    `${SLEEPER_API}/league/${leagueId}/winners_bracket`
  );
}

export async function fetchLosersBracket(leagueId: string) {
  return cachedFetch(
    "brackets",
    `${leagueId}_losers.json`,
    `${SLEEPER_API}/league/${leagueId}/losers_bracket`
  );
}

export async function fetchLeagueDrafts(leagueId: string) {
  return cachedFetch(
    "drafts",
    `${leagueId}_list.json`,
    `${SLEEPER_API}/league/${leagueId}/drafts`
  ) as Promise<Array<{ draft_id: string }>>;
}

export async function fetchDraft(draftId: string) {
  return cachedFetch(
    "drafts",
    `${draftId}.json`,
    `${SLEEPER_API}/draft/${draftId}`
  );
}

export async function fetchDraftPicks(draftId: string) {
  return cachedFetch(
    "picks",
    `${draftId}.json`,
    `${SLEEPER_API}/draft/${draftId}/picks`
  );
}

export async function fetchNflPlayers(): Promise<Record<string, { full_name?: string; position?: string; team?: string }>> {
  const file = cachePath("", "nfl_players.json");
  if (!REFRESH && fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  }
  console.log("  Fetching NFL players (large file, may take a moment)...");
  const data = await fetchJson<Record<string, unknown>>(
    `${SLEEPER_API}/players/nfl`
  );
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return data as Record<string, { full_name?: string; position?: string; team?: string }>;
}

// ─── Main Fetch Flow ──────────────────────────────────────────────────────────

export interface FetchedLeagueData {
  input: LeagueInput;
  league: unknown;
  users: unknown;
  rosters: unknown;
  matchups: Record<number, unknown[]>;
  winnersBracket: unknown;
  losersBracket: unknown;
  drafts: Array<{ draft_id: string }>;
  draftDetails: unknown[];
  draftPicks: unknown[][];
}

export async function fetchAllDataForLeague(
  input: LeagueInput
): Promise<FetchedLeagueData> {
  const { league_id } = input;

  const [league, users, rosters, drafts] = await Promise.all([
    fetchLeague(league_id),
    fetchLeagueUsers(league_id),
    fetchLeagueRosters(league_id),
    fetchLeagueDrafts(league_id),
  ]);

  const leagueData = league as Record<string, unknown>;
  const settings = (leagueData.settings as Record<string, unknown>) || {};
  const playoff_week_start = (settings["playoff_week_start"] as number) || 15;
  const total_weeks = (settings["last_scored_leg"] as number) || playoff_week_start - 1;
  const regular_season_weeks = Math.min(playoff_week_start - 1, total_weeks, 17);

  // Fetch matchups for regular season weeks
  const matchupWeeks = Array.from(
    { length: regular_season_weeks },
    (_, i) => i + 1
  );
  const matchupResults = await Promise.all(
    matchupWeeks.map((week) =>
      fetchLeagueMatchups(league_id, week).catch(() => [])
    )
  );
  const matchups: Record<number, unknown[]> = {};
  matchupWeeks.forEach((week, i) => {
    matchups[week] = matchupResults[i];
  });

  const [winnersBracket, losersBracket] = await Promise.all([
    fetchWinnersBracket(league_id).catch(() => null),
    fetchLosersBracket(league_id).catch(() => null),
  ]);

  // Fetch draft details + picks
  const draftsArr = Array.isArray(drafts) ? drafts : [];
  const draftDetails = await Promise.all(
    draftsArr.map((d) => fetchDraft(d.draft_id).catch(() => null))
  );
  const draftPicks = await Promise.all(
    draftsArr.map((d) => fetchDraftPicks(d.draft_id).catch(() => []))
  ) as unknown[][];

  return {
    input,
    league,
    users,
    rosters,
    matchups,
    winnersBracket,
    losersBracket,
    drafts: draftsArr,
    draftDetails,
    draftPicks,
  };
}

// ─── Standalone Entry ─────────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith("fetch_sleeper_redraft_data.ts")) {
  const leagues = readInputCsv();
  console.log(`Found ${leagues.length} leagues in input CSV`);

  for (const league of leagues) {
    console.log(`Fetching league ${league.league_id} (${league.season})...`);
    try {
      await fetchAllDataForLeague(league);
      console.log(`  Done.`);
    } catch (err) {
      console.error(`  Failed: ${(err as Error).message}`);
    }
  }
  console.log("Fetch complete.");
}
