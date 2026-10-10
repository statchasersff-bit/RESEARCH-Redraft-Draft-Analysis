import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DATA_OUTPUT = path.join(ROOT, "data/output");
const DATA_RAW_PICKS = path.join(ROOT, "data/raw/sleeper/picks");
const WP_BUILD_DIR = path.join(ROOT, "artifacts/stat-chasers/dist/wp");
const PLUGIN_SLUG = "statchasers-redraft";
const PLUGIN_DIR = path.join(ROOT, "dist/wp-plugin", PLUGIN_SLUG);
const PLUGIN_ZIP = path.join(ROOT, "dist/wp-plugin", `${PLUGIN_SLUG}.zip`);
const SCOPE_ID = "#statchasers-redraft-root";
// Single source of truth for the plugin version. Bump on every shipped change
// so WordPress busts the cached JS (the CSS is inlined, so it can never go stale).
const PLUGIN_VERSION = "1.0.13";

const CURATED_DRAFTS: { id: string; label: string }[] = [
  { id: "1036810729875275776", label: "12-Team PPR · Slot 1 goes Robust RB" },
  { id: "1040373379007639552", label: "12-Team PPR · Mixed strategies" },
  { id: "1044042872896557056", label: "12-Team PPR · Hero RB & Zero RB clash" },
  { id: "1038894729859059712", label: "10-Team PPR · Robust RB dominates" },
  { id: "1040014433634103296", label: "10-Team PPR · WR Heavy opens round 1" },
  { id: "1042510591354609664", label: "10-Team PPR · Late QB experiment" },
  { id: "1043638188797075456", label: "10-Team PPR · Balanced field" },
];

const DATA_FILES: { src: string; dest: string }[] = [
  { src: "redraft_strategy_summary.json",      dest: "redraft_strategy_summary.json" },
  { src: "redraft_round_value.json",            dest: "redraft_round_value.json" },
  { src: "redraft_strategy_recommendations.json", dest: "redraft_strategy_recommendations.json" },
  { src: "redraft_negative_strategies.json",    dest: "redraft_negative_strategies.json" },
  { src: "redraft_playoff_miss_risk.json",      dest: "redraft_playoff_miss_risk.json" },
  { src: "redraft_by_filter_trends.json",       dest: "redraft_by_filter_trends.json" },
  // redraft_by_filter_combo.json is split into per-key files under data/combos/ — see step below
];

function detectStrategy(picks: any[], slot: number): string {
  const early = picks.filter((p) => p.draft_slot === slot && p.round <= 5);
  const rbs = early.filter((p) => p.metadata.position === "RB").length;
  const wrs = early.filter((p) => p.metadata.position === "WR").length;
  const qbRounds = picks.filter((p) => p.draft_slot === slot && p.metadata.position === "QB").map((p) => p.round as number);
  const teRounds = picks.filter((p) => p.draft_slot === slot && p.metadata.position === "TE").map((p) => p.round as number);
  const firstQB = qbRounds.length ? Math.min(...qbRounds) : 99;
  const firstTE = teRounds.length ? Math.min(...teRounds) : 99;

  const parts: string[] = [];
  if (rbs === 0) parts.push("Zero RB");
  else if (rbs === 1) parts.push("Hero RB");
  else if (rbs >= 3) parts.push("Robust RB");
  else parts.push("Balanced");
  if (wrs >= 3) parts.push("WR Heavy");
  if (firstQB <= 4) parts.push("Elite QB");
  if (firstTE <= 2) parts.push("Elite TE");
  if (firstQB >= 8) parts.push("Late QB");
  return parts.join(" + ");
}

function buildDraftBoards(): object[] {
  return CURATED_DRAFTS.map((draft, index) => {
    const picksFile = path.join(DATA_RAW_PICKS, `${draft.id}_picks.json`);
    if (!fs.existsSync(picksFile)) {
      throw new Error(`Missing picks file: ${picksFile}`);
    }
    const rawPicks: any[] = JSON.parse(fs.readFileSync(picksFile, "utf8"));
    const slots = Array.from(new Set(rawPicks.map((p) => p.draft_slot as number))).sort((a, b) => a - b);
    const strategies = slots.map((slot) => ({
      strategy: detectStrategy(rawPicks, slot),
      roster_id: rawPicks.find((p) => p.draft_slot === slot)?.roster_id ?? 0,
      slot,
    }));
    const picks = rawPicks.map((p) => ({
      round: p.round as number,
      slot: p.draft_slot as number,
      roster_id: p.roster_id as number,
      name: `${p.metadata.first_name} ${p.metadata.last_name}`,
      position: p.metadata.position as string,
      nfl_team: p.metadata.team as string,
    }));
    return {
      draft_id: draft.id,
      label: draft.label,
      index,
      total: CURATED_DRAFTS.length,
      num_teams: slots.length,
      num_rounds: new Set(rawPicks.map((p) => p.round)).size,
      strategies,
      picks,
    };
  });
}

// NOTE: CSS scoping (selectors → #statchasers-redraft-root) and @layer
// stripping are handled ONCE by artifacts/stat-chasers/scope-wp-css.mjs, which
// runs as part of the `build:wp` script. That scoper is PostCSS-based and
// paren-aware (it won't break `:is()`/`:where()` selectors). This script must
// NOT re-scope its output — doing so produced dead
// `#statchasers-redraft-root #statchasers-redraft-root .x` selectors that match
// nothing. We only prepend the WordPress/Divi compatibility reset below.

function generatePhpPlugin(): string {
  return `<?php
/**
 * Plugin Name: StatChasers Redraft Analyzer
 * Plugin URI:  https://statchasers.com
 * Description: Embed the StatChasers fantasy football redraft strategy analyzer on any WordPress page. Use the shortcode [statchasers_redraft] on any page or post.
 * Version:     ${PLUGIN_VERSION}
 * Author:      StatChasers
 * License:     GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

function statchasers_redraft_assets_url() {
    return trailingslashit( plugin_dir_url( __FILE__ ) . 'assets' );
}

function statchasers_redraft_shortcode( $atts ) {
    static $rendered = false;
    $assets_url  = statchasers_redraft_assets_url();
    $assets_path = plugin_dir_path( __FILE__ ) . 'assets/';

    $html = '';

    if ( ! $rendered ) {
        // Load Inter from Google Fonts — the app's font stack relies on it.
        // Use wp_enqueue_style so WordPress deduplicates it if already loaded.
        wp_enqueue_style(
            'statchasers-inter-font',
            'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
            [],
            null
        );

        // Inline the full scoped CSS once per page load.
        // Inline <style> tags inside shortcode output are never processed by
        // WordPress caching/minification plugins, so @layer rules and CSS
        // custom properties are guaranteed to reach the browser intact.
        $css_file = $assets_path . 'index.css';
        if ( file_exists( $css_file ) ) {
            $html .= '<style id="statchasers-redraft-styles">' . file_get_contents( $css_file ) . '</style>' . "\\n";
        }
        $rendered = true;
    }

    // Enqueue the JS module in the footer.
    // Cache-bust on the built file's mtime so a new build is always picked up
    // even if the version constant isn't bumped (falls back to the version).
    $js_path = $assets_path . 'index.js';
    $js_ver  = file_exists( $js_path ) ? filemtime( $js_path ) : '${PLUGIN_VERSION}';
    wp_enqueue_script(
        'statchasers-redraft-script',
        $assets_url . 'index.js',
        [],
        $js_ver,
        true
    );
    wp_add_inline_script(
        'statchasers-redraft-script',
        'window.__SC_BASE_URL__ = ' . wp_json_encode( $assets_url ) . ';',
        'before'
    );

    $html .= '<div class="sc-draft-analysis-fullbleed"><div class="sc-draft-analysis-app"><div id="statchasers-redraft-root" style="min-height:600px;width:100%;"></div></div></div>';
    return $html;
}
add_shortcode( 'statchasers_redraft', 'statchasers_redraft_shortcode' );

add_filter( 'script_loader_tag', function( $tag, $handle, $src ) {
    if ( 'statchasers-redraft-script' === $handle ) {
        return '<script type="module" src="' . esc_url( $src ) . '"></script>' . "\\n";
    }
    return $tag;
}, 10, 3 );
`;
}

async function main(): Promise<void> {
  console.log("══════════════════════════════════════════════");
  console.log("  StatChasers Redraft — WordPress Plugin Build");
  console.log("══════════════════════════════════════════════\n");

  // Step 1: Pre-compute all draft boards
  console.log("Step 1: Pre-computing draft boards...");
  const boards = buildDraftBoards();
  console.log(`  ✓ Built ${boards.length} draft boards`);

  // Step 2: Vite WP build
  console.log("\nStep 2: Building React app (WordPress mode)...");
  execSync("pnpm --filter @workspace/stat-chasers run build:wp", {
    cwd: ROOT,
    stdio: "inherit",
  });
  console.log("  ✓ Vite build complete");

  // Step 3: Assemble plugin directory
  console.log("\nStep 3: Assembling plugin...");
  fs.rmSync(PLUGIN_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(PLUGIN_DIR, "assets/data"), { recursive: true });

  // Copy Vite build output into assets/ — flatten so index.js/index.css
  // land directly at plugin/assets/ (not plugin/assets/assets/).
  // dist/wp/assets/ → plugin/assets/  (JS, CSS)
  // dist/wp/assets/data/ is handled separately below; skip here.
  const builtAssetsDir = path.join(WP_BUILD_DIR, "assets");
  for (const file of fs.readdirSync(builtAssetsDir)) {
    if (file === "data") continue; // data handled separately
    const src = path.join(builtAssetsDir, file);
    const dest = path.join(PLUGIN_DIR, "assets", file);
    if (fs.statSync(src).isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.copyFileSync(src, dest);
    }
  }
  console.log("  ✓ Copied Vite build output (index.js + index.css → assets/)");

  // Prepend a WordPress/Divi compatibility reset to the (already scoped +
  // de-layered) CSS produced by scope-wp-css.mjs. We do NOT re-scope here.
  const cssFile = path.join(PLUGIN_DIR, "assets/index.css");
  if (fs.existsSync(cssFile)) {
    // Already scoped to #statchasers-redraft-root and @layer-stripped by
    // scope-wp-css.mjs during `build:wp`. Used verbatim.
    const scopedCss = fs.readFileSync(cssFile, "utf8");

    // Reset block: strips WordPress theme styles from common HTML elements
    // inside the plugin root. Specificity: ID (1-0-0) + element (0-0-1) = 1-0-1,
    // which beats typical theme class+element selectors (0-1-1) like .entry-content h2.
    // Tailwind utility classes (scoped: 1-1-0) then win over this reset.
    const wpReset = `
/* ── Host-fitting wrapper ────────────────────────────────────────────────────
   Fills its host container (Divi/WP column) so that the container's own width
   and padding control the plugin's width. No viewport breakout — reducing the
   Divi container/module width or padding now shrinks the tool. The inner shell
   still caps readable content at its own max-width (see scoped .sc-draft-analysis-shell). */
.sc-draft-analysis-fullbleed{width:100%;max-width:100%;margin:0 auto;box-sizing:border-box}
.sc-draft-analysis-app{width:100%;max-width:none;margin:0;padding:0;box-sizing:border-box}
/* ── Plugin root reset ───────────────────────────────────────────────────── */
${SCOPE_ID}{width:100%!important;max-width:none!important;box-sizing:border-box}
${SCOPE_ID} h1,${SCOPE_ID} h2,${SCOPE_ID} h3,${SCOPE_ID} h4,${SCOPE_ID} h5,${SCOPE_ID} h6{font-size:inherit;font-weight:inherit;line-height:inherit;font-family:inherit;margin:0;padding:0;color:inherit;border:none;background:none}
${SCOPE_ID} p{margin:0;padding:0}
${SCOPE_ID} a{color:inherit;text-decoration:inherit}
${SCOPE_ID} ul,${SCOPE_ID} ol,${SCOPE_ID} li{margin:0;padding:0;list-style:none}
${SCOPE_ID} img{max-width:none;height:auto}
${SCOPE_ID} button,${SCOPE_ID} input,${SCOPE_ID} select,${SCOPE_ID} textarea{font-family:inherit;font-size:inherit;line-height:inherit}
`;

    fs.writeFileSync(cssFile, wpReset + scopedCss);
    console.log(`  ✓ Prepended WordPress/Divi compatibility reset to scoped CSS`);
  }

  // Write pre-computed draft boards
  fs.writeFileSync(
    path.join(PLUGIN_DIR, "assets/data/redraft_draft_boards.json"),
    JSON.stringify(boards),
  );
  console.log("  ✓ Written redraft_draft_boards.json");

  // Copy data files
  for (const { src, dest } of DATA_FILES) {
    const srcPath = path.join(DATA_OUTPUT, src);
    if (!fs.existsSync(srcPath)) {
      console.warn(`  ⚠  Missing: ${src} — skipping`);
      continue;
    }
    fs.copyFileSync(srcPath, path.join(PLUGIN_DIR, "assets/data", dest));
    const mb = (fs.statSync(srcPath).size / 1024 / 1024).toFixed(1);
    console.log(`  ✓ Copied ${src} (${mb} MB)`);
  }

  // Split filter-combos into individual per-key files (replaces the 12 MB monolithic file)
  const combosFile = path.join(DATA_OUTPUT, "redraft_by_filter_combo.json");
  if (fs.existsSync(combosFile)) {
    const combosData = JSON.parse(fs.readFileSync(combosFile, "utf8")) as { combos: Record<string, unknown> };
    const combosDir = path.join(PLUGIN_DIR, "assets/data/combos");
    fs.mkdirSync(combosDir, { recursive: true });
    let comboCount = 0;
    for (const [key, value] of Object.entries(combosData.combos)) {
      fs.writeFileSync(path.join(combosDir, `${key}.json`), JSON.stringify(value));
      comboCount++;
    }
    const totalKb = Math.round(
      Array.from({ length: comboCount }).reduce<number>((acc, _, i) => {
        const k = Object.keys(combosData.combos)[i];
        return acc + JSON.stringify(combosData.combos[k]).length;
      }, 0) / 1024,
    );
    console.log(`  ✓ Split filter-combos into ${comboCount} files (~${totalKb} KB total, was 12 MB)`);
  } else {
    console.warn("  ⚠  Missing: redraft_by_filter_combo.json — skipping combo split");
  }

  // Write PHP file
  fs.writeFileSync(path.join(PLUGIN_DIR, `${PLUGIN_SLUG}.php`), generatePhpPlugin());
  console.log("  ✓ Generated PHP plugin file");

  // Step 4: Zip
  console.log("\nStep 4: Creating zip archive...");
  fs.mkdirSync(path.dirname(PLUGIN_ZIP), { recursive: true });
  if (fs.existsSync(PLUGIN_ZIP)) fs.rmSync(PLUGIN_ZIP);
  // Use Python's zipfile module since `zip` may not be installed in the environment
  execSync(
    `python3 -c "
import zipfile, os, sys
base = sys.argv[1]
slug = sys.argv[2]
out  = sys.argv[3]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(os.path.join(base, slug)):
        for f in files:
            abs_path = os.path.join(root, f)
            arc_path = os.path.relpath(abs_path, base)
            zf.write(abs_path, arc_path)
print('zip ok')
" "${path.dirname(PLUGIN_DIR)}" "${PLUGIN_SLUG}" "${PLUGIN_ZIP}"`,
    { stdio: "inherit" },
  );
  const zipMb = (fs.statSync(PLUGIN_ZIP).size / 1024 / 1024).toFixed(1);
  console.log(`  ✓ Created statchasers-redraft.zip (${zipMb} MB)`);

  console.log("\n══════════════════════════════════════════════");
  console.log("  Done! WordPress plugin ready.");
  console.log("");
  console.log("  Plugin: dist/wp-plugin/statchasers-redraft.zip");
  console.log("");
  console.log("  Install:");
  console.log("  1. WP Admin → Plugins → Add New → Upload Plugin");
  console.log("  2. Upload zip and Activate");
  console.log("  3. Paste shortcode on any page: [statchasers_redraft]");
  console.log("══════════════════════════════════════════════\n");
}

main().catch((err: unknown) => {
  console.error("Build failed:", err);
  process.exit(1);
});
