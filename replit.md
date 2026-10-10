# StatChasers Redraft Strategy Analyzer

## Overview

Full-stack fantasy football analytics platform. Analyzes Sleeper redraft league data to identify optimal draft strategies. Includes a data pipeline that fetches and analyzes Sleeper API data, and a React frontend guide displaying the results.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (not used for this app — data stored as JSON files)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm run redraft:update` — full pipeline: fetch → analyze → export (Steps 1–8). With >16K leagues this exceeds the 120s tool limit; use the two-step approach below instead.
- `pnpm run redraft:fetch` — Steps 1–3 only: load leagues, build team records, write `data/tmp/team_records_cache.json`. Completes in ~100s.
- `pnpm run redraft:analyze` — Steps 4–8 only: reads team records cache, runs analysis, writes all output files including trends. Completes in ~60-90s with 331K teams (all scripts now have `--max-old-space-size=8192`).
- `pnpm run redraft:update:refresh` — full pipeline forcing re-fetch from Sleeper API (ignores cache)
- `pnpm run discover:redraft` — discover redraft leagues from Sleeper (reads `data/input/sleeper_discovery_config.json`). Config now uses `max_network_depth: 2` for 3× more reach.
- `pnpm run discover:redraft:refresh` — same as above but forces re-fetch of Sleeper API calls

## Data Pipeline

### Input
Add league IDs to `data/input/sleeper_redraft_leagues.csv`:
```
season,league_id,notes
2024,1048282490960420864,My PPR league
```

### Raw Cache
Fetched Sleeper API responses are cached under `data/raw/sleeper/`. Use `--refresh` flag to re-fetch.

### Output Files
All outputs written to `data/output/`:
- `redraft_strategy_summary.json` — overall summary, best/worst strategies, key takeaways
- `redraft_strategy_by_slot.json` — strategies grouped by Early/Middle/Late draft slot
- `redraft_strategy_by_format.json` — strategies grouped by scoring/roster format
- `redraft_first_two_pick_combos.json` — first-two-pick combo analysis
- `redraft_first_five_builds.json` — first-five-round positional build analysis
- `redraft_round_value.json` — positional value by draft round
- `redraft_strategy_recommendations.json` — plain-English recommendations
- `redraft_strategy_league_audit.json` — per-league processing audit log
- `redraft_negative_strategies.json` — strategies that consistently miss playoffs (Step 6)
- `redraft_playoff_miss_risk.json` — miss probability + relative risk for every strategy (Step 6)
- `redraft_by_filter_combo.json` — pre-computed analysis for all 108 filter combos (Step 7): QB × Scoring × TEP × Size × Season (all/2024/2025)
- `redraft_by_filter_trends.json` — year-over-year trend analysis (Step 8): 36 combos (QB × Scoring × TEP × Size, no season dim); each combo has per-strategy 2023/2024/2025 metrics + 2024→2025 delta + trend_label

## Artifacts

- **stat-chasers** — React frontend guide at `/` — StatChasers branding (navy #0B1F3A + gold #C9A227)
- **api-server** — Express backend at `/api` — serves JSON output files via REST endpoints

## API Endpoints

All endpoints at `/api/redraft/`:
- `GET /api/redraft/summary`
- `GET /api/redraft/by-slot`
- `GET /api/redraft/by-format`
- `GET /api/redraft/first-two-picks`
- `GET /api/redraft/first-five-builds`
- `GET /api/redraft/round-value`
- `GET /api/redraft/recommendations`
- `GET /api/redraft/league-audit`
- `GET /api/redraft/negative-strategies`
- `GET /api/redraft/playoff-miss-risk`
- `GET /api/redraft/filter-combos` — pre-computed analysis for all 108 filter combos (QB × Scoring × TEP × Size × Season)
- `GET /api/redraft/filter-trends` — year-over-year comparison for 36 combos (QB × Scoring × TEP × Size); powers "Compare Years" mode (2023/2024/2025)

Returns 404 with message to run `pnpm run redraft:update` if no data available yet.

## League Validation Rules

Leagues are skipped if:
- Dynasty or keeper format
- Best ball
- League size < 8 or > 14
- 10- or 12-team league with ≠ 6 playoff spots (non-standard format)
- Auction draft
- Draft not complete
- No draft data

## Strategy Classifications

Each team gets **exactly one** core archetype (mutually exclusive), plus 0–4 independent timing overlays.

**Core archetypes** (priority order — first match wins):
- **Zero RB** — 0 RBs in rounds 1–5
- **Robust RB** — 3+ RBs in rounds 1–5
- **Hero RB** — exactly 1 RB in rounds 1–5
- **WR Heavy** — 3+ WRs in rounds 1–5 (rb5 === 2)
- **Balanced** — exactly 2 RBs and fewer than 3 WRs in rounds 1–5 (the remainder)

**Positional timing overlays** (independent, additive):
- **Elite QB** — first QB in rounds 1–4
- **Elite TE** — first TE in rounds 1–2
- **Late QB** — first QB in round 8 or later (or undrafted)
- **Late TE** — first TE in round 8 or later (or undrafted)

**First-two-pick combos** (separate analysis layer only):
- RB/RB, RB/WR, WR/RB, WR/WR

## Scripts

Located in `scripts/src/`:
- `fetch_sleeper_redraft_data.ts` — fetches and caches Sleeper API data
- `analyze_redraft_strategy.ts` — validates leagues, builds team profiles, runs analysis
- `update_redraft_strategy.ts` — orchestrates the full pipeline (entry point)

## Data Status

- `data/input/sleeper_redraft_leagues.csv` — 24,304 leagues (11,560 from 2024, 12,744 from 2025)
- `data/output/redraft_strategy_summary.json` — seasons_included: ["2024", "2025"], 21,761 leagues, 242,312 teams
- 2025 discovery (all depth-2): Makitrain (+1,570) + sandman731 (+1,401) + travesty19 (+2,198) + jaydejesus617 (+1,227) + blake89sr (+762)

## Dev Workflow (stat-chasers)

The frontend runs as `vite dev` in static mode — no build step on startup:
1. `prepare:public` copies data files from `data/output/` → `artifacts/stat-chasers/public/data/` (~1s)
2. `dev:static` starts Vite dev server with `VITE_STATIC_DATA=true` (~1s)

Total startup time: ~2s (vs. 10+ s for the old build + preview approach).

After running the data pipeline (`redraft:analyze`), restart the stat-chasers workflow to pick up the new data.

## Gotchas

- **API server path**: `redraft.ts` resolves `data/output` with `../../../` from `dist/` (3 levels up to workspace root). Using 4+ levels overshoots outside workspace.
- **Pipeline two-step workflow**: With 16K+ leagues, the full pipeline exceeds the 120s tool timeout. Use `redraft:fetch` (~100s, writes `data/tmp/team_records_cache.json`) then `redraft:analyze` (~30s, reads cache and writes all outputs). The `redraft:update` single-command still works for smaller datasets.
- **`redraft:update` re-runs are safe**: all Sleeper API responses are cached under `data/raw/sleeper/`. Only use `--refresh` to force re-fetch from the live API.
- **Discovery session checkpoint**: `discover_sleeper_redraft_leagues.ts` saves `data/tmp/discover_ckpt_session_<season>.json` after Steps 1–5 so that restarts skip league-crawling entirely and resume straight to Phase 6b validation. All checkpoint paths use `ROOT` (not `process.cwd()`) to be cwd-independent.
- **Discovery checkpoint location**: all checkpoint files go to `ROOT/data/tmp/` (workspace root), not `scripts/data/tmp/`. If you see two sets, the ROOT ones are authoritative.
- **public/data/ is generated**: `artifacts/stat-chasers/public/data/` is populated by `prepare:public` on every workflow start. It's gitignored but always fresh. The `public/data/combos/` files are the split filter-combo JSON files (one per filter key).
