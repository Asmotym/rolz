#!/usr/bin/env bash
set -euo pipefail

COMPOSE_BIN="${COMPOSE:-docker compose}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
# ROLZ_SERVICE is a deprecated compatibility alias for existing automation.
AVENTYR_SERVICE="${AVENTYR_SERVICE:-${ROLZ_SERVICE:-aventyr}}"
ENV_FILE="${ENV_FILE:-.env}"
DEFAULT_OUTPUT_DIR="${OUTPUT_DIR:-./docker/backups}"

ENV_ARGS=()
if [[ -f "$ENV_FILE" ]]; then
  ENV_ARGS=(--env-file "$ENV_FILE")
  # Load the same env so defaults match what the container uses.
  set -a
  source "$ENV_FILE"
  set +a
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
requested_path="${1:-}"

if [[ -z "$requested_path" ]]; then
  output_dir="$DEFAULT_OUTPUT_DIR"
  output_file="aventyr-mysql-backup-${timestamp}.sql"
  output_path="${output_dir%/}/${output_file}"
elif [[ "$requested_path" == */ ]]; then
  output_dir="${requested_path%/}"
  output_path="${output_dir}/aventyr-mysql-backup-${timestamp}.sql"
else
  output_dir="$(dirname "$requested_path")"
  output_path="$requested_path"
fi

mkdir -p "$output_dir"

container_id="$($COMPOSE_BIN -f "$COMPOSE_FILE" "${ENV_ARGS[@]}" ps -q "$AVENTYR_SERVICE")"
if [[ -z "$container_id" ]]; then
  echo "Service '$AVENTYR_SERVICE' is not running. Start it with '$COMPOSE_BIN -f $COMPOSE_FILE ${ENV_ARGS[*]} up -d $AVENTYR_SERVICE'." >&2
  exit 1
fi

db_host="${MYSQL_HOST:-mysql}"
db_port="${MYSQL_PORT:-3306}"
db_name="${MYSQL_DATABASE:-aventyr}"
db_user="${MYSQL_USER:-aventyr}"
db_password="${MYSQL_PASSWORD:-aventyr}"

echo "Exporting MySQL data via service '$AVENTYR_SERVICE' (host=$db_host port=$db_port db=$db_name) to $output_path ..."

$COMPOSE_BIN -f "$COMPOSE_FILE" "${ENV_ARGS[@]}" exec -T -e MYSQL_PWD="$db_password" \
  "$AVENTYR_SERVICE" mysqldump \
  -h "$db_host" -P "$db_port" -u"$db_user" \
  --single-transaction --quick --routines --events --triggers \
  "$db_name" >"$output_path"

echo "Export completed: $output_path"
