#!/bin/sh
# usage: start-server.sh DATA_DIR LOG_FILE [server script]
# Starts a QA server on $QA_PORT in the background and writes DATA_DIR/pid.
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT=${3:-${QA_SERVER:-server/index.js}}
mkdir -p "$1"
cd "$ROOT" && ENTRY_LIMIT_PER_MINUTE=1000 PORT=${QA_PORT:-3124} DATA_DIR="$1" nohup node "$SCRIPT" >> "$2" 2>&1 &
echo $! > "$1/pid"
