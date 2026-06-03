#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${DB_NAME:-redesign_reg}"
DB_USER="${DB_USER:-redesign_reg}"
DB_PASSWORD="${DB_PASSWORD:-}"
BASELINE_SQL="${BASELINE_SQL:-/var/www/reDesign-REG/web-app/deploy/database/local-postgresql-baseline.sql}"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "DB_PASSWORD is required." >&2
  exit 1
fi

if [[ ! -f "$BASELINE_SQL" ]]; then
  echo "Baseline SQL not found: $BASELINE_SQL" >&2
  exit 1
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${DB_USER}', '${DB_PASSWORD}');
    ELSE
        EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '${DB_USER}', '${DB_PASSWORD}');
    END IF;
END
$$;
SQL

if ! sudo -u postgres psql -Atqc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -qx '1'; then
  sudo -u postgres createdb --owner "$DB_USER" "$DB_NAME"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$BASELINE_SQL"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "ALTER SCHEMA public OWNER TO \"$DB_USER\";"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"$DB_USER\";"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"$DB_USER\";"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO \"$DB_USER\";"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO \"$DB_USER\";"

echo "Local PostgreSQL bootstrap completed for ${DB_NAME}."
