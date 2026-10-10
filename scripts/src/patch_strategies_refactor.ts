/**
 * patch_strategies_refactor.ts
 *
 * One-time migration: rewrite the `strategies` field in the team records NDJSON
 * cache to match the new classification system:
 *   - 5 mutually exclusive core archetypes (Zero RB, Hero RB, Robust RB, WR Heavy, Balanced)
 *   - 4 independent positional timing overlays (Elite QB, Elite TE, Late QB, Late TE)
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");

const NDJSON_PATH = path.join(ROOT, "data/tmp/team_records_cache_teams.ndjson");
const TMP_PATH = NDJSON_PATH + ".patching.tmp";

interface TeamRecord {
  rb_count_rounds_1_5: number;
  wr_count_rounds_1_5: number;
  first_qb_round: number | null;
  first_te_round: number | null;
  strategies: string[];
  [key: string]: unknown;
}

function reclassify(team: TeamRecord): TeamRecord {
  const rb5 = team.rb_count_rounds_1_5 ?? 0;
  const wr5 = team.wr_count_rounds_1_5 ?? 0;
  const firstQb = team.first_qb_round ?? null;
  const firstTe = team.first_te_round ?? null;

  // Core strategy — exactly one per team
  let core: string;
  if (rb5 === 0) {
    core = "Zero RB";
  } else if (rb5 >= 3) {
    core = "Robust RB";
  } else if (rb5 === 1) {
    core = "Hero RB";
  } else if (wr5 >= 3) {
    core = "WR Heavy";
  } else {
    core = "Balanced";
  }

  const strategies: string[] = [core];

  // Positional timing overlays
  if (firstQb !== null && firstQb <= 4) strategies.push("Elite QB");
  if (firstTe !== null && firstTe <= 2) strategies.push("Elite TE");
  if (firstQb === null || firstQb >= 8) strategies.push("Late QB");
  if (firstTe === null || firstTe >= 8) strategies.push("Late TE");

  return { ...team, strategies };
}

async function main() {
  if (!fs.existsSync(NDJSON_PATH)) {
    console.error(`NDJSON cache not found: ${NDJSON_PATH}`);
    process.exit(1);
  }

  console.log(`Patching ${NDJSON_PATH} ...`);
  const input = fs.createReadStream(NDJSON_PATH, "utf8");
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const out = fs.createWriteStream(TMP_PATH, "utf8");

  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const team = JSON.parse(line) as TeamRecord;
    const patched = reclassify(team);
    out.write(JSON.stringify(patched) + "\n");
    count++;
    if (count % 100_000 === 0) process.stdout.write(`  ${count.toLocaleString()} teams patched...\n`);
  }

  await new Promise<void>((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
    out.end();
  });

  fs.renameSync(TMP_PATH, NDJSON_PATH);
  console.log(`Done — patched ${count.toLocaleString()} team records.`);
}

main().catch((err) => {
  console.error(err);
  if (fs.existsSync(TMP_PATH)) fs.unlinkSync(TMP_PATH);
  process.exit(1);
});
