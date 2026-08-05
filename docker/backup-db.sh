#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="${BACKUP_DIR:-/opt/stacks/backups/aventyr}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-aventyr-mysql}"

source "$ENV_FILE"

mkdir -p "$BACKUP_DIR"

docker exec "$MYSQL_CONTAINER" mysqldump \
  -u root \
  -p"${MYSQL_ROOT_PASSWORD}" \
  "${MYSQL_DATABASE}" \
  > "$BACKUP_DIR/aventyr-db-$DATE.sql"

gzip "$BACKUP_DIR/aventyr-db-$DATE.sql"

find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +14 -delete
