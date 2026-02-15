#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-3000}"
FIXED_DOMAIN="${2:-${NGROK_FIXED_DOMAIN:-}}"
PID_FILE=".ngrok.pid"
LOG_FILE=".ngrok.log"

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE")"
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "ngrok is already running (PID: $OLD_PID)"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if [[ -n "$FIXED_DOMAIN" ]]; then
  nohup ngrok http "$PORT" --url="$FIXED_DOMAIN" --log=stdout >"$LOG_FILE" 2>&1 &
else
  nohup ngrok http "$PORT" --log=stdout >"$LOG_FILE" 2>&1 &
fi

NEW_PID="$!"
echo "$NEW_PID" > "$PID_FILE"
sleep 2

if ! kill -0 "$NEW_PID" 2>/dev/null; then
  echo "Failed to start ngrok. Recent logs:"
  tail -n 20 "$LOG_FILE" || true
  exit 1
fi

echo "ngrok started (PID: $NEW_PID)"
if [[ -n "$FIXED_DOMAIN" ]]; then
  echo "Fixed URL: https://$FIXED_DOMAIN"
fi
grep -m1 -oE 'https://[^ ]+ngrok[^ ]*' "$LOG_FILE" || true
