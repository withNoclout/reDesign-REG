#!/usr/bin/env bash
set -euo pipefail

TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-${DATABASE_URL:-}}"
IMPORT_FILE="${IMPORT_FILE:-/var/www/reDesign-REG/web-app/tmp/db-export/redesign-reg-data.dump}"

if [[ -z "$TARGET_DATABASE_URL" ]]; then
  echo "TARGET_DATABASE_URL or DATABASE_URL is required." >&2
  exit 1
fi

if [[ ! -f "$IMPORT_FILE" ]]; then
  echo "Import file not found: $IMPORT_FILE" >&2
  exit 1
fi

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$TARGET_DATABASE_URL" \
  "$IMPORT_FILE"

echo "Local PostgreSQL import completed from $IMPORT_FILE"
