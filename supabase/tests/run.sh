#!/usr/bin/env bash
# Applies the migrations to a scratch database on a local Postgres and runs the SQL checks.
# Lines that print ERROR are deliberate negative checks (secret columns, bad input).
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-sharetest}
dropdb --if-exists "$DB" && createdb "$DB"
psql -q -d "$DB" -f tests/stub_supabase.sql
for f in migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -d "$DB" -f tests/sharing_test.sql
psql -q -d "$DB" -f tests/referrals_test.sql
psql -q -d "$DB" -f tests/backups_test.sql
psql -q -d "$DB" -f tests/live_test.sql
psql -q -d "$DB" -f tests/swaps_test.sql
psql -q -d "$DB" -f tests/profiles_test.sql
