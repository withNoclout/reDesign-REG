#!/usr/bin/env bash
set -euo pipefail

SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL:-${DATABASE_URL:-}}"
EXPORT_DIR="${EXPORT_DIR:-/var/www/reDesign-REG/web-app/tmp/db-export}"
EXPORT_FILE="${EXPORT_FILE:-$EXPORT_DIR/redesign-reg-data.dump}"
TABLES=(
  public.students
  public.evaluation_submissions
  public.news_items
  public.user_verifications
  public.student_profiles
  public.user_settings
  public.user_directory
  public.portfolio_collaborators
)

if [[ -z "$SOURCE_DATABASE_URL" ]]; then
  echo "SOURCE_DATABASE_URL or DATABASE_URL is required." >&2
  exit 1
fi

mkdir -p "$EXPORT_DIR"

ARGS=()
for table in "${TABLES[@]}"; do
  ARGS+=("-t" "$table")
done

pg_dump \
  --format=custom \
  --data-only \
  --no-owner \
  --no-privileges \
  --dbname "$SOURCE_DATABASE_URL" \
  "${ARGS[@]}" \
  --file "$EXPORT_FILE"

echo "Supabase data export written to $EXPORT_FILE"
