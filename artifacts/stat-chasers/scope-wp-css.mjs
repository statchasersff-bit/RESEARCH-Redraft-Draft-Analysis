/**
 * scope-wp-css.mjs
 *
 * Two-step post-processor for the WP CSS bundle:
 *
 * 1. UNWRAP @layer — Tailwind v4 puts everything inside @layer blocks.
 *    The CSS Cascade spec says unlayered author CSS ALWAYS beats layered
 *    author CSS regardless of specificity. WordPress themes load unlayered
 *    stylesheets, so our layered Tailwind rules lose even with ID selectors.
 *    Stripping @layer wrappers puts us on equal footing.
 *
 * 2. SCOPE selectors — prefix every rule with `#statchasers-redraft-root
 *    .rs-app-root` (the mount-element ID plus the single app-root wrapper
 *    class). The ID keeps our unlayered rules winning specificity battles
 *    against theme rules; the .rs-app-root class makes the wrapper the single
 *    documented scoping root for every class in this tool.
 */

import postcss from "postcss";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_ID    = "#statchasers-redraft-root";
const ROOT_CLASS = ".rs-app-root";
const SCOPE      = `${ROOT_ID} ${ROOT_CLASS}`; // "#statchasers-redraft-root .rs-app-root"
const CSS_IN     = path.resolve(__dirname, "dist/wp/assets/index.css");

// ---------------------------------------------------------------------------
// Selector splitting — respects parens/brackets so :where(a,b) isn't split
// ---------------------------------------------------------------------------
function splitTopLevelCommas(selector) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of selector) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

function scopeSelector(selector) {
  return splitTopLevelCommas(selector)
    .map((s) => {
      const t = s.trim();
      if (!t) return t;
      if (t.startsWith(ROOT_ID))    return t;                 // already fully scoped
      if (t.startsWith(ROOT_CLASS)) return `${ROOT_ID} ${t}`; // author rule already under .rs-app-root → just add the ID
      if (t === ":root")            return SCOPE;             // CSS vars on the app-root wrapper
      if (t === ":host")            return SCOPE;             // shadow-dom host → wrapper
      if (t === "html" || t === "body") return SCOPE;         // base styles on the wrapper
      if (t.startsWith(":root"))    return SCOPE + t.slice(5);
      if (t === "*")                return `${SCOPE} *`;
      return `${SCOPE} ${t}`;
    })
    .join(", ");
}

function isInsideKeyframes(node) {
  if (!node) return false;
  if (node.type === "atrule" && node.name === "keyframes") return true;
  return isInsideKeyframes(node.parent);
}

// ---------------------------------------------------------------------------
// Step 1 — unwrap @layer blocks safely using replaceWith
// @layer declarations (no nodes, e.g. `@layer utilities;`) are just removed.
// ---------------------------------------------------------------------------
function unwrapLayers(root) {
  let total = 0;
  // Repeat until no @layer at-rules remain (handles nested layers)
  let found = true;
  while (found) {
    found = false;
    // Collect first so we don't mutate while walking
    const layers = [];
    root.walkAtRules("layer", (node) => { layers.push(node); });
    for (const node of layers) {
      if (!node.parent) continue; // already detached
      if (!node.nodes || node.nodes.length === 0) {
        // Bare `@layer name;` declaration — just remove it
        node.remove();
      } else {
        // Hoist children up to replace the @layer wrapper
        node.replaceWith(...node.nodes);
      }
      total++;
      found = true;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Step 2 — scope all rule selectors
// ---------------------------------------------------------------------------
function scopeRules(root) {
  root.walk((node) => {
    if (isInsideKeyframes(node.parent)) return;
    if (node.type === "rule") {
      try {
        node.selector = scopeSelector(node.selector);
      } catch (e) {
        // Leave unparseable selector untouched rather than crashing
        console.warn(`  ⚠ skipped selector: ${node.selector.slice(0, 80)}`);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const rawCss = fs.readFileSync(CSS_IN, "utf8");

let ast;
try {
  ast = postcss.parse(rawCss);
} catch (e) {
  console.error("PostCSS parse error:", e.message);
  process.exit(1);
}

const layersRemoved = unwrapLayers(ast);
scopeRules(ast);

const output = ast.toResult().css;
fs.writeFileSync(CSS_IN, output, "utf8");

const origKB = (Buffer.byteLength(rawCss)   / 1024).toFixed(1);
const newKB  = (Buffer.byteLength(output)   / 1024).toFixed(1);
console.log(`✓ ${layersRemoved} @layer blocks unwrapped, all rules scoped to ${SCOPE}  (${origKB} kB → ${newKB} kB)`);
