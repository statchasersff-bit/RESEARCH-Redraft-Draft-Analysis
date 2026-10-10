/**
 * analyze_redraft_strategy.ts
 *
 * Takes fetched raw Sleeper data, validates leagues, and runs all analysis.
 * Exports JSON output files to data/output/.
 */

import type { FetchedLeagueData } from "./fetch_sleeper_redraft_data.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StrategyMetrics {
  strategy: string;
  sample_size: number;
  average_points_for: number;
  median_points_for: number;
  average_wins: number;
  playoff_rate: number;
  finals_rate: number;
  championship_rate: number;
  top_3_pf_rate: number;
  average_final_standing: number;
  confidence_level: string;
  playoff_rate_lift: number;
  championship_rate_lift: number;
  top_3_pf_rate_lift: number;
  points_for_lift: number;
}

export interface TeamRecord {
  league_id: string;
  season: string;
  roster_id: number;
  owner_id: string;
  league_size: number;
  scoring_format: string;
  roster_format: string;
  draft_type: string;
  tep: boolean;

  // Outcomes
  regular_season_wins: number;
  regular_season_losses: number;
  regular_season_ties: number;
  regular_season_points_for: number;
  regular_season_points_against: number;
  average_weekly_score: number;
  median_weekly_score: number;
  top_3_points_for: boolean;
  expected_playoff_rate: number; // theoretical rate = playoff_spots / league_size
  playoff_made: boolean;
  championship_made: boolean;
  champion: boolean;
  final_standing: number | null;

  // Draft profile
  draft_slot: number;
  draft_slot_group: string;
  first_pick_position: string;
  first_pick_player: string;
  first_two_pick_combo: string;
  first_three_pick_combo: string;
  first_five_pick_combo: string;
  first_five_round_positions: string[];
  first_eight_round_positions: string[];
  rb_count_rounds_1_5: number;
  wr_count_rounds_1_5: number;
  qb_count_rounds_1_5: number;
  te_count_rounds_1_5: number;
  rb_count_rounds_1_8: number;
  wr_count_rounds_1_8: number;
  qb_count_rounds_1_8: number;
  te_count_rounds_1_8: number;
  first_qb_round: number | null;
  first_rb_round: number | null;
  first_wr_round: number | null;
  first_te_round: number | null;

  // Strategies (a team can belong to multiple)
  strategies: string[];
}

export interface LeagueAuditEntry {
  league_id: string;
  season: string;
  status: "success" | "skipped" | "failed";
  reason?: string;
  notes?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  season_type: string;
  status: string;
  settings: Record<string, number | string>;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  total_rosters: number;
};

type SleeperRoster = {
  roster_id: number;
  owner_id: string;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal: number;
    fpts_against: number;
    fpts_against_decimal: number;
  };
  players: string[];
};

type SleeperMatchup = {
  roster_id: number;
  points: number;
  matchup_id: number;
};

type SleeperBracketGame = {
  r: number; // round
  m: number; // match id
  t1: number | null; // roster_id team 1
  t2: number | null; // roster_id team 2
  w: number | null; // winner roster_id
  l: number | null; // loser roster_id
};

type SleeperDraftPick = {
  draft_slot: number;
  pick_no: number;
  round: number;
  roster_id: number;
  picked_by: string;
  player_id: string;
  metadata?: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
    player_id?: string;
  };
};

type SleeperDraft = {
  draft_id: string;
  draft_order: Record<string, number> | null;
  slot_to_roster_id: Record<string, number> | null;
  type: string;
  status: string;
  settings: {
    rounds: number;
    teams: number;
  };
};

function classifyScoringFormat(scoringSettings: Record<string, number>): string {
  const rec = scoringSettings["rec"] ?? 0;
  if (rec === 0) return "Standard";
  if (rec === 0.5) return "Half PPR";
  if (rec === 1) return "PPR";
  return "Other PPR";
}

function classifyRosterFormat(rosterPositions: string[]): string {
  if (rosterPositions.includes("SUPER_FLEX") || rosterPositions.includes("OP")) {
    return "Superflex";
  }
  const qbCount = rosterPositions.filter((p) => p === "QB").length;
  if (qbCount >= 2) return "2QB";
  if (qbCount === 1) return "1QB";
  return "Other";
}

function getDraftSlotGroup(slot: number, leagueSize: number): string {
  if (leagueSize === 12) {
    if (slot <= 4) return "Early";
    if (slot <= 8) return "Middle";
    return "Late";
  } else if (leagueSize === 10) {
    if (slot <= 3) return "Early";
    if (slot <= 7) return "Middle";
    return "Late";
  } else {
    const third = Math.floor(leagueSize / 3);
    if (slot <= third) return "Early";
    if (slot <= third * 2) return "Middle";
    return "Late";
  }
}

function confidenceLevel(sampleSize: number): string {
  if (sampleSize >= 250) return "High";
  if (sampleSize >= 75) return "Medium";
  if (sampleSize >= 25) return "Low";
  return "Very Low";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeMetrics(
  teams: TeamRecord[],
  key: string,
  baseline: {
    playoff_rate: number;
    championship_rate: number;
    top_3_pf_rate: number;
    average_points_for: number;
  }
): StrategyMetrics {
  const n = teams.length;
  if (n === 0) {
    return {
      strategy: key,
      sample_size: 0,
      average_points_for: 0,
      median_points_for: 0,
      average_wins: 0,
      playoff_rate: 0,
      finals_rate: 0,
      championship_rate: 0,
      top_3_pf_rate: 0,
      average_final_standing: 0,
      confidence_level: "Very Low",
      playoff_rate_lift: 0,
      championship_rate_lift: 0,
      top_3_pf_rate_lift: 0,
      points_for_lift: 0,
    };
  }
  const pts = teams.map((t) => t.regular_season_points_for);
  const avg_pts = pts.reduce((a, b) => a + b, 0) / n;
  const avg_wins = teams.map((t) => t.regular_season_wins).reduce((a, b) => a + b, 0) / n;
  const playoff_rate = teams.filter((t) => t.playoff_made).length / n;
  const finals_rate = teams.filter((t) => t.championship_made).length / n;
  const champ_rate = teams.filter((t) => t.champion).length / n;
  const top3_rate = teams.filter((t) => t.top_3_points_for).length / n;
  const standings = teams.map((t) => t.final_standing ?? 0).filter(Boolean);
  const avg_standing = standings.length ? standings.reduce((a, b) => a + b, 0) / standings.length : 0;

  return {
    strategy: key,
    sample_size: n,
    average_points_for: Math.round(avg_pts * 100) / 100,
    median_points_for: Math.round(median(pts) * 100) / 100,
    average_wins: Math.round(avg_wins * 100) / 100,
    playoff_rate: Math.round(playoff_rate * 1000) / 1000,
    finals_rate: Math.round(finals_rate * 1000) / 1000,
    championship_rate: Math.round(champ_rate * 1000) / 1000,
    top_3_pf_rate: Math.round(top3_rate * 1000) / 1000,
    average_final_standing: Math.round(avg_standing * 100) / 100,
    confidence_level: confidenceLevel(n),
    playoff_rate_lift: Math.round((playoff_rate - baseline.playoff_rate) * 1000) / 10,
    championship_rate_lift: Math.round((champ_rate - baseline.championship_rate) * 1000) / 10,
    top_3_pf_rate_lift: Math.round((top3_rate - baseline.top_3_pf_rate) * 1000) / 10,
    points_for_lift: Math.round((avg_pts - baseline.average_points_for) * 100) / 100,
  };
}

function sortByPlayoffRate(metrics: StrategyMetrics[]): StrategyMetrics[] {
  return [...metrics].sort((a, b) => b.playoff_rate - a.playoff_rate);
}

// ─── Validator ────────────────────────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  reason?: string;
  season_type?: string;
  league_size?: number;
  scoring_format?: string;
  roster_format?: string;
  draft_type?: string;
}

export function validateLeague(
  league: SleeperLeague,
  drafts: Array<{ draft_id: string }>,
  draftDetails: (SleeperDraft | null)[]
): ValidationResult {
  if (!league) return { valid: false, reason: "No league data" };

  // Skip dynasty/keeper/best ball
  const season_type = league.season_type?.toLowerCase() || "";
  if (season_type === "dynasty") return { valid: false, reason: "Dynasty league" };
  if (season_type === "keeper") return { valid: false, reason: "Keeper league" };

  const settings = league.settings || {};

  // Check for best ball
  if (settings["best_ball"] === 1) return { valid: false, reason: "Best ball league" };

  // League size
  const leagueSize = league.total_rosters || 0;
  if (leagueSize < 8 || leagueSize > 14) {
    return { valid: false, reason: `League size ${leagueSize} out of range (8-14)` };
  }

  // For 10- and 12-team leagues, require exactly 6 playoff spots (standard format)
  if (leagueSize === 12 || leagueSize === 10) {
    const playoffTeams = settings["playoff_teams"] ?? 0;
    if (playoffTeams !== 6) {
      return { valid: false, reason: `${leagueSize}-team league with ${playoffTeams} playoff spots (require 6)` };
    }
  }

  // Must have draft
  if (!drafts || drafts.length === 0) {
    return { valid: false, reason: "No draft found" };
  }

  // Check draft type
  const draft = draftDetails.find(Boolean) as SleeperDraft | null;
  if (!draft) return { valid: false, reason: "No draft detail data" };
  if (draft.type === "auction") return { valid: false, reason: "Auction draft" };
  if (draft.status !== "complete") return { valid: false, reason: `Draft not complete (status: ${draft.status})` };

  const scoring_format = classifyScoringFormat(league.scoring_settings || {});
  const roster_format = classifyRosterFormat(league.roster_positions || []);
  const draft_type = draft.type || "snake";

  // Validate roster positions against required settings
  const positions = league.roster_positions || [];
  const qbCount    = positions.filter((p) => p === "QB").length;
  const rbCount    = positions.filter((p) => p === "RB").length;
  const teCount    = positions.filter((p) => p === "TE").length;
  const flexCount  = positions.filter((p) => p === "FLEX" || p === "WR/RB/TE").length;
  const sfCount    = positions.filter((p) => p === "SUPER_FLEX" || p === "OP").length;

  if (roster_format === "1QB") {
    // Require: exactly 1 QB, 2 RB, 1 TE, 1-3 WRT flex
    if (qbCount !== 1)
      return { valid: false, reason: `1QB roster: ${qbCount} QB slots (require 1)` };
    if (rbCount !== 2)
      return { valid: false, reason: `1QB roster: ${rbCount} RB slots (require 2)` };
    if (teCount !== 1)
      return { valid: false, reason: `1QB roster: ${teCount} TE slots (require 1)` };
    if (flexCount < 1 || flexCount > 3)
      return { valid: false, reason: `1QB roster: ${flexCount} FLEX slots (require 1-3)` };
  } else if (roster_format === "Superflex" || roster_format === "2QB") {
    // Require: qb+sf == 2 (covers 2QB, 2 SUPER_FLEX, or 1 QB + 1 SUPER_FLEX)
    const qbSfTotal = qbCount + sfCount;
    if (qbSfTotal !== 2)
      return { valid: false, reason: `Superflex roster: ${qbSfTotal} QB/SF slots (require 2)` };
    if (rbCount !== 2)
      return { valid: false, reason: `Superflex roster: ${rbCount} RB slots (require 2)` };
    if (teCount !== 1)
      return { valid: false, reason: `Superflex roster: ${teCount} TE slots (require 1)` };
    if (flexCount < 1 || flexCount > 3)
      return { valid: false, reason: `Superflex roster: ${flexCount} FLEX slots (require 1-3)` };
  } else {
    // "Other" format — non-standard, exclude from analysis
    return { valid: false, reason: `Non-standard roster format (no QB/SF classification)` };
  }

  return {
    valid: true,
    season_type,
    league_size: leagueSize,
    scoring_format,
    roster_format,
    draft_type,
  };
}

// ─── Team Builder ─────────────────────────────────────────────────────────────

export function buildTeamRecords(
  fetched: FetchedLeagueData,
  validation: ValidationResult,
  nflPlayers: Record<string, { full_name?: string; position?: string; team?: string }>
): TeamRecord[] {
  const league = fetched.league as SleeperLeague;
  const rosters = (fetched.rosters as SleeperRoster[]) || [];
  const matchupsByWeek = fetched.matchups;
  const winnersBracket = fetched.winnersBracket as SleeperBracketGame[] | null;

  const { league_id, season } = fetched.input;
  const {
    league_size = 0,
    scoring_format = "Unknown",
    roster_format = "Unknown",
    draft_type = "snake",
  } = validation;

  // TEP: Tight End Premium — bonus reception points for TEs
  const scoringSettings = league.scoring_settings || {};
  const tep = (scoringSettings["bonus_rec_te"] ?? 0) > 0;

  // Build weekly scores per roster
  const weeklyScores: Record<number, number[]> = {};
  for (const [, matchups] of Object.entries(matchupsByWeek)) {
    for (const matchup of matchups as SleeperMatchup[]) {
      if (!matchup?.roster_id || matchup.points == null) continue;
      if (!weeklyScores[matchup.roster_id]) weeklyScores[matchup.roster_id] = [];
      weeklyScores[matchup.roster_id].push(matchup.points);
    }
  }

  // Compute total points for all teams for top-3 detection
  const totalPointsByRoster: Record<number, number> = {};
  for (const roster of rosters) {
    const rosterId = roster.roster_id;
    const fpts =
      (roster.settings?.fpts || 0) +
      (roster.settings?.fpts_decimal || 0) / 100;
    totalPointsByRoster[rosterId] = fpts || 0;
  }

  const sortedByPts = Object.entries(totalPointsByRoster)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => Number(id));
  const top3RosterIds = new Set(sortedByPts.slice(0, 3));

  // Determine playoff/champion from winners bracket
  const playoffRosters = new Set<number>();
  const finalistRosters = new Set<number>();
  let champion: number | null = null;

  if (winnersBracket && winnersBracket.length > 0) {
    // All teams that appear in bracket are in playoffs
    for (const game of winnersBracket) {
      if (game.t1) playoffRosters.add(game.t1);
      if (game.t2) playoffRosters.add(game.t2);
    }
    // Find championship game (highest round)
    const maxRound = Math.max(...winnersBracket.map((g) => g.r));
    const champGames = winnersBracket.filter((g) => g.r === maxRound);
    for (const game of champGames) {
      if (game.t1) finalistRosters.add(game.t1);
      if (game.t2) finalistRosters.add(game.t2);
      if (game.w) champion = game.w;
    }
  } else {
    // Fallback: use roster standings
    const sorted = [...rosters].sort(
      (a, b) =>
        (b.settings?.wins || 0) - (a.settings?.wins || 0) ||
        totalPointsByRoster[b.roster_id] - totalPointsByRoster[a.roster_id]
    );
    const playoffCount = Math.ceil(league_size / 3);
    sorted.slice(0, playoffCount).forEach((r) => playoffRosters.add(r.roster_id));
    finalistRosters.add(sorted[0].roster_id);
    if (sorted[1]) finalistRosters.add(sorted[1].roster_id);
    champion = sorted[0].roster_id;
  }

  // Map draft picks per roster
  const allPicks: SleeperDraftPick[] = (fetched.draftPicks.flat() as SleeperDraftPick[]);

  // Build roster_id -> draft_slot mapping
  const draftDetail = (fetched.draftDetails.find(Boolean) as SleeperDraft | null);
  const slotToRosterId: Record<number, number> = {};
  if (draftDetail?.slot_to_roster_id) {
    for (const [slot, rid] of Object.entries(draftDetail.slot_to_roster_id)) {
      slotToRosterId[Number(slot)] = rid;
    }
  }
  const rosterIdToSlot: Record<number, number> = {};
  for (const [slot, rid] of Object.entries(slotToRosterId)) {
    rosterIdToSlot[rid] = Number(slot);
  }

  // Fallback: infer slot from first pick in round 1
  if (Object.keys(rosterIdToSlot).length === 0) {
    const round1Picks = allPicks.filter((p) => p.round === 1);
    round1Picks.sort((a, b) => a.pick_no - b.pick_no);
    round1Picks.forEach((pick, idx) => {
      if (pick.roster_id && !rosterIdToSlot[pick.roster_id]) {
        rosterIdToSlot[pick.roster_id] = idx + 1;
      }
    });
  }

  const picksByRoster: Record<number, SleeperDraftPick[]> = {};
  for (const pick of allPicks) {
    if (!pick.roster_id) continue;
    if (!picksByRoster[pick.roster_id]) picksByRoster[pick.roster_id] = [];
    picksByRoster[pick.roster_id].push(pick);
  }

  // Build team records
  const teams: TeamRecord[] = [];

  for (const roster of rosters) {
    const rosterId = roster.roster_id;
    const settings = roster.settings || { wins: 0, losses: 0, ties: 0, fpts: 0, fpts_decimal: 0, fpts_against: 0, fpts_against_decimal: 0 };

    const pts_for = (settings.fpts || 0) + (settings.fpts_decimal || 0) / 100;
    const pts_against = (settings.fpts_against || 0) + (settings.fpts_against_decimal || 0) / 100;

    const weekly = weeklyScores[rosterId] || [];
    const avg_weekly = weekly.length ? weekly.reduce((a, b) => a + b, 0) / weekly.length : 0;

    // Draft picks for this roster
    const picks = (picksByRoster[rosterId] || []).sort((a, b) => a.round - b.round || a.pick_no - b.pick_no);

    if (picks.length === 0) continue; // Skip teams with no draft data

    // Enrich pick positions
    const enrichedPicks = picks.map((pick) => {
      let position = pick.metadata?.position || "";
      let playerName = "";
      if (pick.metadata?.first_name || pick.metadata?.last_name) {
        playerName = `${pick.metadata.first_name || ""} ${pick.metadata.last_name || ""}`.trim();
      }
      const nflPlayer = nflPlayers[pick.player_id];
      if (!position && nflPlayer?.position) position = nflPlayer.position;
      if (!playerName && nflPlayer?.full_name) playerName = nflPlayer.full_name;
      return { ...pick, position: position || "UNK", playerName };
    });

    // Positional sequences
    const positions = enrichedPicks.map((p) => p.position);
    const first5 = positions.slice(0, 5);
    const first8 = positions.slice(0, 8);

    const posCount = (posArr: string[], pos: string) =>
      posArr.filter((p) => p === pos).length;

    const firstRoundOf = (pos: string): number | null => {
      const p = enrichedPicks.find((pick) => pick.position === pos);
      return p ? p.round : null;
    };

    const draftSlot = rosterIdToSlot[rosterId] || 0;

    // Strategy classification
    const rb5 = posCount(first5, "RB");
    const wr5 = posCount(first5, "WR");

    const first_qb_round = firstRoundOf("QB");
    const first_te_round = firstRoundOf("TE");

    // Core strategy — exactly one per team (mutually exclusive)
    let coreStrategy: string;
    if (rb5 === 0) {
      coreStrategy = "Zero RB";
    } else if (rb5 >= 3) {
      coreStrategy = "Robust RB";
    } else if (rb5 === 1) {
      coreStrategy = "Hero RB";
    } else if (wr5 >= 3) {
      coreStrategy = "WR Heavy";
    } else {
      coreStrategy = "Balanced";
    }

    const strategies: string[] = [coreStrategy];

    // Positional timing overlays — independent of core strategy
    if (first_qb_round !== null && first_qb_round <= 4) strategies.push("Elite QB");
    if (first_te_round !== null && first_te_round <= 2) strategies.push("Elite TE");
    if (first_qb_round === null || first_qb_round >= 8) strategies.push("Late QB");
    if (first_te_round === null || first_te_round >= 8) strategies.push("Late TE");

    const firstPick = enrichedPicks[0];
    const secondPick = enrichedPicks[1];

    const team: TeamRecord = {
      league_id,
      season,
      roster_id: rosterId,
      owner_id: roster.owner_id || "",
      league_size,
      scoring_format,
      roster_format,
      draft_type,
      tep,

      regular_season_wins: settings.wins || 0,
      regular_season_losses: settings.losses || 0,
      regular_season_ties: settings.ties || 0,
      regular_season_points_for: Math.round(pts_for * 100) / 100,
      regular_season_points_against: Math.round(pts_against * 100) / 100,
      average_weekly_score: Math.round(avg_weekly * 100) / 100,
      median_weekly_score: Math.round(median(weekly) * 100) / 100,
      top_3_points_for: top3RosterIds.has(rosterId),
      expected_playoff_rate: league_size > 0 ? (Number(league.settings?.["playoff_teams"] ?? 0)) / league_size : 0,
      playoff_made: playoffRosters.has(rosterId),
      championship_made: finalistRosters.has(rosterId),
      champion: champion === rosterId,
      final_standing: null, // set below

      draft_slot: draftSlot,
      draft_slot_group: draftSlot ? getDraftSlotGroup(draftSlot, league_size) : "Unknown",
      first_pick_position: firstPick?.position || "UNK",
      first_pick_player: firstPick?.playerName || "",
      first_two_pick_combo: `${firstPick?.position || "UNK"}/${secondPick?.position || "UNK"}`,
      first_three_pick_combo: positions.slice(0, 3).join("/"),
      first_five_pick_combo: first5.join("/"),
      first_five_round_positions: first5,
      first_eight_round_positions: first8,
      rb_count_rounds_1_5: rb5,
      wr_count_rounds_1_5: wr5,
      qb_count_rounds_1_5: qb5,
      te_count_rounds_1_5: te5,
      rb_count_rounds_1_8: posCount(first8, "RB"),
      wr_count_rounds_1_8: posCount(first8, "WR"),
      qb_count_rounds_1_8: posCount(first8, "QB"),
      te_count_rounds_1_8: posCount(first8, "TE"),
      first_qb_round,
      first_rb_round: firstRoundOf("RB"),
      first_wr_round: firstRoundOf("WR"),
      first_te_round,

      strategies,
    };

    teams.push(team);
  }

  // Assign final standings
  const sortedTeams = [...teams].sort(
    (a, b) =>
      b.regular_season_wins - a.regular_season_wins ||
      b.regular_season_points_for - a.regular_season_points_for
  );
  sortedTeams.forEach((team, idx) => {
    team.final_standing = idx + 1;
  });

  return teams;
}

// ─── Analysis Engine ──────────────────────────────────────────────────────────

interface Baseline {
  playoff_rate: number;
  finals_rate: number;
  championship_rate: number;
  top_3_pf_rate: number;
  average_points_for: number;
}

function computeBaseline(teams: TeamRecord[]): Baseline {
  const n = teams.length;
  if (n === 0) return { playoff_rate: 0, finals_rate: 0, championship_rate: 0, top_3_pf_rate: 0, average_points_for: 0 };
  return {
    playoff_rate: teams.reduce((a, t) => a + t.expected_playoff_rate, 0) / n,
    finals_rate: teams.filter((t) => t.championship_made).length / n,
    championship_rate: teams.filter((t) => t.champion).length / n,
    top_3_pf_rate: teams.filter((t) => t.top_3_points_for).length / n,
    average_points_for: teams.reduce((a, b) => a + b.regular_season_points_for, 0) / n,
  };
}

function generateRecommendation(
  metrics: StrategyMetrics[],
  baseline: Baseline,
  context: string
): { headline: string; recommendations: Array<{ headline: string; body: string; sample_size: number; confidence: string; metrics: Record<string, number> }> } {
  const eligible = metrics.filter((m) => m.sample_size >= 75);
  if (eligible.length === 0) {
    return {
      headline: `Insufficient data for ${context} recommendations.`,
      recommendations: [],
    };
  }

  const best = eligible.sort((a, b) => b.playoff_rate - a.playoff_rate)[0];
  const recommendations = eligible.slice(0, 3).map((m) => {
    const lift = m.playoff_rate_lift;
    const direction = lift >= 0 ? "above" : "below";
    const absLift = Math.abs(lift);

    const pfLift = m.top_3_pf_rate - baseline.top_3_pf_rate;
    const pfLiftStr = pfLift >= 0 ? `+${(pfLift * 100).toFixed(1)}pp` : `${(pfLift * 100).toFixed(1)}pp`;
    const pfNote = Math.abs(pfLift * 100) >= 2
      ? ` Teams using this build also finished in the top 3 for points scored ${(m.top_3_pf_rate * 100).toFixed(1)}% of the time (${pfLiftStr} vs baseline).`
      : ` Top 3 PF rate was in line with the field at ${(m.top_3_pf_rate * 100).toFixed(1)}%.`;
    return {
      headline: `${m.strategy} correlated with ${(m.playoff_rate * 100).toFixed(1)}% playoff rate`,
      body: `In this sample, ${m.strategy} teams made the playoffs at a ${(m.playoff_rate * 100).toFixed(1)}% rate — ${absLift.toFixed(1)} percentage points ${direction} the overall baseline of ${(baseline.playoff_rate * 100).toFixed(1)}%.${pfNote} Championship rate: ${(m.championship_rate * 100).toFixed(1)}%. Sample size: ${m.sample_size}. Confidence: ${m.confidence_level}.`,
      sample_size: m.sample_size,
      confidence: m.confidence_level,
      metrics: {
        playoff_rate: m.playoff_rate,
        championship_rate: m.championship_rate,
        top_3_pf_rate: m.top_3_pf_rate,
        average_points_for: m.average_points_for,
      },
    };
  });

  return {
    headline: best
      ? `${best.strategy} produced the strongest playoff rate in this ${context} sample (${(best.playoff_rate * 100).toFixed(1)}%, n=${best.sample_size}).`
      : `Insufficient qualifying data for strong ${context} recommendations.`,
    recommendations,
  };
}

// ─── Main Export Function ─────────────────────────────────────────────────────

export interface AnalysisResult {
  summary: unknown;
  bySlot: unknown;
  byFormat: unknown;
  firstTwoPicks: unknown;
  firstFiveBuilds: unknown;
  roundValue: unknown;
  recommendations: unknown;
  audit: {
    generated_at: string;
    total_leagues: number;
    succeeded: number;
    skipped: number;
    failed: number;
    entries: LeagueAuditEntry[];
  };
  teams: TeamRecord[];
}

export function analyzeAll(
  fetchedLeagues: Array<{ data: FetchedLeagueData | null; input: { league_id: string; season: string; notes: string }; error?: string }>,
  nflPlayers: Record<string, { full_name?: string; position?: string; team?: string }>
): AnalysisResult {
  const auditEntries: LeagueAuditEntry[] = [];
  const allTeams: TeamRecord[] = [];
  const processedSeasons = new Set<string>();
  let leaguesAnalyzed = 0;

  for (const entry of fetchedLeagues) {
    const { input, data, error } = entry;

    if (!data || error) {
      auditEntries.push({
        league_id: input.league_id,
        season: input.season,
        status: "failed",
        reason: error || "No data fetched",
        notes: input.notes,
      });
      continue;
    }

    const league = data.league as SleeperLeague;
    const validation = validateLeague(
      league,
      data.drafts,
      data.draftDetails as (SleeperDraft | null)[]
    );

    if (!validation.valid) {
      auditEntries.push({
        league_id: input.league_id,
        season: input.season,
        status: "skipped",
        reason: validation.reason,
        notes: input.notes,
      });
      continue;
    }

    let teams: TeamRecord[] = [];
    try {
      teams = buildTeamRecords(data, validation, nflPlayers);
    } catch (err) {
      auditEntries.push({
        league_id: input.league_id,
        season: input.season,
        status: "failed",
        reason: `Error building team records: ${(err as Error).message}`,
        notes: input.notes,
      });
      continue;
    }

    if (teams.length === 0) {
      auditEntries.push({
        league_id: input.league_id,
        season: input.season,
        status: "skipped",
        reason: "No team records could be built (missing draft/roster data)",
        notes: input.notes,
      });
      continue;
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
  }

  return computeAnalysisFromTeams(allTeams, auditEntries, fetchedLeagues.length, processedSeasons, leaguesAnalyzed);
}

// ─── Streaming-friendly aggregation (call after collecting all TeamRecords) ───

export function computeAnalysisFromTeams(
  allTeams: TeamRecord[],
  auditEntries: LeagueAuditEntry[],
  totalLeagues: number,
  processedSeasons: Set<string>,
  leaguesAnalyzed: number
): AnalysisResult {
  const now = new Date().toISOString();
  const baseline = computeBaseline(allTeams);
  const n = allTeams.length;

  // ─── Strategy buckets ─────────────────────────────────────────────────────

  const ALL_STRATEGIES = [
    "Zero RB", "Hero RB", "Robust RB", "WR Heavy", "Balanced",
    "Elite QB", "Elite TE", "Late QB", "Late TE",
  ];

  const strategyMetrics = ALL_STRATEGIES.map((strat) =>
    computeMetrics(
      allTeams.filter((t) => t.strategies.includes(strat)),
      strat,
      baseline
    )
  ).sort((a, b) => b.playoff_rate - a.playoff_rate);

  const bestStrategies = strategyMetrics.filter((m) => m.sample_size >= 25).slice(0, 5);
  const worstStrategies = [...strategyMetrics].filter((m) => m.sample_size >= 25).reverse().slice(0, 5);

  // ─── First round positions ────────────────────────────────────────────────

  const firstRoundPositions = ["RB", "WR", "QB", "TE"].map((pos) =>
    computeMetrics(
      allTeams.filter((t) => t.first_pick_position === pos),
      pos,
      baseline
    )
  );

  // ─── First two pick combos ────────────────────────────────────────────────

  const combos = ["RB/RB", "RB/WR", "WR/RB", "WR/WR", "WR/TE", "WR/QB", "TE/WR", "QB/WR", "RB/TE", "TE/RB"];
  const comboMetrics = combos.map((combo) =>
    computeMetrics(
      allTeams.filter((t) => t.first_two_pick_combo === combo),
      combo,
      baseline
    )
  );

  // ─── First five builds ────────────────────────────────────────────────────

  const buildCounts: Record<string, TeamRecord[]> = {};
  for (const team of allTeams) {
    const key = team.first_five_pick_combo;
    if (!buildCounts[key]) buildCounts[key] = [];
    buildCounts[key].push(team);
  }
  const buildMetrics = Object.entries(buildCounts)
    .map(([combo, teams]) => computeMetrics(teams, combo, baseline))
    .sort((a, b) => b.sample_size - a.sample_size)
    .slice(0, 30);

  // ─── Round value ──────────────────────────────────────────────────────────

  const POSITIONS = ["RB", "WR", "QB", "TE", "K", "DEF"];
  const rounds: Array<{ round: number; positions: unknown[] }> = [];
  for (let round = 1; round <= 15; round++) {
    const positions = POSITIONS.map((pos) => {
      const matching = allTeams.filter((t) => {
        return t.first_eight_round_positions[round - 1] === pos;
      });
      return computeMetrics(matching, pos, baseline);
    });
    rounds.push({ round, positions });
  }

  // ─── By slot ─────────────────────────────────────────────────────────────

  const slotGroups = ["Early", "Middle", "Late"];
  const bySlotData: Record<string, unknown> = {};

  for (const group of slotGroups) {
    const groupTeams = allTeams.filter((t) => t.draft_slot_group === group);
    const groupBaseline = computeBaseline(groupTeams);

    const groupStrategyMetrics = ALL_STRATEGIES.map((strat) =>
      computeMetrics(
        groupTeams.filter((t) => t.strategies.includes(strat)),
        strat,
        groupBaseline
      )
    ).sort((a, b) => b.playoff_rate - a.playoff_rate);

    const groupCombos = combos.map((combo) =>
      computeMetrics(
        groupTeams.filter((t) => t.first_two_pick_combo === combo),
        combo,
        groupBaseline
      )
    );

    const groupBuilds = Object.entries(buildCounts)
      .map(([combo, teams]) =>
        computeMetrics(
          teams.filter((t) => t.draft_slot_group === group),
          combo,
          groupBaseline
        )
      )
      .filter((m) => m.sample_size > 0)
      .sort((a, b) => b.playoff_rate - a.playoff_rate)
      .slice(0, 10);

    const best = groupStrategyMetrics.filter((m) => m.sample_size >= 10)[0];

    bySlotData[group.toLowerCase()] = {
      slot_group: group,
      sample_size: groupTeams.length,
      best_strategies: groupStrategyMetrics.filter((m) => m.sample_size >= 10).slice(0, 5),
      worst_strategies: [...groupStrategyMetrics].filter((m) => m.sample_size >= 10).reverse().slice(0, 3),
      best_first_two_pick_combos: sortByPlayoffRate(groupCombos.filter((m) => m.sample_size >= 5)).slice(0, 5),
      best_first_five_builds: groupBuilds.slice(0, 5),
      recommended_draft_blueprint: best ? `${best.strategy} — playoff rate: ${(best.playoff_rate * 100).toFixed(1)}% (n=${best.sample_size})` : "Insufficient data",
    };
  }

  // ─── By format ────────────────────────────────────────────────────────────

  const formats = [
    { key: "standard", label: "Standard", filter: (t: TeamRecord) => t.scoring_format === "Standard" },
    { key: "half_ppr", label: "Half PPR", filter: (t: TeamRecord) => t.scoring_format === "Half PPR" },
    { key: "ppr", label: "PPR", filter: (t: TeamRecord) => t.scoring_format === "PPR" },
    { key: "other_ppr", label: "Other PPR", filter: (t: TeamRecord) => t.scoring_format === "Other PPR" },
    { key: "one_qb", label: "1QB", filter: (t: TeamRecord) => t.roster_format === "1QB" },
    { key: "superflex", label: "Superflex", filter: (t: TeamRecord) => t.roster_format === "Superflex" },
  ];

  const byFormatData: Record<string, unknown> = {};
  for (const fmt of formats) {
    const fmtTeams = allTeams.filter(fmt.filter);
    const fmtBaseline = computeBaseline(fmtTeams);

    const fmtStrategies = ALL_STRATEGIES.map((strat) =>
      computeMetrics(
        fmtTeams.filter((t) => t.strategies.includes(strat)),
        strat,
        fmtBaseline
      )
    ).sort((a, b) => b.playoff_rate - a.playoff_rate);

    const fmtCombos = combos.map((combo) =>
      computeMetrics(
        fmtTeams.filter((t) => t.first_two_pick_combo === combo),
        combo,
        fmtBaseline
      )
    );

    const diffs = fmtStrategies
      .filter((m) => m.sample_size >= 10)
      .map((m) => ({
        strategy: m.strategy,
        metric: "playoff_rate",
        lift: m.playoff_rate_lift,
      }))
      .sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift))
      .slice(0, 5);

    byFormatData[fmt.key] = {
      format: fmt.label,
      sample_size: fmtTeams.length,
      best_strategies: fmtStrategies.filter((m) => m.sample_size >= 10).slice(0, 5),
      best_combos: sortByPlayoffRate(fmtCombos.filter((m) => m.sample_size >= 5)).slice(0, 5),
      biggest_differences_from_baseline: diffs,
    };
  }

  // ─── Recommendations ─────────────────────────────────────────────────────

  const recommendations = {
    generated_at: now,
    overall: generateRecommendation(strategyMetrics, baseline, "overall"),
    early_slot: generateRecommendation(
      ALL_STRATEGIES.map((strat) =>
        computeMetrics(
          allTeams.filter((t) => t.draft_slot_group === "Early" && t.strategies.includes(strat)),
          strat,
          computeBaseline(allTeams.filter((t) => t.draft_slot_group === "Early"))
        )
      ),
      computeBaseline(allTeams.filter((t) => t.draft_slot_group === "Early")),
      "early-slot"
    ),
    middle_slot: generateRecommendation(
      ALL_STRATEGIES.map((strat) =>
        computeMetrics(
          allTeams.filter((t) => t.draft_slot_group === "Middle" && t.strategies.includes(strat)),
          strat,
          computeBaseline(allTeams.filter((t) => t.draft_slot_group === "Middle"))
        )
      ),
      computeBaseline(allTeams.filter((t) => t.draft_slot_group === "Middle")),
      "middle-slot"
    ),
    late_slot: generateRecommendation(
      ALL_STRATEGIES.map((strat) =>
        computeMetrics(
          allTeams.filter((t) => t.draft_slot_group === "Late" && t.strategies.includes(strat)),
          strat,
          computeBaseline(allTeams.filter((t) => t.draft_slot_group === "Late"))
        )
      ),
      computeBaseline(allTeams.filter((t) => t.draft_slot_group === "Late")),
      "late-slot"
    ),
    ppr: generateRecommendation(
      ALL_STRATEGIES.map((strat) =>
        computeMetrics(
          allTeams.filter((t) => t.scoring_format === "PPR" && t.strategies.includes(strat)),
          strat,
          computeBaseline(allTeams.filter((t) => t.scoring_format === "PPR"))
        )
      ),
      computeBaseline(allTeams.filter((t) => t.scoring_format === "PPR")),
      "PPR"
    ),
    half_ppr: generateRecommendation(
      ALL_STRATEGIES.map((strat) =>
        computeMetrics(
          allTeams.filter((t) => t.scoring_format === "Half PPR" && t.strategies.includes(strat)),
          strat,
          computeBaseline(allTeams.filter((t) => t.scoring_format === "Half PPR"))
        )
      ),
      computeBaseline(allTeams.filter((t) => t.scoring_format === "Half PPR")),
      "Half PPR"
    ),
    superflex: generateRecommendation(
      ALL_STRATEGIES.map((strat) =>
        computeMetrics(
          allTeams.filter((t) => t.roster_format === "Superflex" && t.strategies.includes(strat)),
          strat,
          computeBaseline(allTeams.filter((t) => t.roster_format === "Superflex"))
        )
      ),
      computeBaseline(allTeams.filter((t) => t.roster_format === "Superflex")),
      "Superflex"
    ),
  };

  // ─── Key takeaways ────────────────────────────────────────────────────────

  const keyTakeaways: string[] = [];

  if (n > 0) {
    const bestStrat = bestStrategies[0];
    if (bestStrat && bestStrat.sample_size >= 25) {
      keyTakeaways.push(
        `${bestStrat.strategy} teams showed the highest playoff rate in this sample at ${(bestStrat.playoff_rate * 100).toFixed(1)}% (n=${bestStrat.sample_size}).`
      );
    }

    const bestCombo = sortByPlayoffRate(comboMetrics.filter((m) => m.sample_size >= 25))[0];
    if (bestCombo) {
      keyTakeaways.push(
        `${bestCombo.strategy} was the most successful first-two-pick combo, producing a ${(bestCombo.playoff_rate * 100).toFixed(1)}% playoff rate (n=${bestCombo.sample_size}).`
      );
    }

    keyTakeaways.push(
      `Overall baseline playoff rate: ${(baseline.playoff_rate * 100).toFixed(1)}%, championship rate: ${(baseline.championship_rate * 100).toFixed(1)}%.`
    );

    if (n < 250) {
      keyTakeaways.push(
        `Note: With only ${n} total teams analyzed, treat all findings as directional. Add more leagues to data/input/sleeper_redraft_leagues.csv for stronger confidence.`
      );
    }
  } else {
    keyTakeaways.push("No leagues were successfully analyzed. Check your input CSV and league IDs.");
  }

  // ─── Audit ────────────────────────────────────────────────────────────────

  const auditOutput = {
    generated_at: now,
    total_leagues: totalLeagues,
    succeeded: auditEntries.filter((a) => a.status === "success").length,
    skipped: auditEntries.filter((a) => a.status === "skipped").length,
    failed: auditEntries.filter((a) => a.status === "failed").length,
    entries: auditEntries,
  };

  return {
    summary: {
      generated_at: now,
      seasons_included: Array.from(processedSeasons).sort(),
      total_leagues_analyzed: leaguesAnalyzed,
      total_teams_analyzed: n,
      baseline: {
        playoff_rate: Math.round(baseline.playoff_rate * 1000) / 1000,
        finals_rate: Math.round(baseline.finals_rate * 1000) / 1000,
        championship_rate: Math.round(baseline.championship_rate * 1000) / 1000,
        top_3_pf_rate: Math.round(baseline.top_3_pf_rate * 1000) / 1000,
        average_points_for: Math.round(baseline.average_points_for * 100) / 100,
      },
      best_overall_strategies: bestStrategies,
      worst_overall_strategies: worstStrategies,
      best_first_round_positions: sortByPlayoffRate(firstRoundPositions),
      best_first_two_pick_combos: sortByPlayoffRate(comboMetrics.filter((m) => m.sample_size >= 5)).slice(0, 8),
      best_first_five_builds: buildMetrics.filter((m) => m.sample_size >= 50).sort((a, b) => b.playoff_rate_lift - a.playoff_rate_lift).slice(0, 10),
      key_takeaways: keyTakeaways,
    },
    bySlot: {
      generated_at: now,
      ...bySlotData,
    },
    byFormat: {
      generated_at: now,
      ...byFormatData,
    },
    firstTwoPicks: {
      generated_at: now,
      combos: sortByPlayoffRate(comboMetrics),
    },
    firstFiveBuilds: {
      generated_at: now,
      builds: buildMetrics,
    },
    roundValue: {
      generated_at: now,
      rounds,
    },
    recommendations,
    audit: auditOutput,
    teams: allTeams,
  };
}

// ─── Filtered Combo Analysis ──────────────────────────────────────────────────

const ALL_STRATEGIES_LIST = [
  "Zero RB", "Hero RB", "Robust RB", "WR Heavy", "Balanced",
  "Elite QB", "Elite TE", "Late QB", "Late TE",
];

const ALL_COMBOS_LIST = [
  "RB/RB", "RB/WR", "WR/RB", "WR/WR",
];

function computeFilteredSlice(teams: TeamRecord[], label: string) {
  const n = teams.length;
  const baseline = computeBaseline(teams);

  const stratMetrics = ALL_STRATEGIES_LIST.map((s) =>
    computeMetrics(teams.filter((t) => t.strategies.includes(s)), s, baseline)
  ).sort((a, b) => b.playoff_rate - a.playoff_rate);

  const comboMetrics = ALL_COMBOS_LIST.map((c) =>
    computeMetrics(teams.filter((t) => t.first_two_pick_combo === c), c, baseline)
  );

  const buildCounts: Record<string, TeamRecord[]> = {};
  for (const team of teams) {
    if (!buildCounts[team.first_five_pick_combo]) buildCounts[team.first_five_pick_combo] = [];
    buildCounts[team.first_five_pick_combo].push(team);
  }
  const allBuildMetrics = Object.entries(buildCounts)
    .map(([c, ts]) => computeMetrics(ts, c, baseline))
    .sort((a, b) => b.playoff_rate_lift - a.playoff_rate_lift);
  const buildMetrics = allBuildMetrics
    .filter((m) => m.sample_size >= 50)
    .slice(0, 10);
  const first_five_build_map: Record<string, { playoff_rate: number; top_3_pf_rate: number; sample_size: number; playoff_rate_lift: number }> = {};
  for (const m of allBuildMetrics) {
    if (m.sample_size >= 30) {
      first_five_build_map[m.strategy] = {
        playoff_rate: Math.round(m.playoff_rate * 1000) / 1000,
        top_3_pf_rate: Math.round(m.top_3_pf_rate * 1000) / 1000,
        sample_size: m.sample_size,
        playoff_rate_lift: Math.round(m.playoff_rate_lift * 1000) / 1000,
      };
    }
  }

  const firstRoundPositions = ["RB", "WR", "QB", "TE"].map((pos) =>
    computeMetrics(teams.filter((t) => t.first_pick_position === pos), pos, baseline)
  );

  // Cache per-slot data for both bySlot output and recommendations
  const slotStratMetrics: Record<string, StrategyMetrics[]> = {};
  const slotBaselines: Record<string, Baseline> = {};

  const bySlot: Record<string, unknown> = {};
  for (const group of ["Early", "Middle", "Late"]) {
    const gt = teams.filter((t) => t.draft_slot_group === group);
    const gb = computeBaseline(gt);
    const gs = ALL_STRATEGIES_LIST.map((s) =>
      computeMetrics(gt.filter((t) => t.strategies.includes(s)), s, gb)
    ).sort((a, b) => b.playoff_rate - a.playoff_rate);
    const gc = ALL_COMBOS_LIST.map((c) =>
      computeMetrics(gt.filter((t) => t.first_two_pick_combo === c), c, gb)
    );
    const best = gs.filter((m) => m.sample_size >= 10)[0];
    slotStratMetrics[group] = gs;
    slotBaselines[group] = gb;
    bySlot[group.toLowerCase()] = {
      slot_group: group,
      sample_size: gt.length,
      best_strategies: gs.filter((m) => m.sample_size >= 10).slice(0, 5),
      worst_strategies: [...gs].filter((m) => m.sample_size >= 10).reverse().slice(0, 3),
      best_first_two_pick_combos: sortByPlayoffRate(gc.filter((m) => m.sample_size >= 5)).slice(0, 5),
      recommended_draft_blueprint: best
        ? `${best.strategy} — playoff rate: ${(best.playoff_rate * 100).toFixed(1)}% (n=${best.sample_size})`
        : "Insufficient data",
    };
  }

  // Recommendations (overall + by draft slot)
  const recommendations = {
    overall: generateRecommendation(stratMetrics, baseline, "overall"),
    early_slot: generateRecommendation(slotStratMetrics["Early"] ?? [], slotBaselines["Early"] ?? baseline, "early-slot"),
    middle_slot: generateRecommendation(slotStratMetrics["Middle"] ?? [], slotBaselines["Middle"] ?? baseline, "middle-slot"),
    late_slot: generateRecommendation(slotStratMetrics["Late"] ?? [], slotBaselines["Late"] ?? baseline, "late-slot"),
  };

  // Negative strategies
  const NEGATIVE_THRESHOLD = -8;
  const STRONG_NEGATIVE_THRESHOLD = -15;
  const NEGATIVE_MIN_SAMPLE = 50;
  const negativeEntries = stratMetrics
    .filter((m) => m.sample_size >= NEGATIVE_MIN_SAMPLE && m.playoff_rate_lift <= NEGATIVE_THRESHOLD)
    .map((m) => ({
      strategy_name: m.strategy,
      format_context: label,
      sample_size: m.sample_size,
      playoff_rate: m.playoff_rate,
      playoff_rate_lift: m.playoff_rate_lift,
      championship_rate: m.championship_rate,
      top_3_pf_rate: m.top_3_pf_rate,
      average_points_for: m.average_points_for,
      confidence_level: m.confidence_level,
      severity: m.playoff_rate_lift <= STRONG_NEGATIVE_THRESHOLD ? ("strong_negative" as const) : ("negative" as const),
      explanation: `In this filtered sample (${label}), ${m.strategy} teams made the playoffs at ${(m.playoff_rate * 100).toFixed(1)}%, which is ${Math.abs(m.playoff_rate_lift).toFixed(1)} percentage points below the ${(baseline.playoff_rate * 100).toFixed(1)}% baseline. Sample: ${m.sample_size} teams. Confidence: ${m.confidence_level}.`,
    }));

  // Miss risk
  const missRateBaseline = 1 - baseline.playoff_rate;
  const sortedByMiss = stratMetrics
    .filter((m) => m.sample_size >= 25)
    .map((m) => 1 - m.playoff_rate)
    .sort((a, b) => a - b);
  const missRiskEntries = stratMetrics
    .filter((m) => m.sample_size >= 25)
    .map((m) => {
      const missProbability = 1 - m.playoff_rate;
      const rank = sortedByMiss.filter((v) => v <= missProbability).length;
      return {
        strategy_name: m.strategy,
        format_context: label,
        sample_size: m.sample_size,
        probability_of_missing_playoffs: Math.round(missProbability * 1000) / 1000,
        relative_risk_vs_baseline: Math.round((missRateBaseline > 0 ? missProbability / missRateBaseline : 1) * 100) / 100,
        percentile_rank: Math.round((rank / sortedByMiss.length) * 100),
        confidence_level: m.confidence_level,
      };
    })
    .sort((a, b) => a.probability_of_missing_playoffs - b.probability_of_missing_playoffs);

  const takeaways: string[] = [];
  const bestStrat = stratMetrics.filter((m) => m.sample_size >= 25)[0];
  if (bestStrat) {
    takeaways.push(`${bestStrat.strategy} had the highest playoff rate at ${(bestStrat.playoff_rate * 100).toFixed(1)}% (n=${bestStrat.sample_size}).`);
  }
  const bestCombo = sortByPlayoffRate(comboMetrics.filter((m) => m.sample_size >= 25))[0];
  if (bestCombo) {
    takeaways.push(`${bestCombo.strategy} was the best first-two-pick combo at ${(bestCombo.playoff_rate * 100).toFixed(1)}% (n=${bestCombo.sample_size}).`);
  }
  takeaways.push(`Baseline playoff rate: ${(baseline.playoff_rate * 100).toFixed(1)}%, championship rate: ${(baseline.championship_rate * 100).toFixed(1)}%.`);
  if (n > 0 && n < 250) {
    takeaways.push(`Low sample size (n=${n}) — treat findings as directional.`);
  }

  const league_count = new Set(teams.map((t) => t.league_id)).size;

  // Round value for this filtered combo (rounds 1–8, same data as first_eight_round_positions)
  const RV_POSITIONS = ["RB", "WR", "QB", "TE", "K", "DEF"];
  const filteredRounds: Array<{ round: number; positions: unknown[] }> = [];
  for (let round = 1; round <= 8; round++) {
    const positions = RV_POSITIONS.map((pos) => {
      const matching = teams.filter((t) => t.first_eight_round_positions[round - 1] === pos);
      return computeMetrics(matching, pos, baseline);
    });
    filteredRounds.push({ round, positions });
  }

  return {
    label,
    sample_size: n,
    league_count,
    baseline: {
      playoff_rate: Math.round(baseline.playoff_rate * 1000) / 1000,
      championship_rate: Math.round(baseline.championship_rate * 1000) / 1000,
      top_3_pf_rate: Math.round(baseline.top_3_pf_rate * 1000) / 1000,
      average_points_for: Math.round(baseline.average_points_for * 100) / 100,
    },
    best_strategies: stratMetrics.filter((m) => m.sample_size >= 25).slice(0, 5),
    worst_strategies: [...stratMetrics].filter((m) => m.sample_size >= 25).reverse().slice(0, 5),
    best_first_round_positions: sortByPlayoffRate(firstRoundPositions.filter((m) => m.sample_size >= 10)),
    best_first_two_pick_combos: sortByPlayoffRate(comboMetrics.filter((m) => m.sample_size >= 10)).slice(0, 8),
    best_first_five_builds: buildMetrics,
    first_five_build_map,
    by_slot: bySlot,
    key_takeaways: takeaways,
    recommendations,
    negative_strategies: { overall: negativeEntries },
    miss_risk: {
      baseline_miss_rate: Math.round(missRateBaseline * 1000) / 1000,
      entries: missRiskEntries,
    },
    round_value: { rounds: filteredRounds },
  };
}

// ─── Year-over-Year Trend Helpers ─────────────────────────────────────────────

function getSampleQuality(n: number): string {
  if (n >= 5000) return "Elite";
  if (n >= 1000) return "Strong";
  if (n >= 250) return "Reliable";
  if (n >= 50) return "Limited";
  return "Too Small";
}

function getTrendLabel(changePp: number, sample2024: number, sample2025: number): string {
  const minSample = Math.min(sample2024, sample2025);
  if (minSample < 50) return "Noisy";
  if (Math.abs(changePp) >= 5 && minSample < 250) return "Volatile";
  if (minSample < 250) return "Limited Data";
  if (changePp >= 3) return "Higher YoY";
  if (changePp <= -3) return "Lower YoY";
  return "Consistent YoY";
}

function pp(a: number, b: number): number {
  return Math.round((b - a) * 1000) / 10;
}

// ─── Trends Output: 36-combo year-over-year comparison ────────────────────────

export function computeTrendsOutput(allTeams: TeamRecord[]) {
  const now = new Date().toISOString();

  const QB_FORMATS = [
    { key: "superflex", label: "Superflex", filter: (t: TeamRecord) => t.roster_format === "Superflex" },
    { key: "one_qb", label: "1QB", filter: (t: TeamRecord) => t.roster_format === "1QB" },
  ];
  const SCORINGS = [
    { key: "ppr", label: "PPR", filter: (t: TeamRecord) => t.scoring_format === "PPR" },
    { key: "half_ppr", label: "Half PPR", filter: (t: TeamRecord) => t.scoring_format === "Half PPR" },
    { key: "standard", label: "Standard", filter: (t: TeamRecord) => t.scoring_format === "Standard" },
  ];
  const TEP_OPTS = [
    { key: "tep", label: "TEP", filter: (t: TeamRecord) => t.tep === true },
    { key: "no_tep", label: "No TEP", filter: (t: TeamRecord) => t.tep === false },
  ];
  const SIZES = [
    { key: "10", label: "10-Team", filter: (t: TeamRecord) => t.league_size === 10 },
    { key: "12", label: "12-Team", filter: (t: TeamRecord) => t.league_size === 12 },
    { key: "all", label: "All Sizes", filter: (t: TeamRecord) => t.league_size === 10 || t.league_size === 12 },
  ];
  const RV_POSITIONS = ["RB", "WR", "QB", "TE"];

  const trends: Record<string, unknown> = {};

  for (const qb of QB_FORMATS) {
    for (const scoring of SCORINGS) {
      for (const tep of TEP_OPTS) {
        for (const size of SIZES) {
          const key = `${qb.key}__${scoring.key}__${tep.key}__${size.key}`;
          const baseFilter = (t: TeamRecord) =>
            qb.filter(t) && scoring.filter(t) && tep.filter(t) && size.filter(t);
          const teams2021 = allTeams.filter((t) => baseFilter(t) && t.season === "2021");
          const teams2022 = allTeams.filter((t) => baseFilter(t) && t.season === "2022");
          const teams2023 = allTeams.filter((t) => baseFilter(t) && t.season === "2023");
          const teams2024 = allTeams.filter((t) => baseFilter(t) && t.season === "2024");
          const teams2025 = allTeams.filter((t) => baseFilter(t) && t.season === "2025");

          const baseline2021 = computeBaseline(teams2021);
          const baseline2022 = computeBaseline(teams2022);
          const baseline2023 = computeBaseline(teams2023);
          const baseline2024 = computeBaseline(teams2024);
          const baseline2025 = computeBaseline(teams2025);

          const overall_strategies = ALL_STRATEGIES_LIST.map((s) => {
            const m21 = computeMetrics(teams2021.filter((t) => t.strategies.includes(s)), s, baseline2021);
            const m22 = computeMetrics(teams2022.filter((t) => t.strategies.includes(s)), s, baseline2022);
            const m23 = computeMetrics(teams2023.filter((t) => t.strategies.includes(s)), s, baseline2023);
            const m24 = computeMetrics(teams2024.filter((t) => t.strategies.includes(s)), s, baseline2024);
            const m25 = computeMetrics(teams2025.filter((t) => t.strategies.includes(s)), s, baseline2025);
            const changePp = pp(m24.playoff_rate, m25.playoff_rate);
            return {
              strategy: s,
              sample_2021: m21.sample_size,
              sample_2022: m22.sample_size,
              sample_2023: m23.sample_size,
              sample_2024: m24.sample_size,
              sample_2025: m25.sample_size,
              playoff_rate_2021: Math.round(m21.playoff_rate * 1000) / 1000,
              playoff_rate_2022: Math.round(m22.playoff_rate * 1000) / 1000,
              playoff_rate_2023: Math.round(m23.playoff_rate * 1000) / 1000,
              playoff_rate_2024: Math.round(m24.playoff_rate * 1000) / 1000,
              playoff_rate_2025: Math.round(m25.playoff_rate * 1000) / 1000,
              playoff_rate_change_pp: changePp,
              top_3_pf_rate_2021: Math.round(m21.top_3_pf_rate * 1000) / 1000,
              top_3_pf_rate_2022: Math.round(m22.top_3_pf_rate * 1000) / 1000,
              top_3_pf_rate_2023: Math.round(m23.top_3_pf_rate * 1000) / 1000,
              top_3_pf_rate_2024: Math.round(m24.top_3_pf_rate * 1000) / 1000,
              top_3_pf_rate_2025: Math.round(m25.top_3_pf_rate * 1000) / 1000,
              top_3_pf_rate_change_pp: pp(m24.top_3_pf_rate, m25.top_3_pf_rate),
              championship_rate_2021: Math.round(m21.championship_rate * 1000) / 1000,
              championship_rate_2022: Math.round(m22.championship_rate * 1000) / 1000,
              championship_rate_2023: Math.round(m23.championship_rate * 1000) / 1000,
              championship_rate_2024: Math.round(m24.championship_rate * 1000) / 1000,
              championship_rate_2025: Math.round(m25.championship_rate * 1000) / 1000,
              championship_rate_change_pp: pp(m24.championship_rate, m25.championship_rate),
              miss_rate_2021: Math.round((1 - m21.playoff_rate) * 1000) / 1000,
              miss_rate_2022: Math.round((1 - m22.playoff_rate) * 1000) / 1000,
              miss_rate_2023: Math.round((1 - m23.playoff_rate) * 1000) / 1000,
              miss_rate_2024: Math.round((1 - m24.playoff_rate) * 1000) / 1000,
              miss_rate_2025: Math.round((1 - m25.playoff_rate) * 1000) / 1000,
              miss_rate_change_pp: pp(1 - m24.playoff_rate, 1 - m25.playoff_rate),
              avg_pts_2021: Math.round(m21.average_points_for * 10) / 10,
              avg_pts_2022: Math.round(m22.average_points_for * 10) / 10,
              avg_pts_2023: Math.round(m23.average_points_for * 10) / 10,
              avg_pts_2024: Math.round(m24.average_points_for * 10) / 10,
              avg_pts_2025: Math.round(m25.average_points_for * 10) / 10,
              avg_pts_change: Math.round((m25.average_points_for - m24.average_points_for) * 10) / 10,
              comparison_quality: getSampleQuality(Math.min(m23.sample_size, m24.sample_size, m25.sample_size)),
              trend_label: getTrendLabel(changePp, m24.sample_size, m25.sample_size),
            };
          });

          const first_two_pick_combos = ALL_COMBOS_LIST.map((c) => {
            const m21 = computeMetrics(teams2021.filter((t) => t.first_two_pick_combo === c), c, baseline2021);
            const m22 = computeMetrics(teams2022.filter((t) => t.first_two_pick_combo === c), c, baseline2022);
            const m23 = computeMetrics(teams2023.filter((t) => t.first_two_pick_combo === c), c, baseline2023);
            const m24 = computeMetrics(teams2024.filter((t) => t.first_two_pick_combo === c), c, baseline2024);
            const m25 = computeMetrics(teams2025.filter((t) => t.first_two_pick_combo === c), c, baseline2025);
            const changePp = pp(m24.playoff_rate, m25.playoff_rate);
            return {
              combo: c,
              sample_2021: m21.sample_size,
              sample_2022: m22.sample_size,
              sample_2023: m23.sample_size,
              sample_2024: m24.sample_size,
              sample_2025: m25.sample_size,
              playoff_rate_2021: Math.round(m21.playoff_rate * 1000) / 1000,
              playoff_rate_2022: Math.round(m22.playoff_rate * 1000) / 1000,
              playoff_rate_2023: Math.round(m23.playoff_rate * 1000) / 1000,
              playoff_rate_2024: Math.round(m24.playoff_rate * 1000) / 1000,
              playoff_rate_2025: Math.round(m25.playoff_rate * 1000) / 1000,
              playoff_rate_change_pp: changePp,
              top_3_pf_rate_2021: Math.round(m21.top_3_pf_rate * 1000) / 1000,
              top_3_pf_rate_2022: Math.round(m22.top_3_pf_rate * 1000) / 1000,
              top_3_pf_rate_2023: Math.round(m23.top_3_pf_rate * 1000) / 1000,
              top_3_pf_rate_2024: Math.round(m24.top_3_pf_rate * 1000) / 1000,
              top_3_pf_rate_2025: Math.round(m25.top_3_pf_rate * 1000) / 1000,
              top_3_pf_rate_change_pp: pp(m24.top_3_pf_rate, m25.top_3_pf_rate),
              championship_rate_2021: Math.round(m21.championship_rate * 1000) / 1000,
              championship_rate_2022: Math.round(m22.championship_rate * 1000) / 1000,
              championship_rate_2023: Math.round(m23.championship_rate * 1000) / 1000,
              championship_rate_2024: Math.round(m24.championship_rate * 1000) / 1000,
              championship_rate_2025: Math.round(m25.championship_rate * 1000) / 1000,
              championship_rate_change_pp: pp(m24.championship_rate, m25.championship_rate),
              comparison_quality: getSampleQuality(Math.min(m23.sample_size, m24.sample_size, m25.sample_size)),
              trend_label: getTrendLabel(changePp, m24.sample_size, m25.sample_size),
            };
          });

          const miss_risk = ALL_STRATEGIES_LIST.map((s) => {
            const m21 = computeMetrics(teams2021.filter((t) => t.strategies.includes(s)), s, baseline2021);
            const m22 = computeMetrics(teams2022.filter((t) => t.strategies.includes(s)), s, baseline2022);
            const m23 = computeMetrics(teams2023.filter((t) => t.strategies.includes(s)), s, baseline2023);
            const m24 = computeMetrics(teams2024.filter((t) => t.strategies.includes(s)), s, baseline2024);
            const m25 = computeMetrics(teams2025.filter((t) => t.strategies.includes(s)), s, baseline2025);
            const mr21 = 1 - m21.playoff_rate;
            const mr22 = 1 - m22.playoff_rate;
            const mr23 = 1 - m23.playoff_rate;
            const mr24 = 1 - m24.playoff_rate;
            const mr25 = 1 - m25.playoff_rate;
            const changePp = pp(mr24, mr25);
            return {
              strategy: s,
              miss_rate_2021: Math.round(mr21 * 1000) / 1000,
              miss_rate_2022: Math.round(mr22 * 1000) / 1000,
              miss_rate_2023: Math.round(mr23 * 1000) / 1000,
              miss_rate_2024: Math.round(mr24 * 1000) / 1000,
              miss_rate_2025: Math.round(mr25 * 1000) / 1000,
              miss_rate_change_pp: changePp,
              sample_2021: m21.sample_size,
              sample_2022: m22.sample_size,
              sample_2023: m23.sample_size,
              sample_2024: m24.sample_size,
              sample_2025: m25.sample_size,
              comparison_quality: getSampleQuality(Math.min(m23.sample_size, m24.sample_size, m25.sample_size)),
              trend_label: getTrendLabel(-changePp, m24.sample_size, m25.sample_size),
            };
          });

          const round_value: Array<{ round: number; positions: unknown[] }> = [];
          for (let round = 1; round <= 8; round++) {
            const positions = RV_POSITIONS.map((pos) => {
              const m21 = computeMetrics(
                teams2021.filter((t) => t.first_eight_round_positions[round - 1] === pos),
                pos, baseline2021
              );
              const m22 = computeMetrics(
                teams2022.filter((t) => t.first_eight_round_positions[round - 1] === pos),
                pos, baseline2022
              );
              const m23 = computeMetrics(
                teams2023.filter((t) => t.first_eight_round_positions[round - 1] === pos),
                pos, baseline2023
              );
              const m24 = computeMetrics(
                teams2024.filter((t) => t.first_eight_round_positions[round - 1] === pos),
                pos, baseline2024
              );
              const m25 = computeMetrics(
                teams2025.filter((t) => t.first_eight_round_positions[round - 1] === pos),
                pos, baseline2025
              );
              const changePp = pp(m24.playoff_rate, m25.playoff_rate);
              return {
                position: pos,
                sample_2021: m21.sample_size,
                sample_2022: m22.sample_size,
                sample_2023: m23.sample_size,
                sample_2024: m24.sample_size,
                sample_2025: m25.sample_size,
                playoff_rate_2021: Math.round(m21.playoff_rate * 1000) / 1000,
                playoff_rate_2022: Math.round(m22.playoff_rate * 1000) / 1000,
                playoff_rate_2023: Math.round(m23.playoff_rate * 1000) / 1000,
                playoff_rate_2024: Math.round(m24.playoff_rate * 1000) / 1000,
                playoff_rate_2025: Math.round(m25.playoff_rate * 1000) / 1000,
                playoff_rate_change_pp: changePp,
                comparison_quality: getSampleQuality(Math.min(m23.sample_size, m24.sample_size, m25.sample_size)),
                trend_label: getTrendLabel(changePp, m24.sample_size, m25.sample_size),
              };
            });
            round_value.push({ round, positions });
          }

          trends[key] = {
            label: `${qb.label} · ${scoring.label} · ${tep.label} · ${size.label}`,
            sample_2021: teams2021.length,
            sample_2022: teams2022.length,
            sample_2023: teams2023.length,
            sample_2024: teams2024.length,
            sample_2025: teams2025.length,
            baseline_playoff_rate_2021: Math.round(baseline2021.playoff_rate * 1000) / 1000,
            baseline_playoff_rate_2022: Math.round(baseline2022.playoff_rate * 1000) / 1000,
            baseline_playoff_rate_2023: Math.round(baseline2023.playoff_rate * 1000) / 1000,
            baseline_playoff_rate_2024: Math.round(baseline2024.playoff_rate * 1000) / 1000,
            baseline_playoff_rate_2025: Math.round(baseline2025.playoff_rate * 1000) / 1000,
            baseline_miss_rate_2021: Math.round((1 - baseline2021.playoff_rate) * 1000) / 1000,
            baseline_miss_rate_2022: Math.round((1 - baseline2022.playoff_rate) * 1000) / 1000,
            baseline_miss_rate_2023: Math.round((1 - baseline2023.playoff_rate) * 1000) / 1000,
            baseline_miss_rate_2024: Math.round((1 - baseline2024.playoff_rate) * 1000) / 1000,
            baseline_miss_rate_2025: Math.round((1 - baseline2025.playoff_rate) * 1000) / 1000,
            overall_strategies,
            first_two_pick_combos,
            miss_risk,
            round_value,
          };
        }
      }
    }
  }

  return { generated_at: now, trends };
}

export function computeAllFilteredCombos(allTeams: TeamRecord[]) {
  const now = new Date().toISOString();

  const QB_FORMATS = [
    { key: "superflex", label: "Superflex", filter: (t: TeamRecord) => t.roster_format === "Superflex" },
    { key: "one_qb", label: "1QB", filter: (t: TeamRecord) => t.roster_format === "1QB" },
  ];
  const SCORINGS = [
    { key: "ppr", label: "PPR", filter: (t: TeamRecord) => t.scoring_format === "PPR" },
    { key: "half_ppr", label: "Half PPR", filter: (t: TeamRecord) => t.scoring_format === "Half PPR" },
    { key: "standard", label: "Standard", filter: (t: TeamRecord) => t.scoring_format === "Standard" },
  ];
  const TEP_OPTS = [
    { key: "tep", label: "TEP", filter: (t: TeamRecord) => t.tep === true },
    { key: "no_tep", label: "No TEP", filter: (t: TeamRecord) => t.tep === false },
  ];
  const SIZES = [
    { key: "10", label: "10-Team", filter: (t: TeamRecord) => t.league_size === 10 },
    { key: "12", label: "12-Team", filter: (t: TeamRecord) => t.league_size === 12 },
    { key: "all", label: "All Sizes", filter: (t: TeamRecord) => t.league_size === 10 || t.league_size === 12 },
  ];
  const SEASONS = [
    { key: "all", label: "All Seasons", filter: (_t: TeamRecord) => true },
    { key: "2021", label: "2021", filter: (t: TeamRecord) => t.season === "2021" },
    { key: "2022", label: "2022", filter: (t: TeamRecord) => t.season === "2022" },
    { key: "2023", label: "2023", filter: (t: TeamRecord) => t.season === "2023" },
    { key: "2024", label: "2024", filter: (t: TeamRecord) => t.season === "2024" },
    { key: "2025", label: "2025", filter: (t: TeamRecord) => t.season === "2025" },
  ];

  const combos: Record<string, unknown> = {};

  for (const qb of QB_FORMATS) {
    for (const scoring of SCORINGS) {
      for (const tep of TEP_OPTS) {
        for (const size of SIZES) {
          for (const season of SEASONS) {
            const key = `${qb.key}__${scoring.key}__${tep.key}__${size.key}__${season.key}`;
            const filtered = allTeams.filter(
              (t) => qb.filter(t) && scoring.filter(t) && tep.filter(t) && size.filter(t) && season.filter(t)
            );
            combos[key] = computeFilteredSlice(
              filtered,
              `${qb.label} · ${scoring.label} · ${tep.label} · ${size.label} · ${season.label}`
            );
          }
        }
      }
    }
  }

  return { generated_at: now, combos };
}
