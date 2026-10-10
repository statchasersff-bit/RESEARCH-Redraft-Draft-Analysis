#!/bin/sh
# Rebuild the stat-chasers static bundle if source is newer than the built bundle.
#
# The preview server (services.development in artifact.toml) serves the COMMITTED
# prebuilt bundle at dist/public/assets/index.js — it is not a hot-reloading dev
# server. So .tsx/.css edits are invisible until the bundle is rebuilt. This runs
# from a Stop hook (once per turn) and no-ops instantly when nothing changed.
set -e

ROOT=/home/runner/workspace
BUNDLE="$ROOT/artifacts/stat-chasers/dist/public/assets/index.js"

# Sources that affect the build. index.html is the Vite entry; src/ holds the app.
NEWER=$(find "$ROOT/artifacts/stat-chasers/src" "$ROOT/artifacts/stat-chasers/index.html" \
  -type f -newer "$BUNDLE" -print -quit 2>/dev/null || true)

if [ -f "$BUNDLE" ] && [ -z "$NEWER" ]; then
  exit 0  # up to date — nothing to do
fi

cd "$ROOT"
pnpm --filter @workspace/stat-chasers run build:static >/dev/null 2>&1
echo '{"systemMessage":"Rebuilt stat-chasers static bundle (source changed)."}'
