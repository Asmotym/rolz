#!/usr/bin/env bash
set -euo pipefail

PG_MAJOR="${PG_MAJOR:-15}"
PGDATA="${PGDATA:-/var/lib/postgresql/data}"
PG_BIN="/usr/lib/postgresql/${PG_MAJOR}/bin"
POSTGRES_LOG="/var/log/postgresql/postgres.log"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

mkdir -p "$PGDATA" "$(dirname "$POSTGRES_LOG")"
touch "$POSTGRES_LOG"
chown -R postgres:postgres /var/lib/postgresql "$(dirname "$POSTGRES_LOG")"

if [[ ! -s "$PGDATA/PG_VERSION" ]]; then
  su - postgres -c "${PG_BIN}/initdb -D '$PGDATA'"
  cat <<'EOF' >> "$PGDATA/postgresql.conf"
listen_addresses = '*'
EOF
  cat <<'EOF' >> "$PGDATA/pg_hba.conf"
host all all 0.0.0.0/0 scram-sha-256
host all all ::/0 scram-sha-256
EOF
fi

start_postgres() {
  su - postgres -c "${PG_BIN}/pg_ctl -D '$PGDATA' -l '$POSTGRES_LOG' -o \"-c listen_addresses='*' -p ${POSTGRES_PORT}\" -w start"
}

stop_postgres() {
  su - postgres -c "${PG_BIN}/pg_ctl -D '$PGDATA' -m fast -w stop"
}

backend_pid=""
frontend_pid=""

cleanup() {
  set +e
  [[ -n "$backend_pid" ]] && kill "$backend_pid" 2>/dev/null || true
  [[ -n "$frontend_pid" ]] && kill "$frontend_pid" 2>/dev/null || true
  stop_postgres >/dev/null 2>&1 || true
}

trap cleanup SIGINT SIGTERM EXIT

start_postgres

ROLE_EXISTS=$(su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER:-rolz}'\"")
if [[ "$ROLE_EXISTS" != "1" ]]; then
  su - postgres -c "psql -c \"CREATE ROLE ${POSTGRES_USER:-rolz} LOGIN PASSWORD '${POSTGRES_PASSWORD:-rolz}'\""
fi

DB_EXISTS=$(su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB:-rolz}'\"")
if [[ "$DB_EXISTS" != "1" ]]; then
  su - postgres -c "createdb --owner=${POSTGRES_USER:-rolz} ${POSTGRES_DB:-rolz}"
fi

export DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER:-rolz}:${POSTGRES_PASSWORD:-rolz}@localhost:${POSTGRES_PORT}/${POSTGRES_DB:-rolz}}"
export BACKEND_PORT="${BACKEND_PORT:-4000}"
export PORT="$BACKEND_PORT"
export FRONTEND_PORT="${FRONTEND_PORT:-5173}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:${FRONTEND_PORT}}"
export VITE_BACKEND_URL="${VITE_BACKEND_URL:-http://localhost:${BACKEND_PORT}}"
export HOST="${HOST:-0.0.0.0}"

node dist-server/index.js &
backend_pid=$!

npm run preview -- --host 0.0.0.0 --port "$FRONTEND_PORT" &
frontend_pid=$!

wait -n
