#!/usr/bin/env bash
set -euo pipefail

COMPOSE_BIN="${COMPOSE:-docker compose}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
MYSQL_SERVICE="${MYSQL_SERVICE:-mysql}"
ENV_FILE="${ENV_FILE:-.env}"
DEFAULT_BACKUP_DIR="${BACKUP_DIR:-./docker/backups}"

ENV_ARGS=()
if [[ -f "$ENV_FILE" ]]; then
  ENV_ARGS=(--env-file "$ENV_FILE")
  # Load env so defaults mirror the container.
  set -a
  source "$ENV_FILE"
  set +a
fi

db_name="${MYSQL_DATABASE:-rolz}"

backup_arg="${1:-}"

if [[ -n "$backup_arg" ]]; then
  backup_path="$backup_arg"
else
  if [[ ! -d "$DEFAULT_BACKUP_DIR" ]]; then
    echo "Backup directory '$DEFAULT_BACKUP_DIR' not found. Specify a backup file path." >&2
    exit 1
  fi

  # Pick the most recent .sql or .sql.gz file.
  backup_path="$(find "$DEFAULT_BACKUP_DIR" -maxdepth 1 -type f \( -name '*.sql' -o -name '*.sql.gz' \) -printf '%T@ %p\n' 2>/dev/null | sort -nr | awk 'NR==1{print $2}')"
  if [[ -z "${backup_path:-}" ]]; then
    echo "No .sql or .sql.gz backups found in '$DEFAULT_BACKUP_DIR'." >&2
    exit 1
  fi
fi

if [[ ! -f "$backup_path" ]]; then
  echo "Backup file '$backup_path' does not exist." >&2
  exit 1
fi

container_id="$($COMPOSE_BIN -f "$COMPOSE_FILE" "${ENV_ARGS[@]}" ps -q "$MYSQL_SERVICE")"
if [[ -z "$container_id" ]]; then
  echo "MySQL service '$MYSQL_SERVICE' is not running. Start it with '$COMPOSE_BIN -f $COMPOSE_FILE ${ENV_ARGS[*]} up -d $MYSQL_SERVICE'." >&2
  exit 1
fi

mysql_root_password="${MYSQL_ROOT_PASSWORD:-root}"
echo "Importing backup '$backup_path' into MySQL service '$MYSQL_SERVICE' ..."

# Ensure target database exists to avoid "No database selected".
$COMPOSE_BIN -f "$COMPOSE_FILE" "${ENV_ARGS[@]}" exec -T -e MYSQL_PWD="$mysql_root_password" \
  "$MYSQL_SERVICE" mysql -uroot --host=127.0.0.1 --protocol=TCP \
  -e "CREATE DATABASE IF NOT EXISTS \`$db_name\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if [[ "$backup_path" == *.gz ]]; then
  gunzip -c "$backup_path" | \
    $COMPOSE_BIN -f "$COMPOSE_FILE" "${ENV_ARGS[@]}" exec -T -e MYSQL_PWD="$mysql_root_password" \
    "$MYSQL_SERVICE" mysql -uroot --host=127.0.0.1 --protocol=TCP --database="$db_name"
else
  $COMPOSE_BIN -f "$COMPOSE_FILE" "${ENV_ARGS[@]}" exec -T -e MYSQL_PWD="$mysql_root_password" \
    "$MYSQL_SERVICE" mysql -uroot --host=127.0.0.1 --protocol=TCP --database="$db_name" <"$backup_path"
fi

echo "Import completed."
