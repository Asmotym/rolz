#!/bin/bash
set -euo pipefail

DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="/opt/stacks/backups/rolz"
ENV_FILE="/opt/stacks/rolz/app/.env"

source "$ENV_FILE"

mkdir -p "$BACKUP_DIR"

docker exec rolz-mysql mysqldump \
  -u root \
  -p"${MYSQL_ROOT_PASSWORD}" \
  "${MYSQL_DATABASE}" \
  > "$BACKUP_DIR/rolz-db-$DATE.sql"

gzip "$BACKUP_DIR/rolz-db-$DATE.sql"

find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +14 -delete