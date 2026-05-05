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
- `pnpm run redraft:update` — fetch Sleeper data + analyze + export JSON outputs (Steps 1–6)
- `pnpm run redraft:update:refresh` — same as above but forces re-fetch (ignores cache)
- `pnpm run discover:redraft` — discover redraft leagues from Sleeper (reads `data/input/sleeper_discovery_config.json`, pre-seeded with username "Makitrain", season "2024")
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

Returns 404 with message to run `pnpm run redraft:update` if no data available yet.

## League Validation Rules

Leagues are skipped if:
- Dynasty or keeper format
- Best ball
- League size < 8 or > 14
- Auction draft
- Draft not complete
- No draft data

## Strategy Classifications

A team can belong to multiple strategies:
- **Zero RB** — 0 RBs in rounds 1-5
- **Hero RB** — exactly 1 RB in rounds 1-5
- **Robust RB** — 3+ RBs in rounds 1-5
- **WR Heavy** — 3+ WRs in rounds 1-5
- **Elite QB** — QB in rounds 1-4
- **Elite TE** — TE in rounds 1-4
- **Balanced Start** — 1+ RB, 1+ WR, ≤1 QB, ≤1 TE, 4+ RB/WR total through round 5
- **Fragile RB** — exactly 2 RBs in rounds 1-5, no RBs in rounds 6-8
- **Late QB** — first QB in round 8 or later
- **Late TE** — first TE in round 8 or later
- **Anchor TE** — TE in rounds 1-3
- **Double Hero RB** — exactly 2 RBs in rounds 1-5, 3+ WRs in rounds 1-6

## Scripts

Located in `scripts/src/`:
- `fetch_sleeper_redraft_data.ts` — fetches and caches Sleeper API data
- `analyze_redraft_strategy.ts` — validates leagues, builds team profiles, runs analysis
- `update_redraft_strategy.ts` — orchestrates the full pipeline (entry point)

## Gotchas

- **API server path**: `redraft.ts` resolves `data/output` with `../../../` from `dist/` (3 levels up to workspace root). Using 4+ levels overshoots outside workspace.
- **Pipeline performance**: Step 3 fetches 530 leagues in parallel batches of 50 (not sequentially). The `analyzeAll` round-value loop had a dead O(n³) `flatMap` inside a filter callback — removed. Pipeline now completes in ~45s total.
- **`redraft:update` re-runs are safe**: all Sleeper API responses are cached under `data/raw/sleeper/`. Only use `--refresh` to force re-fetch from the live API.
