const ENDPOINT_MAP: Record<string, string> = {
  "/api/redraft/summary": "redraft_strategy_summary.json",
  "/api/redraft/round-value": "redraft_round_value.json",
  "/api/redraft/recommendations": "redraft_strategy_recommendations.json",
  "/api/redraft/negative-strategies": "redraft_negative_strategies.json",
  "/api/redraft/playoff-miss-risk": "redraft_playoff_miss_risk.json",
  "/api/redraft/filter-trends": "redraft_by_filter_trends.json",
  "/api/redraft/filter-combos": "redraft_by_filter_combo.json",
};

// Derive the plugin's assets directory from the JS bundle's own URL.
// import.meta.url in an ES-module bundle is the absolute URL of the
// script file itself (e.g. .../assets/index.js). Resolving "." against
// it gives the directory (.../assets/). This is far more reliable than
// a global variable injected by WordPress, which can fail if the inline
// script runs after the module or is blocked by a caching plugin.
//
// We use a computed string concat to prevent Vite from treating this as
// a static-asset import (Vite only transforms the pattern when the first
// argument to new URL() is a string literal that looks like a file path).
const _dot = ".";
const ASSETS_DIR: string = (() => {
  try {
    return new URL(_dot, import.meta.url).href.replace(/\/$/, "");
  } catch {
    return "";
  }
})();

function getBaseUrl(): string {
  // Primary: resolved from the bundle's own URL (works without any WP config)
  if (ASSETS_DIR) return ASSETS_DIR;
  // Fallback: WordPress inline script sets window.__SC_BASE_URL__ before the module runs
  const w = window as { __SC_BASE_URL__?: string };
  return (w.__SC_BASE_URL__ ?? "./").replace(/\/$/, "");
}

function dataUrl(filename: string): string {
  return `${getBaseUrl()}/data/${filename}`;
}

function extractApiPath(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    return parsed.pathname;
  } catch {
    return rawUrl.split("?")[0];
  }
}

function extractSearch(rawUrl: string): string {
  if (typeof rawUrl !== "string") return "";
  const q = rawUrl.indexOf("?");
  return q === -1 ? "" : rawUrl.slice(q + 1);
}

export function installStaticFetch(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

    const pathname = extractApiPath(rawUrl);

    const apiIndex = pathname.indexOf("/api/redraft/");
    if (apiIndex === -1) {
      return originalFetch(input, init);
    }

    const apiPath = pathname.slice(apiIndex);

    if (apiPath === "/api/redraft/draft-board") {
      const search = extractSearch(rawUrl);
      const params = new URLSearchParams(search);
      const idx = Math.max(0, parseInt(params.get("index") ?? "0", 10) || 0);
      const res = await originalFetch(dataUrl("redraft_draft_boards.json"));
      const allBoards = (await res.json()) as unknown[];
      const board = allBoards[Math.min(idx, allBoards.length - 1)] ?? allBoards[0];
      return new Response(JSON.stringify(board), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (apiPath === "/api/redraft/filter-combos") {
      const search = extractSearch(rawUrl);
      const keyParam = new URLSearchParams(search).get("key");
      if (keyParam) {
        const keys = keyParam.split(",").map((k) => k.trim()).filter(Boolean);
        const combos: Record<string, unknown> = {};
        await Promise.all(
          keys.map(async (k) => {
            try {
              const r = await originalFetch(dataUrl(`combos/${k}.json`));
              if (r.ok) combos[k] = await r.json();
            } catch {
              // skip missing keys
            }
          }),
        );
        return new Response(
          JSON.stringify({ generated_at: new Date().toISOString(), combos }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return originalFetch(dataUrl("redraft_by_filter_combo.json"));
    }

    const filename = ENDPOINT_MAP[apiPath];
    if (!filename) {
      return originalFetch(input, init);
    }

    return originalFetch(dataUrl(filename));
  };
}
