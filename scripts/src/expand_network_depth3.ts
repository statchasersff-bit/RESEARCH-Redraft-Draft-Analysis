/**
 * expand_network_depth3.ts
 *
 * Season-aware depth-3/4 network expansion — run in stages:
 *
 *   Stage 1 (discover): fetch user_leagues for N unfetched depth-3 users,
 *   save discovered league IDs to data/output/depth3_candidates_<season>.json.
 *
 *   Stage 2 (validate): read candidates file, validate each league
 *   (fetch + cache meta + draft list), append valid ones to input CSV.
 *
 *   Stage 3 (populate): fetch /league/{id}/users for every newly validated
 *   league and save to cache/league_users/. Enables a second discover pass
 *   to reach depth-4 connections.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run expand:depth3 -- discover [userLimit=2000] --season 2022
 *   pnpm --filter @workspace/scripts run expand:depth3 -- validate [leagueLimit=5000] --season 2022
 *   pnpm --filter @workspace/scripts run expand:depth3 -- populate --season 2022
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");
const ANALYSIS_RAW = path.join(ROOT, "data/raw/sleeper");
const DISC_CACHE = path.join(ROOT, "data/raw/sleeper/cache");
const INPUT_CSV = path.join(ROOT, "data/input/sleeper_redraft_leagues.csv");
const SLEEPER_API = "https://api.sleeper.app/v1";

// ─── CLI args ────────────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const seasonIdx = rawArgs.indexOf("--season");
const SEASON = seasonIdx !== -1 ? (rawArgs[seasonIdx + 1] ?? "2025") : "2025";
const positional = rawArgs.filter(a => !a.startsWith("--") && rawArgs[rawArgs.indexOf(a) - 1] !== "--season");
const stage = positional[0] ?? "discover";
const limitArg = positional[1];

const CANDIDATES_FILE = path.join(ROOT, `data/output/depth3_candidates_${SEASON}.json`);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function cachePath(subdir: string, filename: string) {
  const dir = subdir ? path.join(ANALYSIS_RAW, subdir) : ANALYSIS_RAW;
  ensureDir(dir);
  return path.join(dir, filename);
}
function discPath(subdir: string, filename: string) {
  const dir = path.join(DISC_CACHE, subdir);
  ensureDir(dir);
  return path.join(dir, filename);
}

function readJson<T>(fp: string): T | null {
  if (!fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, "utf-8")) as T; } catch { return null; }
}
function writeJson(fp: string, data: unknown) {
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

async function apiFetch<T>(url: string, delayMs = 120): Promise<T | null> {
  await sleep(delayMs);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch { return null; }
}

// ─── Quick validation (same rules as analyze_redraft_strategy.ts) ─────────────

function quickValidate(
  league: Record<string, unknown>,
  drafts: Array<Record<string, unknown>>
): boolean {
  const s = (league.settings as Record<string, unknown>) ?? {};
  if (league.status !== "complete") return false;
  if (league.sport !== "nfl") return false;
  if (league.season !== SEASON) return false;
  if (Number(s["type"] ?? 0) === 2) return false;              // dynasty
  if (Number(s["best_ball"] ?? league["best_ball"] ?? 0)) return false;
  const n = Number(s["num_teams"] ?? 0);
  if (n < 8 || n > 14) return false;
  const pp = Number(s["playoff_teams"] ?? 4);
  if ((n === 10 || n === 12) && pp !== 6) return false;
  if (!Array.isArray(drafts) || drafts.length === 0) return false;
  const d = drafts[0];
  if (!d) return false;
  if (String(d["type"] ?? "") === "auction") return false;
  if (String(d["status"] ?? "") !== "complete") return false;
  return true;
}

// Fetches league meta, bridging discovery ↔ analysis caches
async function fetchMeta(lid: string): Promise<Record<string, unknown> | null> {
  const ana = cachePath("leagues", `${lid}.json`);
  const disc = discPath("league_meta", `${lid}.json`);
  let d = readJson<Record<string, unknown>>(ana) ?? readJson<Record<string, unknown>>(disc);
  if (!d) {
    d = await apiFetch<Record<string, unknown>>(`${SLEEPER_API}/league/${lid}`);
    if (!d) return null;
    writeJson(disc, d);
  }
  writeJson(ana, d);
  return d;
}

// Fetches draft list, bridging discovery ↔ analysis caches
async function fetchDrafts(lid: string): Promise<Array<Record<string, unknown>> | null> {
  const ana = cachePath("drafts", `${lid}_list.json`);
  const disc = discPath("league_drafts", `${lid}.json`);
  let d = readJson<Array<Record<string, unknown>>>(ana) ?? readJson<Array<Record<string, unknown>>>(disc);
  if (!d) {
    d = await apiFetch<Array<Record<string, unknown>>>(`${SLEEPER_API}/league/${lid}/drafts`);
    if (!d) return null;
    writeJson(disc, d);
  }
  writeJson(ana, d);
  return d;
}

// ─── Stage 1: Discover ────────────────────────────────────────────────────────

async function stageDiscover(userLimit: number) {
  console.log(`\n[Stage 1: Discover] Season: ${SEASON} | up to ${userLimit.toLocaleString()} users\n`);

  const userLeaguesDir = path.join(DISC_CACHE, "user_leagues");
  const leagueMembersDir = path.join(DISC_CACHE, "league_users");

  // Users we've already fetched league lists for (for this season)
  const fetched = new Set<string>();
  if (fs.existsSync(userLeaguesDir)) {
    for (const f of fs.readdirSync(userLeaguesDir)) {
      if (f.endsWith(`_${SEASON}.json`)) {
        fetched.add(f.replace(`_${SEASON}.json`, ""));
      }
    }
  }
  console.log(`Already fetched for ${SEASON}: ${fetched.size.toLocaleString()} users`);

  // Load existing candidates file (to accumulate across runs)
  type CandidatesFile = { leagueIds: string[]; fetchedUsers: string[]; pendingUsers?: string[]; scanDone?: boolean };
  const existing = readJson<CandidatesFile>(CANDIDATES_FILE);
  const alreadyInCandidates = new Set<string>(existing?.leagueIds ?? []);
  const alreadyFetchedInRun = new Set<string>(existing?.fetchedUsers ?? []);

  // Scan league_users files for unseen user IDs — skip if we already have a saved pending list
  let pendingUsers: string[];
  if (existing?.scanDone && existing.pendingUsers && existing.pendingUsers.length > 0) {
    pendingUsers = existing.pendingUsers.filter(uid => !fetched.has(uid) && !alreadyFetchedInRun.has(uid));
    console.log(`Resumed pending user list: ${pendingUsers.length.toLocaleString()} unfetched`);
  } else {
    // Support resuming a partial scan via scanOffset
    type ScanCkpt = { leagueIds: string[]; fetchedUsers: string[]; pendingUsers?: string[]; scanDone?: boolean; scanOffset?: number; scanCandidates?: string[] };
    const ckpt = readJson<ScanCkpt>(CANDIDATES_FILE);
    const scanOffset = ckpt?.scanOffset ?? 0;
    const priorCandidates = new Set<string>(ckpt?.scanCandidates ?? []);

    console.log(`Scanning ${leagueMembersDir}${scanOffset ? ` (resuming from file ${scanOffset.toLocaleString()})` : ""}...`);
    const candidates = new Set<string>(priorCandidates);
    if (fs.existsSync(leagueMembersDir)) {
      const files = fs.readdirSync(leagueMembersDir);
      let i = 0;
      for (const f of files) {
        i++;
        if (i <= scanOffset) continue; // skip already-scanned files
        if (i % 10000 === 0) {
          process.stdout.write(`\r  Scanned ${i.toLocaleString()}/${files.length.toLocaleString()}...`);
          // Save mid-scan checkpoint every 10k files
          writeJson(CANDIDATES_FILE, {
            leagueIds: Array.from(alreadyInCandidates),
            fetchedUsers: Array.from(alreadyFetchedInRun),
            scanDone: false,
            scanOffset: i,
            scanCandidates: Array.from(candidates),
          });
        }
        try {
          const members = JSON.parse(fs.readFileSync(path.join(leagueMembersDir, f), "utf-8"));
          if (!Array.isArray(members)) continue;
          for (const m of members) {
            if (m?.user_id && !fetched.has(m.user_id) && !alreadyFetchedInRun.has(m.user_id)) {
              candidates.add(m.user_id);
            }
          }
        } catch { /* skip */ }
      }
      console.log(`\r  Scanned all ${files.length.toLocaleString()} league_users files.     `);
    }
    pendingUsers = Array.from(candidates);
    console.log(`Unfetched depth candidates: ${pendingUsers.length.toLocaleString()}`);
    // Save the pending list so future runs skip the scan
    writeJson(CANDIDATES_FILE, {
      leagueIds: Array.from(alreadyInCandidates),
      fetchedUsers: Array.from(alreadyFetchedInRun),
      pendingUsers,
      scanDone: true,
    });
    console.log(`  Scan checkpoint saved. Resuming fetches...`);
  }

  // Load existing leagues in CSV
  const csvIds = new Set<string>();
  if (fs.existsSync(INPUT_CSV)) {
    for (const line of fs.readFileSync(INPUT_CSV, "utf-8").split("\n").slice(1)) {
      const id = line.split(",")[1]?.trim();
      if (id) csvIds.add(id);
    }
  }

  // Fetch user_leagues in parallel batches
  const batch = pendingUsers.slice(0, userLimit);
  const remaining = pendingUsers.slice(userLimit); // users beyond this batch
  const CONC = 60;
  const newLeagueIds = new Set<string>(alreadyInCandidates);
  const fetchedInThisRun: string[] = [...(existing?.fetchedUsers ?? [])];
  let done = 0;

  for (let i = 0; i < batch.length; i += CONC) {
    const chunk = batch.slice(i, i + CONC);
    await Promise.all(chunk.map(async (uid) => {
      const fp = path.join(userLeaguesDir, `${uid}_${SEASON}.json`);
      let leagues: any[];
      if (fs.existsSync(fp)) {
        try { leagues = JSON.parse(fs.readFileSync(fp, "utf-8")); }
        catch { return; }
      } else {
        const data = await apiFetch<any[]>(`${SLEEPER_API}/user/${uid}/leagues/nfl/${SEASON}`, 100);
        if (!data) return;
        leagues = data;
        fs.writeFileSync(fp, JSON.stringify(leagues, null, 2));
      }
      fetchedInThisRun.push(uid);
      for (const l of leagues ?? []) {
        if (l?.league_id && !csvIds.has(l.league_id)) newLeagueIds.add(l.league_id);
      }
    }));
    done += chunk.length;
    if (done % 600 === 0 || done === batch.length) {
      process.stdout.write(`\r  Fetched ${done.toLocaleString()}/${batch.length.toLocaleString()} users, ${newLeagueIds.size.toLocaleString()} candidate leagues...`);
      // Periodic save so progress isn't lost on timeout
      writeJson(CANDIDATES_FILE, {
        leagueIds: Array.from(newLeagueIds),
        fetchedUsers: fetchedInThisRun,
        pendingUsers: remaining,
        scanDone: true,
      });
    }
  }
  console.log();

  // Final save — pending list cleared of the batch we just processed
  writeJson(CANDIDATES_FILE, {
    leagueIds: Array.from(newLeagueIds),
    fetchedUsers: fetchedInThisRun,
    pendingUsers: remaining,
    scanDone: true,
  });
  console.log(`\n✓ Saved ${newLeagueIds.size.toLocaleString()} candidate leagues to ${path.basename(CANDIDATES_FILE)}`);
  if (remaining.length > 0) {
    console.log(`  ${remaining.length.toLocaleString()} more users queued — run discover again to fetch the next batch.`);
  }
  console.log(`  Run 'expand:depth3 -- validate --season ${SEASON}' to validate and append to CSV.\n`);
}

// ─── Stage 2: Validate ────────────────────────────────────────────────────────

async function stageValidate(leagueLimit: number) {
  type CandidatesFile = { leagueIds: string[]; fetchedUsers: string[]; pendingUsers?: string[]; scanDone?: boolean; scanOffset?: number; scanCandidates?: string[] };
  const data = readJson<CandidatesFile>(CANDIDATES_FILE);
  if (!data?.leagueIds?.length) {
    console.log("No candidates file found. Run stage 'discover' first.");
    return;
  }

  // Load existing CSV ids
  const loadCsvIds = () => {
    const ids = new Set<string>();
    if (fs.existsSync(INPUT_CSV)) {
      for (const line of fs.readFileSync(INPUT_CSV, "utf-8").split("\n").slice(1)) {
        const id = line.split(",")[1]?.trim();
        if (id) ids.add(id);
      }
    }
    return ids;
  };
  let csvIds = loadCsvIds();

  // Flush valid leagues to CSV and remove from candidates file
  const flush = (validLeagues: string[], remaining: string[]) => {
    if (validLeagues.length > 0) {
      const rows = validLeagues.map(id => `${SEASON},${id},`);
      const existingCsv = fs.readFileSync(INPUT_CSV, "utf-8").trimEnd();
      fs.writeFileSync(INPUT_CSV, existingCsv + "\n" + rows.join("\n") + "\n");
      validLeagues.forEach(id => csvIds.add(id));
    }
    writeJson(CANDIDATES_FILE, { ...data, leagueIds: remaining, fetchedUsers: [] });
  };

  // Filter to only truly new candidates
  const toValidate = data.leagueIds.filter(id => !csvIds.has(id)).slice(0, leagueLimit);
  console.log(`\n[Stage 2: Validate] Season: ${SEASON} | ${toValidate.length.toLocaleString()} candidates (limit: ${leagueLimit.toLocaleString()})...\n`);

  const CONC = 80;
  const FLUSH_EVERY = 1600; // flush to disk every N validated
  const validLeagues: string[] = [];
  const processedIds = new Set<string>();
  let done = 0;
  let valid = 0;
  let invalid = 0;
  let errors = 0;

  for (let i = 0; i < toValidate.length; i += CONC) {
    const chunk = toValidate.slice(i, i + CONC);
    const results = await Promise.all(chunk.map(async (lid) => {
      try {
        const [meta, drafts] = await Promise.all([fetchMeta(lid), fetchDrafts(lid)]);
        if (!meta || !drafts) return "error";
        return quickValidate(meta, drafts) ? "valid" : "invalid";
      } catch { return "error"; }
    }));
    for (let j = 0; j < results.length; j++) {
      processedIds.add(chunk[j]);
      if (results[j] === "valid") { valid++; validLeagues.push(chunk[j]); }
      else if (results[j] === "invalid") invalid++;
      else errors++;
    }
    done += chunk.length;
    if (done % 800 === 0 || done === toValidate.length) {
      process.stdout.write(`\r  Validated ${done.toLocaleString()}/${toValidate.length.toLocaleString()} | valid: ${valid.toLocaleString()} | invalid: ${invalid.toLocaleString()} | errors: ${errors}`);
    }
    // Periodic flush — write valid leagues to CSV and remove processed from candidates
    if (done % FLUSH_EVERY === 0 || done === toValidate.length) {
      const toFlush = validLeagues.splice(0);
      const remaining = data.leagueIds.filter(id => !processedIds.has(id) && !csvIds.has(id));
      flush(toFlush, remaining);
      if (toFlush.length > 0) {
        process.stdout.write(`  [flushed ${toFlush.length} valid]\n`);
      }
    }
  }
  console.log();

  // Reload final CSV count for reporting
  const finalCsvIds = loadCsvIds();
  console.log(`\n✓ Validate complete | ${valid.toLocaleString()} valid leagues added`);
  console.log(`  Total CSV leagues: ${finalCsvIds.size.toLocaleString()}`);
  const finalRemaining = data.leagueIds.filter(id => !processedIds.has(id) && !finalCsvIds.has(id));
  console.log(`  Remaining candidates for next run: ${finalRemaining.length.toLocaleString()}`);
  if (valid > 0) {
    console.log(`\n  For depth-4: run 'expand:depth3 -- populate --season ${SEASON}' then discover again.\n`);
  }
}

// ─── Stage 3: Populate ────────────────────────────────────────────────────────
// Fetches /league/{id}/users for every league in the CSV that doesn't yet have
// a league_users cache entry. This exposes new user IDs so a subsequent
// discover pass reaches the next degree of connections.

async function stagePopulate() {
  console.log(`\n[Stage 3: Populate] Season: ${SEASON} | fetching league member lists...\n`);

  const leagueMembersDir = path.join(DISC_CACHE, "league_users");
  ensureDir(leagueMembersDir);

  // Load all league IDs for this season from CSV
  const csvLeagues: string[] = [];
  if (fs.existsSync(INPUT_CSV)) {
    for (const line of fs.readFileSync(INPUT_CSV, "utf-8").split("\n").slice(1)) {
      const parts = line.split(",");
      const season = parts[0]?.trim();
      const id = parts[1]?.trim();
      if (id && season === SEASON) csvLeagues.push(id);
    }
  }
  console.log(`  Found ${csvLeagues.length.toLocaleString()} ${SEASON} leagues in CSV`);

  // Only fetch for leagues that don't have a league_users entry yet
  const toFetch = csvLeagues.filter(id => !fs.existsSync(path.join(leagueMembersDir, `${id}.json`)));
  console.log(`  Already cached: ${(csvLeagues.length - toFetch.length).toLocaleString()} | To fetch: ${toFetch.length.toLocaleString()}\n`);

  if (toFetch.length === 0) {
    console.log("  All league member lists already cached. Ready for next discover pass.\n");
    return;
  }

  const CONC = 60;
  let done = 0;
  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < toFetch.length; i += CONC) {
    const chunk = toFetch.slice(i, i + CONC);
    await Promise.all(chunk.map(async (lid) => {
      const fp = path.join(leagueMembersDir, `${lid}.json`);
      const data = await apiFetch<unknown[]>(`${SLEEPER_API}/league/${lid}/users`, 100);
      if (data && Array.isArray(data)) {
        fs.writeFileSync(fp, JSON.stringify(data, null, 2));
        fetched++;
      } else {
        failed++;
      }
    }));
    done += chunk.length;
    if (done % 300 === 0 || done === toFetch.length) {
      process.stdout.write(`\r  Fetched ${done.toLocaleString()}/${toFetch.length.toLocaleString()} | ok: ${fetched.toLocaleString()} | failed: ${failed}`);
    }
  }
  console.log();
  console.log(`\n✓ Populated ${fetched.toLocaleString()} league member lists (${failed} failed)`);
  console.log(`  Now run 'expand:depth3 -- discover --season ${SEASON}' for the next degree.\n`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

console.log(`\nexpand_network_depth3 | season: ${SEASON} | stage: ${stage}\n`);

const limit = parseInt(limitArg ?? "0", 10);

if (stage === "validate") {
  stageValidate(limit || 5000).catch(err => { console.error("Fatal:", err); process.exit(1); });
} else if (stage === "populate") {
  stagePopulate().catch(err => { console.error("Fatal:", err); process.exit(1); });
} else if (stage === "discover" || !stage) {
  stageDiscover(limit || 2000).catch(err => { console.error("Fatal:", err); process.exit(1); });
} else {
  console.error(`Unknown stage: ${stage}. Use 'discover', 'validate', or 'populate'.`);
  process.exit(1);
}
