#!/bin/sh
# Browser QA with two Playwright windows (tablet 820x1180, phone 390x844).
#   scripts/qa/run.sh games [gofish fleet ...]   play each game to the end through the UI
#   scripts/qa/run.sh accessibility              axe-core scan of every screen, light and dark
#   scripts/qa/run.sh platform                   rooms, refresh, server restart, offline, rematch
# Needs Playwright with Chromium; set PW_ROOT if it isn't the global install.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
DATA=$(mktemp -d)
LOG="$DATA/server.log"
: "${PW_ROOT:=$(npm root -g)/playwright}"
export PW_ROOT
KIND=$1; shift || true
case "$KIND" in
  games)
    [ $# -eq 0 ] && set -- gofish fleet clash cheat gin wheel grid whoswho memory canasta islands
    QA_PORT=3124 "$HERE/start-server.sh" "$DATA" "$LOG"; sleep 1
    QA_URL=http://localhost:3124 node "$HERE/play-games.mjs" "$@" || CODE=$? ;;
  accessibility)
    QA_PORT=3124 "$HERE/start-server.sh" "$DATA" "$LOG"; sleep 1
    QA_URL=http://localhost:3124 node "$HERE/accessibility.mjs" || CODE=$? ;;
  platform)
    export QA_PORT=3123 QA_SERVER=scripts/dev-test-game.js
    "$HERE/start-server.sh" "$DATA" "$LOG"; sleep 1
    QA_URL=http://localhost:3123 QA_RUN="$HERE/start-server.sh" QA_DATA="$DATA" QA_LOG="$LOG" node "$HERE/platform.mjs" || CODE=$? ;;
  *) echo "usage: $0 games|accessibility|platform"; exit 2 ;;
esac
kill "$(cat "$DATA/pid")" 2>/dev/null || true
exit ${CODE:-0}
