#!/usr/bin/env bash
set -euo pipefail

MYSQL_DATA_DIR="${MYSQL_DATA_DIR:-/var/lib/mysql}"
MYSQL_LOG="${MYSQL_LOG:-/var/log/mysql/mariadb.log}"
MYSQL_SOCKET="${MYSQL_SOCKET:-/run/mysqld/mysqld.sock}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER_NAME="${MYSQL_USER:-rolz}"
MYSQL_USER_PASSWORD="${MYSQL_PASSWORD:-rolz}"
MYSQL_DATABASE_NAME="${MYSQL_DATABASE:-rolz}"

mkdir -p "$MYSQL_DATA_DIR" "$(dirname "$MYSQL_LOG")" /run/mysqld
chown -R mysql:mysql "$MYSQL_DATA_DIR" /run/mysqld "$(dirname "$MYSQL_LOG")"

if [[ ! -d "$MYSQL_DATA_DIR/mysql" ]]; then
  mariadb-install-db --datadir="$MYSQL_DATA_DIR" --auth-root-authentication-method=normal --skip-test-db >/dev/null
fi

mysql_pid=""
backend_pid=""
frontend_pid=""

is_truthy() {
  local value="${1:-}"
  case "${value,,}" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

DEV_MODE=false
if is_truthy "${ROLZ_DEV_MODE:-}"; then
  DEV_MODE=true
elif [[ "${NODE_ENV:-}" != "" ]] && [[ "${NODE_ENV,,}" == "development" ]]; then
  DEV_MODE=true
fi

mysql_exec() {
  mysql --protocol=socket --socket="$MYSQL_SOCKET" --user=root --skip-password --execute "$1"
}

start_mysql() {
  mysqld \
    --datadir="$MYSQL_DATA_DIR" \
    --socket="$MYSQL_SOCKET" \
    --port="$MYSQL_PORT" \
    --bind-address=0.0.0.0 \
    --log-error="$MYSQL_LOG" \
    --skip-name-resolve \
    --user=mysql &
  mysql_pid=$!

  for _ in $(seq 1 30); do
    if mysqladmin --protocol=socket --socket="$MYSQL_SOCKET" --user=root --skip-password ping >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "MySQL failed to start" >&2
  exit 1
}

stop_mysql() {
  if [[ -n "$mysql_pid" ]]; then
    mysqladmin --protocol=socket --socket="$MYSQL_SOCKET" --user=root --skip-password shutdown >/dev/null 2>&1 || true
    wait "$mysql_pid" 2>/dev/null || true
  fi
}

cleanup() {
  set +e
  [[ -n "$backend_pid" ]] && kill "$backend_pid" 2>/dev/null || true
  [[ -n "$frontend_pid" ]] && kill "$frontend_pid" 2>/dev/null || true
  stop_mysql
}

trap cleanup SIGINT SIGTERM EXIT

start_mysql

escape_identifier() {
  printf '%s' "$1" | sed 's/`/``/g'
}

escape_literal() {
  printf '%s' "$1" | sed "s/'/''/g"
}

db_identifier=$(escape_identifier "$MYSQL_DATABASE_NAME")
user_identifier=$(escape_literal "$MYSQL_USER_NAME")
password_literal=$(escape_literal "$MYSQL_USER_PASSWORD")

mysql_exec "CREATE DATABASE IF NOT EXISTS \`${db_identifier}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql_exec "CREATE USER IF NOT EXISTS '${user_identifier}'@'%' IDENTIFIED BY '${password_literal}';"
mysql_exec "GRANT ALL PRIVILEGES ON \`${db_identifier}\`.* TO '${user_identifier}'@'%';"
mysql_exec 'FLUSH PRIVILEGES;'

export DATABASE_URL="${DATABASE_URL:-mysql://${MYSQL_USER_NAME}:${MYSQL_USER_PASSWORD}@localhost:${MYSQL_PORT}/${MYSQL_DATABASE_NAME}}"
export MYSQL_HOST="${MYSQL_HOST:-localhost}"
export BACKEND_PORT="${BACKEND_PORT:-4000}"
export PORT="$BACKEND_PORT"
export FRONTEND_PORT="${FRONTEND_PORT:-5173}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:${FRONTEND_PORT}}"
export VITE_BACKEND_URL="${VITE_BACKEND_URL:-http://localhost:${BACKEND_PORT}}"
export HOST="${HOST:-0.0.0.0}"

if [[ "$DEV_MODE" == "true" ]]; then
  export NODE_ENV=development
else
  export NODE_ENV="${NODE_ENV:-production}"
fi

start_backend() {
  if [[ "$DEV_MODE" == "true" ]]; then
    npm run server:dev &
  else
    node dist-server/index.js &
  fi
  backend_pid=$!
}

start_frontend() {
  if [[ "$DEV_MODE" == "true" ]]; then
    npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" &
  else
    npm run preview -- --host 0.0.0.0 --port "$FRONTEND_PORT" &
  fi
  frontend_pid=$!
}

start_backend
start_frontend

wait -n
