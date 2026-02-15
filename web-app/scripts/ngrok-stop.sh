#!/usr/bin/env bash
set -euo pipefail

PID_FILE=".ngrok.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "ngrok is not running (no PID file)."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Stopped ngrok (PID: $PID)"
else
  echo "No running process found for PID: $PID"
fi

rm -f "$PID_FILE"
