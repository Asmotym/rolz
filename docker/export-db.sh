#!/bin/bash
set -euo pipefail

PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
DOCKER_BIN="${DOCKER_BIN:-$(command -v docker)}"
DATE_BIN="${DATE_BIN:-$(command -v date)}"
MKDIR_BIN="${MKDIR_BIN:-$(command -v mkdir)}"

if [[ -z "$DOCKER_BIN" || -z "$DATE_BIN" || -z "$MKDIR_BIN" ]]; then
  echo "Required system binaries were not found. Check docker, date, and mkdir are installed." >&2
  exit 1
fi

if [[ -n "${COMPOSE:-}" ]]; then
  # Allow custom compose commands while keeping the default cron-safe.
  # shellcheck disable=SC2206
  COMPOSE_CMD=(${COMPOSE})
else
  COMPOSE_CMD=("$DOCKER_BIN" compose)
fi

COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_ROOT/docker-compose.yml}"
MYSQL_SERVICE="${MYSQL_SERVICE:-mysql}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
DEFAULT_OUTPUT_DIR="${OUTPUT_DIR:-$PROJECT_ROOT/docker/backups}"

ENV_ARGS=()
if [[ -f "$ENV_FILE" ]]; then
  ENV_ARGS=(--env-file "$ENV_FILE")
  # Load env locally so defaults mirror what the container uses.
  set -a
  source "$ENV_FILE"
  set +a
fi

db_name="${MYSQL_DATABASE:-rolz}"
db_host="${MYSQL_HOST:-mysql}"
db_port="${MYSQL_PORT:-3306}"

timestamp="$("$DATE_BIN" +%Y%m%d-%H%M%S)"
requested_path="${1:-}"

if [[ -z "$requested_path" ]]; then
  output_dir="$DEFAULT_OUTPUT_DIR"
  output_file="mysql-backup-${db_name}-${timestamp}.sql"
  output_path="${output_dir%/}/${output_file}"
elif [[ "$requested_path" == */ ]]; then
  output_dir="${requested_path%/}"
  output_path="${output_dir}/mysql-backup-${timestamp}.sql"
else
  output_dir="${requested_path%/*}"
  if [[ "$output_dir" == "$requested_path" ]]; then
    output_dir="."
  fi
  output_path="$requested_path"
fi

"$MKDIR_BIN" -p "$output_dir"

container_id="$("${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" "${ENV_ARGS[@]}" ps -q "$MYSQL_SERVICE")"
if [[ -z "$container_id" ]]; then
  echo "MySQL service '$MYSQL_SERVICE' is not running. Start it with '${COMPOSE_CMD[*]} -f $COMPOSE_FILE ${ENV_ARGS[*]} up -d $MYSQL_SERVICE'." >&2
  exit 1
fi

mysql_root_password="${MYSQL_ROOT_PASSWORD:-root}"
echo "Exporting MySQL data from service '$MYSQL_SERVICE' to $output_path ..."

"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" "${ENV_ARGS[@]}" exec -T -e MYSQL_PWD="$mysql_root_password" \
  "$MYSQL_SERVICE" mysqldump -uroot --host="$db_host" --port="$db_port" --protocol=TCP \
  --single-transaction --quick --routines --events --triggers \
  "$db_name" >"$output_path"

echo "Export completed: $output_path"
