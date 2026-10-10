/**
 * discover_sleeper_redraft_leagues.ts
 *
 * Discovers valid Sleeper redraft leagues from a user's network, validates them
 * against comprehensive rules, and exports clean CSV/JSON output files.
 *
 * Usage:
 *   npx tsx scripts/src/discover_sleeper_redraft_leagues.ts
 *   npx tsx scripts/src/discover_sleeper_redraft_leagues.ts --username Makitrain --season 2024
 *   npx tsx scripts/src/discover_sleeper_redraft_leagues.ts --username Makitrain --season 2024 --refresh
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");

const CACHE_DIR = path.join(ROOT, "data/raw/sleeper/cache");
const INPUT_DIR = path.join(ROOT, "data/input");
const OUTPUT_DIR = path.join(ROOT, "data/output");
const CONFIG_FILE = path.join(INPUT_DIR, "sleeper_discovery_config.json");

const SLEEPER_API = "https://api.sleeper.app/v1";
const API_DELAY_MS = 250; // delay between uncached calls to be polite

// ─── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const REFRESH = args.includes("--refresh");

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

// ─── Config ────────────────────────────────────────────────────────────────────

interface DiscoveryConfig {
  sleeper_username: string;
  season: string;
  max_network_depth: number;
  max_depth2_users: number;
  include_seed_user_leagues: boolean;
  include_leaguemate_leagues: boolean;
}

function loadConfig(): DiscoveryConfig {
  let base: DiscoveryConfig = {
    sleeper_username: "",
    season: "2024",
    max_network_depth: 1,
    max_depth2_users: Infinity,
    include_seed_user_leagues: true,
    include_leaguemate_leagues: true,
  };

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      base = { ...base, ...JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")) };
    } catch {
      console.warn("  Warning: could not parse discovery config file, using defaults");
    }
  }

  // CLI overrides
  const username = getArg("--username");
  const season = getArg("--season");
  if (username) base.sleeper_username = username;
  if (season) base.season = season;

  if (!base.sleeper_username) {
    throw new Error(
      "No Sleeper username provided. Pass --username or set sleeper_username in data/input/sleeper_discovery_config.json"
    );
  }

  return base;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cachePath(subdir: string, filename: string): string {
  const dir = path.join(CACHE_DIR, subdir);
  ensureDir(dir);
  return path.join(dir, filename);
}

async function fetchJson<T>(url: string): Promise<T> {
  await sleep(API_DELAY_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      if (res.status === 404) throw new Error(`Not found: ${url}`);
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new Error(`Timeout fetching ${url}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function cachedFetch<T>(
  subdir: string,
  filename: string,
  url: string,
  allowNull = false
): Promise<T | null> {
  const file = cachePath(subdir, filename);
  if (!REFRESH && fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
    } catch {
      // Corrupted cache file — delete and re-fetch
      fs.unlinkSync(file);
    }
  }
  try {
    const data = await fetchJson<T>(url);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return data;
  } catch (err) {
    if (allowNull) return null;
    throw err;
  }
}

// ─── Sleeper Types ─────────────────────────────────────────────────────────────

interface SleeperUser {
  user_id: string;
  username: string;
  display_name?: string;
}

interface SleeperLeague {
  league_id: string;
  name: string;
  sport: string;
  season: string;
  season_type: string;
  status: string;
  total_rosters: number;
  settings: Record<string, number | string | null>;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
}

interface SleeperDraft {
  draft_id: string;
  type: string;
  status: string;
  settings: Record<string, number | string>;
}

interface SleeperDraftPick {
  pick_no: number;
  round: number;
  roster_id: number;
}

interface SleeperRoster {
  roster_id: number;
  owner_id: string;
}

// ─── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchUser(username: string): Promise<SleeperUser> {
  const data = await cachedFetch<SleeperUser>(
    "users",
    `${username.toLowerCase()}.json`,
    `${SLEEPER_API}/user/${username}`
  );
  if (!data) throw new Error(`User not found: ${username}`);
  return data;
}

async function fetchUserLeagues(userId: string, season: string): Promise<SleeperLeague[]> {
  const data = await cachedFetch<SleeperLeague[]>(
    "user_leagues",
    `${userId}_${season}.json`,
    `${SLEEPER_API}/user/${userId}/leagues/nfl/${season}`
  );
  return data ?? [];
}

async function fetchLeague(leagueId: string): Promise<SleeperLeague | null> {
  return cachedFetch<SleeperLeague>(
    "league_meta",
    `${leagueId}.json`,
    `${SLEEPER_API}/league/${leagueId}`,
    true
  );
}

async function fetchLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
  const data = await cachedFetch<SleeperUser[]>(
    "league_users",
    `${leagueId}_users.json`,
    `${SLEEPER_API}/league/${leagueId}/users`,
    true
  );
  return data ?? [];
}

async function fetchLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  const data = await cachedFetch<SleeperRoster[]>(
    "league_rosters",
    `${leagueId}_rosters.json`,
    `${SLEEPER_API}/league/${leagueId}/rosters`,
    true
  );
  return data ?? [];
}

async function fetchLeagueDrafts(leagueId: string): Promise<SleeperDraft[]> {
  const data = await cachedFetch<SleeperDraft[]>(
    "league_drafts",
    `${leagueId}_drafts.json`,
    `${SLEEPER_API}/league/${leagueId}/drafts`,
    true
  );
  return data ?? [];
}

async function fetchDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
  const data = await cachedFetch<SleeperDraftPick[]>(
    "draft_picks",
    `${draftId}_picks.json`,
    `${SLEEPER_API}/draft/${draftId}/picks`,
    true
  );
  return data ?? [];
}

// ─── Validation ────────────────────────────────────────────────────────────────

type QBFormat = "1QB" | "Superflex";
type ScoringFormat = "Standard" | "Half PPR" | "PPR";
type TEPFormat = "No TEP" | "TEP +0.5" | "TEP +0.75";
type PassTDFormat = "4pt Pass TD" | "6pt Pass TD";

interface ValidationResult {
  valid: boolean;
  reason_rejected?: string;
  validation_notes?: string;
  // Classification fields (only set when valid)
  qb_format?: QBFormat;
  scoring_format?: ScoringFormat;
  tep_format?: TEPFormat;
  pass_td_format?: PassTDFormat;
  league_size_bucket?: "10-team" | "12-team";
}

const IDP_POSITIONS = new Set(["DL", "LB", "DB", "IDP", "IDP_FLEX", "FLEX_IDP"]);

const DYNASTY_KEYWORDS = /dynasty|dyn\b|taxi/i;
const KEEPER_KEYWORDS = /keeper|keep\b/i;
const BESTBALL_KEYWORDS = /best.?ball|bestball/i;

function classifyQBFormat(
  rosterPositions: string[],
  settings: Record<string, number | string | null>
): { format: QBFormat | null; reason?: string } {
  const hasSuperflex =
    rosterPositions.includes("SUPER_FLEX") || rosterPositions.includes("OP");
  if (hasSuperflex) return { format: "Superflex" };

  const qbSlots = rosterPositions.filter((p) => p === "QB").length;
  if (qbSlots === 1) return { format: "1QB" };
  if (qbSlots === 2) return { format: null, reason: "2QB league (two required QB slots)" };
  if (qbSlots === 0) return { format: "1QB" }; // assume 1QB if no explicit QB slot

  return { format: null, reason: `Unusual QB slot count: ${qbSlots}` };
}

function classifyScoringFormat(
  scoringSettings: Record<string, number>
): { format: ScoringFormat | null; reason?: string } {
  const rec = scoringSettings["rec"] ?? 0;
  if (rec === 0) return { format: "Standard" };
  if (rec === 0.5) return { format: "Half PPR" };
  if (rec === 1) return { format: "PPR" };
  return { format: null, reason: `Non-standard reception scoring: rec=${rec}` };
}

function classifyPassTDFormat(
  scoringSettings: Record<string, number>
): { format: PassTDFormat | null; reason?: string } {
  const passTD = scoringSettings["pass_td"] ?? 4;
  if (passTD === 4) return { format: "4pt Pass TD" };
  if (passTD === 6) return { format: "6pt Pass TD" };
  return { format: null, reason: `Non-standard pass TD scoring: pass_td=${passTD}` };
}

function classifyTEP(
  scoringSettings: Record<string, number>
): { format: TEPFormat | null; reason?: string } {
  const tepKeys = ["bonus_rec_te", "rec_te_bonus", "te_rec_bonus", "bonus_rec_te_y1", "bonus_rec_te_any"];
  let tepValue = 0;
  for (const key of tepKeys) {
    if (scoringSettings[key] != null) {
      tepValue = Math.max(tepValue, scoringSettings[key]);
    }
  }

  if (tepValue === 0) return { format: "No TEP" };
  if (tepValue === 0.5) return { format: "TEP +0.5" };
  if (tepValue === 0.75) return { format: "TEP +0.75" };

  return {
    format: null,
    reason: `Non-standard TE premium: ${tepValue} (only No TEP, +0.5, +0.75 allowed)`,
  };
}

function checkUnusualScoring(
  scoringSettings: Record<string, number>
): { ok: boolean; reason?: string } {
  // First down bonuses
  const firstDownKeys = ["bonus_fd", "bonus_fd_qb", "bonus_fd_rb", "bonus_fd_wr", "bonus_fd_te", "fum_lost_fd"];
  for (const key of firstDownKeys) {
    if (scoringSettings[key] && Math.abs(scoringSettings[key]) > 0.1) {
      return { ok: false, reason: `First down bonus scoring detected: ${key}=${scoringSettings[key]}` };
    }
  }

  // Completion bonuses
  if (scoringSettings["cmp"] && Math.abs(scoringSettings["cmp"]) > 0.1) {
    return { ok: false, reason: `Completion bonus detected: cmp=${scoringSettings["cmp"]}` };
  }

  // Incompletion penalty (significant)
  if (scoringSettings["inc"] && scoringSettings["inc"] < -0.25) {
    return { ok: false, reason: `Heavy incompletion penalty: inc=${scoringSettings["inc"]}` };
  }

  // Big play bonuses (40+ yard TD, etc.)
  const bigPlayKeys = [
    "bonus_rec_wr", "bonus_rush_att_yd", "bonus_rush_rec_yd",
    "bonus_pass_yd_300", "bonus_pass_yd_400", "bonus_rush_yd_100", "bonus_rush_yd_200",
    "bonus_rec_yd_100", "bonus_rec_yd_200",
    "bonus_rush_att", "bonus_pts_allow",
  ];
  for (const key of bigPlayKeys) {
    if (scoringSettings[key] && Math.abs(scoringSettings[key]) > 0.5) {
      return { ok: false, reason: `Big play / yardage bonus detected: ${key}=${scoringSettings[key]}` };
    }
  }

  // Long TD bonus keys
  const longTDKeys = [
    "rush_td_40p", "rush_td_50p", "pass_td_40p", "pass_td_50p",
    "rec_td_40p", "rec_td_50p",
  ];
  for (const key of longTDKeys) {
    if (scoringSettings[key] && Math.abs(scoringSettings[key]) > 0.5) {
      return { ok: false, reason: `Long TD bonus detected: ${key}=${scoringSettings[key]}` };
    }
  }

  // Points per carry
  if (scoringSettings["rush_att"] && Math.abs(scoringSettings["rush_att"]) > 0.1) {
    return { ok: false, reason: `Points per carry detected: rush_att=${scoringSettings["rush_att"]}` };
  }

  // Heavy return yardage
  if (scoringSettings["pr_yd"] && Math.abs(scoringSettings["pr_yd"]) > 0.05) {
    return { ok: false, reason: `Return yardage scoring detected: pr_yd=${scoringSettings["pr_yd"]}` };
  }
  if (scoringSettings["kr_yd"] && Math.abs(scoringSettings["kr_yd"]) > 0.05) {
    return { ok: false, reason: `Return yardage scoring detected: kr_yd=${scoringSettings["kr_yd"]}` };
  }

  return { ok: true };
}

function checkRosterSettings(
  rosterPositions: string[],
  settings: Record<string, number | string | null>
): { ok: boolean; reason?: string } {
  // Check for IDP positions
  for (const pos of rosterPositions) {
    if (IDP_POSITIONS.has(pos)) {
      return { ok: false, reason: `IDP roster position detected: ${pos}` };
    }
  }

  // Count bench spots
  const benchCount = rosterPositions.filter((p) => p === "BN").length;
  if (benchCount < 4 || benchCount > 10) {
    return {
      ok: false,
      reason: `Unusual bench count: ${benchCount} (expected 4–10)`,
    };
  }

  // Count kickers and defenses
  const kCount = rosterPositions.filter((p) => p === "K").length;
  const defCount = rosterPositions.filter((p) => p === "DEF" || p === "DST").length;
  if (kCount > 1) {
    return { ok: false, reason: `Multiple kicker slots: ${kCount}` };
  }
  if (defCount > 1) {
    return { ok: false, reason: `Multiple defense slots: ${defCount}` };
  }

  // Reject 2 or more required QB starters (handled in QB format check)

  return { ok: true };
}

function isDynastyOrKeeper(
  league: SleeperLeague,
  draft: SleeperDraft | null
): { isDynasty: boolean; isKeeper: boolean; isBestBall: boolean } {
  const name = (league.name || "").toLowerCase();
  const settings = league.settings || {};
  const seasonType = (league.season_type || "").toLowerCase();

  const isBestBall =
    (settings["best_ball"] as number) === 1 || BESTBALL_KEYWORDS.test(name);

  const isDynasty =
    seasonType === "dynasty" ||
    DYNASTY_KEYWORDS.test(name) ||
    (settings["taxi_slots"] as number) > 0 ||
    (settings["taxi_years"] as number) > 0;

  const isKeeper =
    seasonType === "keeper" ||
    KEEPER_KEYWORDS.test(name) ||
    (settings["num_kept"] as number) > 0 ||
    (draft?.settings?.["pick_trading"] === 1);

  return { isDynasty, isKeeper, isBestBall };
}

function validateLeague(
  league: SleeperLeague,
  drafts: SleeperDraft[],
  draftPicks: SleeperDraftPick[][],
  rosters: SleeperRoster[],
  users: SleeperUser[]
): ValidationResult {
  if (!league) return { valid: false, reason_rejected: "No league data" };

  // Sport check
  if (league.sport && league.sport !== "nfl") {
    return { valid: false, reason_rejected: `Not NFL (sport=${league.sport})` };
  }

  // Season type
  const seasonType = (league.season_type || "").toLowerCase();
  if (seasonType === "dynasty") {
    return { valid: false, reason_rejected: "Dynasty league" };
  }

  // Size
  const totalRosters = league.total_rosters || 0;
  if (totalRosters !== 10 && totalRosters !== 12) {
    return {
      valid: false,
      reason_rejected: `League size ${totalRosters} not allowed (only 10 or 12)`,
    };
  }

  // Must have users and rosters
  if (!users || users.length === 0) {
    return { valid: false, reason_rejected: "No users found in league" };
  }
  if (!rosters || rosters.length === 0) {
    return { valid: false, reason_rejected: "No rosters found in league" };
  }

  // Must have a completed snake draft with picks
  if (!drafts || drafts.length === 0) {
    return { valid: false, reason_rejected: "No draft found" };
  }

  const snakeDraft = drafts.find((d) => d.type === "snake");
  if (!snakeDraft) {
    return { valid: false, reason_rejected: `Draft type not snake (${drafts[0]?.type ?? "unknown"})` };
  }
  if (snakeDraft.status !== "complete") {
    return { valid: false, reason_rejected: `Draft not complete (status: ${snakeDraft.status})` };
  }

  const draftIdx = drafts.indexOf(snakeDraft);
  const picks = draftPicks[draftIdx] || [];
  if (picks.length === 0) {
    return { valid: false, reason_rejected: "No draft picks found" };
  }

  // Dynasty / keeper / best ball check
  const { isDynasty, isKeeper, isBestBall } = isDynastyOrKeeper(league, snakeDraft);
  if (isDynasty) return { valid: false, reason_rejected: "Dynasty league (detected from name/settings)" };
  if (isKeeper) return { valid: false, reason_rejected: "Keeper league (detected from name/settings)" };
  if (isBestBall) return { valid: false, reason_rejected: "Best ball league" };

  const settings = league.settings || {};
  const scoringSettings = league.scoring_settings || {};
  const rosterPositions = league.roster_positions || [];

  // IDP check
  for (const pos of rosterPositions) {
    if (IDP_POSITIONS.has(pos)) {
      return { valid: false, reason_rejected: `IDP league (position: ${pos})` };
    }
  }

  // QB format
  const qbResult = classifyQBFormat(rosterPositions, settings);
  if (!qbResult.format) {
    return { valid: false, reason_rejected: qbResult.reason };
  }

  // Scoring format
  const scoringResult = classifyScoringFormat(scoringSettings);
  if (!scoringResult.format) {
    return { valid: false, reason_rejected: scoringResult.reason };
  }

  // Pass TD format
  const passTDResult = classifyPassTDFormat(scoringSettings);
  if (!passTDResult.format) {
    return { valid: false, reason_rejected: passTDResult.reason };
  }

  // TEP classification
  const tepResult = classifyTEP(scoringSettings);
  if (!tepResult.format) {
    return { valid: false, reason_rejected: tepResult.reason };
  }

  // Unusual scoring check
  const unusualScoring = checkUnusualScoring(scoringSettings);
  if (!unusualScoring.ok) {
    return { valid: false, reason_rejected: unusualScoring.reason };
  }

  // Roster settings check
  const rosterCheck = checkRosterSettings(rosterPositions, settings);
  if (!rosterCheck.ok) {
    return { valid: false, reason_rejected: rosterCheck.reason };
  }

  const leagueSizeBucket: "10-team" | "12-team" = totalRosters === 12 ? "12-team" : "10-team";

  return {
    valid: true,
    qb_format: qbResult.format,
    scoring_format: scoringResult.format,
    pass_td_format: passTDResult.format,
    tep_format: tepResult.format,
    league_size_bucket: leagueSizeBucket,
  };
}

// ─── Output Types ─────────────────────────────────────────────────────────────

interface ValidLeagueEntry {
  season: string;
  league_id: string;
  league_name: string;
  total_rosters: number;
  league_size_bucket: string;
  qb_format: string;
  scoring_format: string;
  tep_format: string;
  pass_td_format: string;
  roster_positions: string;
  draft_id: string;
  draft_type: string;
  source_type: string;
  discovered_from_user_id: string;
  discovered_from_username: string;
  discovered_from_seed_league_id: string;
  validation_status: string;
  validation_notes: string;
}

interface RejectedLeagueEntry {
  season: string;
  league_id: string;
  league_name: string;
  total_rosters: number;
  reason_rejected: string;
  validation_notes: string;
  relevant_settings: Record<string, unknown>;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
}

// ─── CSV Writer ────────────────────────────────────────────────────────────────

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h] ?? "";
          const str = String(val).replace(/"/g, '""');
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str}"`
            : str;
        })
        .join(",")
    ),
  ];
  return csvLines.join("\n");
}

// ─── Main Discovery Flow ───────────────────────────────────────────────────────

async function main() {
  console.log("\n══════════════════════════════════════════════");
  console.log("  StatChasers — Sleeper League Discovery");
  console.log("══════════════════════════════════════════════\n");

  ensureDir(CACHE_DIR);
  ensureDir(INPUT_DIR);
  ensureDir(OUTPUT_DIR);

  // Step 1: Config
  const config = loadConfig();
  console.log(`Username : ${config.sleeper_username}`);
  console.log(`Season   : ${config.season}`);
  console.log(`Refresh  : ${REFRESH}\n`);

  // ── Session checkpoint paths ──────────────────────────────────────────────────
  const sessionCkptDir = path.join(ROOT, "data", "tmp");
  const ckptSession = path.join(sessionCkptDir, `discover_ckpt_session_${config.season}.json`);
  const ckptStep5b = path.join(sessionCkptDir, `discover_ckpt_step5b_${config.season}.json`);
  if (!fs.existsSync(sessionCkptDir)) fs.mkdirSync(sessionCkptDir, { recursive: true });

  // Session state — hoisted so Step 5b resume path can access them
  let seedUserId = "";
  let seedUsername = config.sleeper_username;
  let seedLeaguesLength = 0;
  let allLeagueIdsSize = 0;
  const allLeagueIds = new Set<string>();
  const leagueDiscoverySource: Record<
    string,
    { source_type: string; discovered_from_user_id: string; discovered_from_username: string; discovered_from_seed_league_id: string }
  > = {};
  const uniqueUserIds = new Set<string>();
  const userIdToUsername: Record<string, string> = {};

  async function collectUsersFromLeagues(leagueIds: string[]): Promise<void> {
    const CONCURRENCY = 50;
    for (let i = 0; i < leagueIds.length; i += CONCURRENCY) {
      const batch = leagueIds.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (leagueId) => {
        const users = await fetchLeagueUsers(leagueId);
        for (const user of users) {
          if (user.user_id && !uniqueUserIds.has(user.user_id)) {
            uniqueUserIds.add(user.user_id);
            userIdToUsername[user.user_id] = user.username || user.display_name || user.user_id;
          }
        }
      }));
      if (leagueIds.length > 50 && (i + CONCURRENCY) % 200 === 0) {
        console.log(`  Users from ${Math.min(i + CONCURRENCY, leagueIds.length)}/${leagueIds.length} leagues collected...`);
      }
    }
  }

  async function fetchLeaguesForUsers(userIds: string[], sourceType: string): Promise<number> {
    const CONCURRENCY = 50;
    let newLeagueCount = 0;
    for (let i = 0; i < userIds.length; i += CONCURRENCY) {
      const batch = userIds.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (userId) => {
        const username = userIdToUsername[userId] || userId;
        const leagues = await fetchUserLeagues(userId, config.season);
        for (const league of leagues) {
          if (!allLeagueIds.has(league.league_id)) {
            allLeagueIds.add(league.league_id);
            leagueDiscoverySource[league.league_id] = {
              source_type: sourceType,
              discovered_from_user_id: userId,
              discovered_from_username: username,
              discovered_from_seed_league_id: "",
            };
            newLeagueCount++;
          }
        }
      }));
      if (userIds.length > 50 && (i + CONCURRENCY) % 500 === 0) {
        console.log(`  Fetched leagues for ${Math.min(i + CONCURRENCY, userIds.length)}/${userIds.length} users, ${newLeagueCount} new so far...`);
      }
    }
    return newLeagueCount;
  }

  // ── Fast resume: skip Steps 1–5 if session checkpoint exists ─────────────────
  let needsStep5b = false;
  const hasFastResume = !REFRESH && fs.existsSync(ckptSession);

  if (hasFastResume) {
    try {
      const session = JSON.parse(fs.readFileSync(ckptSession, "utf-8")) as {
        seedUserId: string; seedUsername: string; seedLeaguesLength: number;
        allLeagueIdsList: string[];
        leagueDiscoverySource: Record<string, { source_type: string; discovered_from_user_id: string; discovered_from_username: string; discovered_from_seed_league_id: string }>;
        depth1UserIds?: string[];
        depth2Complete?: boolean;
      };
      seedUserId = session.seedUserId;
      seedUsername = session.seedUsername;
      seedLeaguesLength = session.seedLeaguesLength;
      for (const id of session.allLeagueIdsList) allLeagueIds.add(id);
      Object.assign(leagueDiscoverySource, session.leagueDiscoverySource);

      if (session.depth2Complete === false) {
        // Depth-1 done but Step 5b was interrupted — will resume below
        needsStep5b = true;
        // Restore depth-1 user IDs so we can compute delta for depth-2 users
        if (session.depth1UserIds) {
          for (const uid of session.depth1UserIds) uniqueUserIds.add(uid);
        }
        console.log(`  Partial resume: restored ${allLeagueIds.size} depth-1 leagues — will resume Step 5b\n`);
      } else {
        // Fully complete — skip to Step 6
        allLeagueIdsSize = allLeagueIds.size;
        console.log(`  Fast resume: restored ${allLeagueIds.size} leagues from session checkpoint (skipped Steps 1–5)\n`);
      }
    } catch {
      console.log("  Session checkpoint load failed — running full discovery\n");
      allLeagueIds.clear();
      uniqueUserIds.clear();
    }
  }

  if (!hasFastResume || allLeagueIds.size === 0) {
    // ── Full run: Steps 1–5 ───────────────────────────────────────────────────
    console.log(`Step 1: Looking up Sleeper user "${config.sleeper_username}"...`);
    const seedUser = await fetchUser(config.sleeper_username);
    seedUserId = seedUser.user_id;
    seedUsername = seedUser.username || config.sleeper_username;
    uniqueUserIds.add(seedUserId);
    userIdToUsername[seedUserId] = seedUsername;
    console.log(`  ✓ user_id = ${seedUserId}\n`);

    // Step 2: Get seed leagues
    console.log(`Step 2: Fetching ${config.sleeper_username}'s leagues for ${config.season}...`);
    const seedLeagues = await fetchUserLeagues(seedUserId, config.season);
    seedLeaguesLength = seedLeagues.length;
    console.log(`  Found ${seedLeaguesLength} leagues.\n`);

    if (seedLeaguesLength === 0) {
      console.log("  No leagues found for this user/season. Nothing to discover.");
      process.exit(0);
    }

    // Step 3: Seed leagues
    if (config.include_seed_user_leagues) {
      for (const league of seedLeagues) {
        allLeagueIds.add(league.league_id);
        leagueDiscoverySource[league.league_id] = {
          source_type: "seed_user",
          discovered_from_user_id: seedUserId,
          discovered_from_username: seedUsername,
          discovered_from_seed_league_id: league.league_id,
        };
      }
      console.log(`Step 3: Seeded ${allLeagueIds.size} leagues from ${config.sleeper_username}'s own leagues.\n`);
    }

    // Step 4+5: Depth-1
    if (config.include_leaguemate_leagues && config.max_network_depth >= 1) {
      console.log("Step 4: Collecting users from seed leagues...");
      const seedLeagueIds = seedLeagues.map((l) => l.league_id);
      await collectUsersFromLeagues(seedLeagueIds);
      const depth1Users = Array.from(uniqueUserIds).filter((id) => id !== seedUserId);
      console.log(`  Found ${depth1Users.length} unique depth-1 leaguemates.\n`);

      console.log("Step 5: Fetching depth-1 leaguemate leagues...");
      const depth1Count = await fetchLeaguesForUsers(depth1Users, "leaguemate");
      console.log(`  Found ${depth1Count} additional leagues at depth 1.\n`);
    }

    if (config.include_leaguemate_leagues && config.max_network_depth >= 2) {
      // Save pre-5b checkpoint: depth-1 leagues + user IDs, depth2Complete: false
      // This lets us resume Step 5b without re-fetching depth-1 from scratch
      fs.writeFileSync(ckptSession, JSON.stringify({
        seedUserId,
        seedUsername,
        seedLeaguesLength,
        allLeagueIdsList: [...allLeagueIds],
        leagueDiscoverySource,
        depth1UserIds: [...uniqueUserIds],
        depth2Complete: false,
      }));
      needsStep5b = true;
    } else {
      // depth-1 only: save final session checkpoint now
      allLeagueIdsSize = allLeagueIds.size;
      fs.writeFileSync(ckptSession, JSON.stringify({
        seedUserId,
        seedUsername,
        seedLeaguesLength,
        allLeagueIdsList: [...allLeagueIds],
        leagueDiscoverySource,
        depth2Complete: true,
      }));
    }
  }

  // ── Step 5b: Depth-2 expansion (fresh run or resumed) ────────────────────────
  if (needsStep5b && config.include_leaguemate_leagues && config.max_network_depth >= 2) {
    // Restore step5b progress if available (saves re-scanning already-processed leagues)
    const processedStep5bIds = new Set<string>();
    const depth1UserSnapshot = new Set(uniqueUserIds); // users known before depth-2 collection

    if (!REFRESH && fs.existsSync(ckptStep5b)) {
      try {
        const p5b = JSON.parse(fs.readFileSync(ckptStep5b, "utf-8")) as {
          processedLeagueIds: string[];
          uniqueUserIds: string[];
          userIdToUsername: Record<string, string>;
        };
        for (const uid of p5b.uniqueUserIds) uniqueUserIds.add(uid);
        Object.assign(userIdToUsername, p5b.userIdToUsername);
        for (const lid of p5b.processedLeagueIds) processedStep5bIds.add(lid);
        console.log(`  Resuming Step 5b: ${processedStep5bIds.size} leagues already processed, ${uniqueUserIds.size} users so far\n`);
      } catch {
        console.log("  Step 5b checkpoint load failed — starting Step 5b from scratch\n");
        processedStep5bIds.clear();
      }
    }

    const remainingLeagueIds = Array.from(allLeagueIds).filter((id) => !processedStep5bIds.has(id));
    console.log(`Step 5b: Depth-2 expansion — collecting users from ${remainingLeagueIds.length} leagues (${processedStep5bIds.size} already done)...`);

    const CONCURRENCY_5B = 50;
    const CKPT_EVERY = 2000;
    for (let i = 0; i < remainingLeagueIds.length; i += CONCURRENCY_5B) {
      const batch = remainingLeagueIds.slice(i, i + CONCURRENCY_5B);
      await Promise.all(batch.map(async (leagueId) => {
        const users = await fetchLeagueUsers(leagueId);
        for (const user of users) {
          if (user.user_id && !uniqueUserIds.has(user.user_id)) {
            uniqueUserIds.add(user.user_id);
            userIdToUsername[user.user_id] = user.username || user.display_name || user.user_id;
          }
        }
        processedStep5bIds.add(leagueId);
      }));
      if ((i + CONCURRENCY_5B) % CKPT_EVERY === 0) {
        fs.writeFileSync(ckptStep5b, JSON.stringify({
          processedLeagueIds: [...processedStep5bIds],
          uniqueUserIds: [...uniqueUserIds],
          userIdToUsername,
        }));
      }
      if (remainingLeagueIds.length > 50 && (i + CONCURRENCY_5B) % 200 === 0) {
        const totalDone = processedStep5bIds.size;
        const totalAll = allLeagueIds.size;
        console.log(`  Users from ${totalDone}/${totalAll} leagues collected...`);
      }
    }

    const newUserCount = uniqueUserIds.size - depth1UserSnapshot.size;
    console.log(`  Found ${newUserCount} new users at depth 2 (${uniqueUserIds.size} total).\n`);

    const allDepth2Users = Array.from(uniqueUserIds).filter((id) => !depth1UserSnapshot.has(id));
    const depth2Users = config.max_depth2_users < Infinity
      ? allDepth2Users.slice(0, config.max_depth2_users)
      : allDepth2Users;
    if (depth2Users.length < allDepth2Users.length) {
      console.log(`  Capping depth-2 to ${depth2Users.length} of ${allDepth2Users.length} users (max_depth2_users limit).\n`);
    }
    console.log(`  Fetching leagues for ${depth2Users.length} new depth-2 users...`);
    const depth2Count = await fetchLeaguesForUsers(depth2Users, "depth2");
    console.log(`  Found ${depth2Count} additional leagues at depth 2.\n`);

    allLeagueIdsSize = allLeagueIds.size;

    // Save final session checkpoint with depth2Complete: true
    fs.writeFileSync(ckptSession, JSON.stringify({
      seedUserId,
      seedUsername,
      seedLeaguesLength,
      allLeagueIdsList: [...allLeagueIds],
      leagueDiscoverySource,
      depth2Complete: true,
    }));
    // Clean up step5b progress checkpoint — no longer needed
    if (fs.existsSync(ckptStep5b)) fs.unlinkSync(ckptStep5b);
  }

  console.log(`Total unique leagues discovered: ${allLeagueIdsSize}\n`);

  // Step 6: Validate all leagues — two-phase with parallelism
  console.log("Step 6: Validating leagues...\n");

  const validLeagues: ValidLeagueEntry[] = [];
  const rejectedLeagues: RejectedLeagueEntry[] = [];
  const leagueIdList = Array.from(allLeagueIds);

  // ── Phase 6a: Pre-filter using already-cached user_leagues data ──────────────
  // user_leagues cache already contains full league settings for most leagues.
  // We can reject obvious invalids without any extra API calls.
  // IMPORTANT: only read *_<season>.json files to avoid loading all prior seasons
  // into memory (the cache can be several GB across multiple seasons).
  const quickMeta: Record<string, SleeperLeague> = {};
  const userLeaguesCacheDir = path.join(CACHE_DIR, "user_leagues");
  const leagueMetaCacheDir = path.join(CACHE_DIR, "league_meta");
  const leagueIdsInRun = allLeagueIds; // Set<string> of IDs discovered this run

  // 1. user_leagues: only read files for the current season
  if (fs.existsSync(userLeaguesCacheDir)) {
    for (const file of fs.readdirSync(userLeaguesCacheDir)) {
      if (!file.endsWith(`_${config.season}.json`)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(userLeaguesCacheDir, file), "utf-8"));
        const leagues: SleeperLeague[] = Array.isArray(raw) ? raw : [raw];
        for (const l of leagues) {
          if (l && l.league_id && leagueIdsInRun.has(l.league_id)) quickMeta[l.league_id] = l;
        }
      } catch { /* skip corrupt cache entries */ }
    }
  }

  // 2. league_meta: only read files whose ID is in our discovered set
  if (fs.existsSync(leagueMetaCacheDir)) {
    for (const leagueId of leagueIdsInRun) {
      if (quickMeta[leagueId]) continue; // already have it from user_leagues
      const fp = path.join(leagueMetaCacheDir, `${leagueId}.json`);
      if (!fs.existsSync(fp)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(fp, "utf-8"));
        if (raw && raw.league_id) quickMeta[raw.league_id] = raw as SleeperLeague;
      } catch { /* skip */ }
    }
  }

  const needsFullValidation: string[] = [];

  for (const leagueId of leagueIdList) {
    const league = quickMeta[leagueId];
    if (!league) {
      // No cached data — must fetch
      needsFullValidation.push(leagueId);
      continue;
    }

    // Quick rejects that don't need draft data
    const seasonType = (league.season_type || "").toLowerCase();
    const name = (league.name || "").toLowerCase();
    const settings = league.settings || {};
    const scoringSettings = league.scoring_settings || {};
    const rosterPositions = league.roster_positions || [];
    const totalRosters = league.total_rosters || 0;

    let quickReject: string | null = null;

    if (league.sport && league.sport !== "nfl") {
      quickReject = `Not NFL (sport=${league.sport})`;
    } else if (seasonType === "dynasty" || DYNASTY_KEYWORDS.test(name) ||
               (settings["taxi_slots"] as number) > 0 || (settings["taxi_years"] as number) > 0) {
      quickReject = "Dynasty league";
    } else if (seasonType === "keeper" || KEEPER_KEYWORDS.test(name) ||
               (settings["num_kept"] as number) > 0) {
      quickReject = "Keeper league";
    } else if ((settings["best_ball"] as number) === 1 || BESTBALL_KEYWORDS.test(name)) {
      quickReject = "Best ball league";
    } else if (totalRosters !== 10 && totalRosters !== 12) {
      quickReject = `League size ${totalRosters} not allowed (only 10 or 12)`;
    } else if (rosterPositions.some((p) => IDP_POSITIONS.has(p))) {
      quickReject = `IDP roster position detected`;
    } else {
      const qbResult = classifyQBFormat(rosterPositions, settings);
      if (!qbResult.format) quickReject = qbResult.reason ?? "Invalid QB format";
    }

    if (quickReject) {
      rejectedLeagues.push({
        season: league.season || config.season,
        league_id: leagueId,
        league_name: league.name || "Unknown",
        total_rosters: totalRosters,
        reason_rejected: quickReject,
        validation_notes: "pre-filtered",
        relevant_settings: {
          season_type: league.season_type,
          status: league.status,
          best_ball: settings["best_ball"],
          taxi_slots: settings["taxi_slots"],
          num_kept: settings["num_kept"],
        },
        roster_positions: rosterPositions,
        scoring_settings: scoringSettings,
      });
    } else {
      needsFullValidation.push(leagueId);
    }
  }

  console.log(`  Pre-filtered: ${leagueIdList.length - needsFullValidation.length} quick rejects`);
  console.log(`  Full validation needed: ${needsFullValidation.length} leagues\n`);

  // ── Phase 6b: Full validation with concurrency ────────────────────────────────
  // Process leagues in parallel batches (CONCURRENCY at a time).
  // Checkpoint files let the run resume if it is killed mid-way.
  const CONCURRENCY = 10;
  const CHECKPOINT_INTERVAL = 100;
  const ckptDir = path.join(ROOT, "data", "tmp");
  const ckptValid = path.join(ckptDir, `discover_ckpt_valid_${config.season}.json`);
  const ckptRejected = path.join(ckptDir, `discover_ckpt_rejected_${config.season}.json`);
  const ckptProcessed = path.join(ckptDir, `discover_ckpt_processed_${config.season}.json`);

  if (!fs.existsSync(ckptDir)) fs.mkdirSync(ckptDir, { recursive: true });

  // Checkpoint stores ONLY Phase 6b (full-validation) results so that Phase 6a
  // quick-rejects (which are re-computed fresh on every run) are never double-counted.
  const phase6bValid: ValidLeagueEntry[] = [];
  const phase6bRejected: RejectedLeagueEntry[] = [];
  const alreadyProcessed = new Set<string>();

  if (fs.existsSync(ckptProcessed) && fs.existsSync(ckptValid) && fs.existsSync(ckptRejected)) {
    try {
      const ids: string[] = JSON.parse(fs.readFileSync(ckptProcessed, "utf-8"));
      const prevValid: ValidLeagueEntry[] = JSON.parse(fs.readFileSync(ckptValid, "utf-8"));
      const prevRejected: RejectedLeagueEntry[] = JSON.parse(fs.readFileSync(ckptRejected, "utf-8"));
      for (const id of ids) alreadyProcessed.add(id);
      phase6bValid.push(...prevValid);
      phase6bRejected.push(...prevRejected);
      console.log(`  Resumed from checkpoint: ${alreadyProcessed.size} already done, ${phase6bValid.length} valid so far`);
    } catch {
      console.log("  Checkpoint load failed — starting from scratch");
      alreadyProcessed.clear();
      phase6bValid.length = 0;
      phase6bRejected.length = 0;
    }
  }

  const remaining = needsFullValidation.filter((id) => !alreadyProcessed.has(id));
  let processed = alreadyProcessed.size;

  async function validateOneFull(leagueId: string): Promise<void> {
    try {
      const [league, users, rosters, drafts] = await Promise.all([
        fetchLeague(leagueId),
        fetchLeagueUsers(leagueId),
        fetchLeagueRosters(leagueId),
        fetchLeagueDrafts(leagueId),
      ]);

      if (!league) {
        phase6bRejected.push({
          season: config.season,
          league_id: leagueId,
          league_name: "Unknown",
          total_rosters: 0,
          reason_rejected: "Could not fetch league data",
          validation_notes: "",
          relevant_settings: {},
          roster_positions: [],
          scoring_settings: {},
        });
        return;
      }

      // Only fetch draft picks if there's a completed snake draft
      const snakeDraft = drafts.find((d) => d.type === "snake");
      const draftPicksList: SleeperDraftPick[][] = [];

      if (snakeDraft && snakeDraft.status === "complete") {
        for (const draft of drafts) {
          const picks = await fetchDraftPicks(draft.draft_id);
          draftPicksList.push(picks);
        }
      } else {
        // Push empty arrays so validateLeague sees no picks
        for (const _ of drafts) draftPicksList.push([]);
      }

      const result = validateLeague(league, drafts, draftPicksList, rosters, users);
      const source = leagueDiscoverySource[leagueId] || {
        source_type: "unknown",
        discovered_from_user_id: "",
        discovered_from_username: "",
        discovered_from_seed_league_id: "",
      };

      if (result.valid) {
        phase6bValid.push({
          season: league.season || config.season,
          league_id: leagueId,
          league_name: league.name || "Unknown",
          total_rosters: league.total_rosters,
          league_size_bucket: result.league_size_bucket!,
          qb_format: result.qb_format!,
          scoring_format: result.scoring_format!,
          tep_format: result.tep_format!,
          pass_td_format: result.pass_td_format!,
          roster_positions: (league.roster_positions || []).join("|"),
          draft_id: snakeDraft?.draft_id || "",
          draft_type: snakeDraft?.type || "snake",
          source_type: source.source_type,
          discovered_from_user_id: source.discovered_from_user_id,
          discovered_from_username: source.discovered_from_username,
          discovered_from_seed_league_id: source.discovered_from_seed_league_id,
          validation_status: "valid",
          validation_notes: "",
        });
      } else {
        const s = league.settings || {};
        phase6bRejected.push({
          season: league.season || config.season,
          league_id: leagueId,
          league_name: league.name || "Unknown",
          total_rosters: league.total_rosters,
          reason_rejected: result.reason_rejected || "Failed validation",
          validation_notes: result.validation_notes || "",
          relevant_settings: {
            season_type: league.season_type,
            status: league.status,
            best_ball: s["best_ball"],
            taxi_slots: s["taxi_slots"],
            num_kept: s["num_kept"],
          },
          roster_positions: league.roster_positions || [],
          scoring_settings: league.scoring_settings || {},
        });
      }
    } catch (err) {
      phase6bRejected.push({
        season: config.season,
        league_id: leagueId,
        league_name: "Unknown",
        total_rosters: 0,
        reason_rejected: `Error during validation: ${(err as Error).message}`,
        validation_notes: "",
        relevant_settings: {},
        roster_positions: [],
        scoring_settings: {},
      });
    } finally {
      processed++;
      alreadyProcessed.add(leagueId);
      if (processed % 100 === 0 || processed === needsFullValidation.length) {
        console.log(`  Full-validated ${processed}/${needsFullValidation.length}...`);
      }
    }
  }

  // Run in batches of CONCURRENCY, saving checkpoints every CHECKPOINT_INTERVAL
  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((id) => validateOneFull(id)));

    // Save checkpoint every CHECKPOINT_INTERVAL leagues (Phase 6b results only)
    if (processed % CHECKPOINT_INTERVAL < CONCURRENCY || i + CONCURRENCY >= remaining.length) {
      fs.writeFileSync(ckptValid, JSON.stringify(phase6bValid));
      fs.writeFileSync(ckptRejected, JSON.stringify(phase6bRejected));
      fs.writeFileSync(ckptProcessed, JSON.stringify([...alreadyProcessed]));
    }
  }

  // Merge Phase 6b results into the main arrays (Phase 6a results already in them)
  validLeagues.push(...phase6bValid);
  rejectedLeagues.push(...phase6bRejected);

  console.log(`\n  Valid: ${validLeagues.length}, Rejected: ${rejectedLeagues.length}\n`);

  // Step 7: Write output files
  console.log("Step 7: Writing output files...\n");

  // Valid leagues CSV (for use with strategy analyzer)
  const csvPath = path.join(INPUT_DIR, `discovered_redraft_leagues_${config.season}.csv`);
  fs.writeFileSync(csvPath, toCSV(validLeagues as unknown as Record<string, unknown>[]));
  console.log(`  ✓ ${csvPath}`);

  // Valid leagues JSON
  const validJsonPath = path.join(OUTPUT_DIR, `discovered_redraft_leagues_${config.season}.json`);
  fs.writeFileSync(validJsonPath, JSON.stringify(validLeagues, null, 2));
  console.log(`  ✓ ${validJsonPath}`);

  // Rejected leagues JSON
  const rejectedJsonPath = path.join(OUTPUT_DIR, `rejected_redraft_leagues_${config.season}.json`);
  fs.writeFileSync(rejectedJsonPath, JSON.stringify(rejectedLeagues, null, 2));
  console.log(`  ✓ ${rejectedJsonPath}`);

  // Format breakdown CSV
  const formatCounts: Record<string, { count: number; teams: number }> = {};
  for (const league of validLeagues) {
    const key = `${league.league_size_bucket}|${league.qb_format}|${league.scoring_format}|${league.tep_format}|${league.pass_td_format}`;
    if (!formatCounts[key]) formatCounts[key] = { count: 0, teams: 0 };
    formatCounts[key].count++;
    formatCounts[key].teams += league.total_rosters;
  }
  const formatBreakdown = Object.entries(formatCounts).map(([key, val]) => {
    const [league_size_bucket, qb_format, scoring_format, tep_format, pass_td_format] = key.split("|");
    return {
      league_size_bucket,
      qb_format,
      scoring_format,
      tep_format,
      pass_td_format,
      league_count: val.count,
      team_count: val.teams,
    };
  });
  const formatBreakdownPath = path.join(OUTPUT_DIR, `redraft_format_breakdown_${config.season}.csv`);
  fs.writeFileSync(formatBreakdownPath, toCSV(formatBreakdown as unknown as Record<string, unknown>[]));
  console.log(`  ✓ ${formatBreakdownPath}`);

  // Discovery summary JSON
  const now = new Date().toISOString();
  const summary = {
    sleeper_username: seedUsername,
    sleeper_user_id: seedUserId,
    season: config.season,
    seed_leagues_found: seedLeaguesLength,
    seed_redraft_leagues_used: seedLeaguesLength,
    unique_users_discovered: allLeagueIdsSize,
    total_leagues_discovered: leagueIdList.length,
    valid_redraft_leagues: validLeagues.length,
    rejected_leagues: rejectedLeagues.length,
    valid_10_team_count: validLeagues.filter((l) => l.league_size_bucket === "10-team").length,
    valid_12_team_count: validLeagues.filter((l) => l.league_size_bucket === "12-team").length,
    valid_1qb_count: validLeagues.filter((l) => l.qb_format === "1QB").length,
    valid_superflex_count: validLeagues.filter((l) => l.qb_format === "Superflex").length,
    valid_no_tep_count: validLeagues.filter((l) => l.tep_format === "No TEP").length,
    valid_tep_05_count: validLeagues.filter((l) => l.tep_format === "TEP +0.5").length,
    valid_tep_075_count: validLeagues.filter((l) => l.tep_format === "TEP +0.75").length,
    valid_4pt_pass_td_count: validLeagues.filter((l) => l.pass_td_format === "4pt Pass TD").length,
    valid_6pt_pass_td_count: validLeagues.filter((l) => l.pass_td_format === "6pt Pass TD").length,
    generated_at: now,
  };
  const summaryPath = path.join(OUTPUT_DIR, `sleeper_discovery_summary_${config.season}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`  ✓ ${summaryPath}`);

  // Step 8: Auto-merge new valid leagues into sleeper_redraft_leagues.csv
  console.log("Step 8: Merging into sleeper_redraft_leagues.csv...");
  const mainCsvPath = path.join(INPUT_DIR, "sleeper_redraft_leagues.csv");
  const existingIds = new Set<string>();

  if (fs.existsSync(mainCsvPath)) {
    const lines = fs.readFileSync(mainCsvPath, "utf-8").trim().split("\n").slice(1);
    for (const line of lines) {
      const parts = line.split(",");
      if (parts[1]) existingIds.add(parts[1].trim());
    }
  }

  const newToMerge = validLeagues.filter((l) => !existingIds.has(l.league_id));

  if (newToMerge.length > 0) {
    const appendRows = newToMerge.map((l) => {
      const notes = (l.league_name || "").replace(/"/g, '""');
      return `${l.season},${l.league_id},"${notes}"`;
    });
    const existing = fs.existsSync(mainCsvPath)
      ? fs.readFileSync(mainCsvPath, "utf-8").trimEnd()
      : "season,league_id,notes";
    fs.writeFileSync(mainCsvPath, existing + "\n" + appendRows.join("\n") + "\n");
    console.log(`  ✓ Added ${newToMerge.length} new leagues (${existingIds.size} already existed)\n`);
  } else {
    console.log(`  ✓ No new leagues to add (all ${validLeagues.length} already in CSV)\n`);
  }

  // Clean up checkpoint files on successful completion
  for (const f of [ckptValid, ckptRejected, ckptProcessed, ckptSession]) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* ignore */ }
  }

  // Done
  console.log(`
══════════════════════════════════════════════
  Discovery Complete!

  Username         : ${config.sleeper_username}
  Season           : ${config.season}
  Leagues found    : ${leagueIdList.length}
  Valid leagues    : ${validLeagues.length}
  New to merge     : ${newToMerge.length}
  Rejected         : ${rejectedLeagues.length}

  Merged into:
  data/input/sleeper_redraft_leagues.csv

  To analyze draft strategies, run:
  pnpm run redraft:update
══════════════════════════════════════════════
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
