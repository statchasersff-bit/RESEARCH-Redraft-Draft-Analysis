import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, "../../../../data/output");

const router = Router();

function readOutputFile(filename: string): unknown | null {
  const file = path.join(OUTPUT_DIR, filename);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function serveOutput(filename: string) {
  return (_req: Request, res: Response) => {
    const data = readOutputFile(filename);
    if (!data) {
      res.status(404).json({
        error: "not_found",
        message: `No data available yet. Run 'pnpm run redraft:update' to generate output files.`,
      });
      return;
    }
    res.json(data);
  };
}

router.get("/redraft/summary", serveOutput("redraft_strategy_summary.json"));
router.get("/redraft/by-slot", serveOutput("redraft_strategy_by_slot.json"));
router.get("/redraft/by-format", serveOutput("redraft_strategy_by_format.json"));
router.get("/redraft/first-two-picks", serveOutput("redraft_first_two_pick_combos.json"));
router.get("/redraft/first-five-builds", serveOutput("redraft_first_five_builds.json"));
router.get("/redraft/round-value", serveOutput("redraft_round_value.json"));
router.get("/redraft/recommendations", serveOutput("redraft_strategy_recommendations.json"));
router.get("/redraft/league-audit", serveOutput("redraft_strategy_league_audit.json"));

export default router;
