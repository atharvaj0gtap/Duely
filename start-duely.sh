#!/usr/bin/env bash
# Launch Duely on macOS / Linux.
# Run from this script's own folder, wherever the project is cloned.
cd "$(dirname "$0")" || exit 1

# Open the browser shortly after the dev servers start.
(
  sleep 3
  if command -v open >/dev/null 2>&1; then
    open http://localhost:5173
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:5173
  fi
) &

# Start backend + frontend together (Ctrl+C to stop).
npm run dev:full
