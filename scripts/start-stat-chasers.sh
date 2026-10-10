#!/bin/sh
# Start the stat-chasers vite dev server in static-data mode.
# Runs vite directly (not via pnpm) so SIGTERM is treated as a clean exit
# and Replit does not mark the workflow as FAILED on workspace sleep/restart.

cd /home/runner/workspace/artifacts/stat-chasers

# Forward SIGTERM/INT to vite and exit 0 so Replit sees a clean shutdown.
cleanup() {
  kill "$VITE_PID" 2>/dev/null
  exit 0
}
trap cleanup TERM INT

node_modules/.bin/vite --config vite.config.static.ts --host 0.0.0.0 &
VITE_PID=$!
wait "$VITE_PID"
