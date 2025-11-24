#!/usr/bin/env bash
set -euo pipefail

COMPOSE_BIN="${COMPOSE:-docker compose}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
MYSQL_SERVICE="${MYSQL_SERVICE:-mysql}"
ENV_FILE="${ENV_FILE:-.env}"

ENV_ARGS=()
if [[ -f "$ENV_FILE" ]]; then
  ENV_ARGS=(--env-file "$ENV_FILE")
fi

MYSQL_DATABASE_NAME="${MYSQL_DATABASE:-rolz}"
MYSQL_USER_NAME="${MYSQL_USER:-rolz}"
MYSQL_USER_PASSWORD="${MYSQL_PASSWORD:-rolz}"
MYSQL_ROOT_PASSWORD_VALUE="${MYSQL_ROOT_PASSWORD:-root}"

escape_identifier() {
  printf '%s' "$1" | sed 's/`/``/g'
}

escape_literal() {
  printf '%s' "$1" | sed "s/'/''/g"
}

db_identifier=$(escape_identifier "$MYSQL_DATABASE_NAME")
user_literal=$(escape_literal "$MYSQL_USER_NAME")
password_literal=$(escape_literal "$MYSQL_USER_PASSWORD")

SQL=$(
  cat <<SQL
CREATE DATABASE IF NOT EXISTS \`$db_identifier\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$user_literal'@'%' IDENTIFIED BY '$password_literal';
GRANT ALL PRIVILEGES ON \`$db_identifier\`.* TO '$user_literal'@'%';
FLUSH PRIVILEGES;
SQL
)

$COMPOSE_BIN -f "$COMPOSE_FILE" "${ENV_ARGS[@]}" exec -T "$MYSQL_SERVICE" mysql -uroot -p"$MYSQL_ROOT_PASSWORD_VALUE" <<SQL
$SQL
SQL
