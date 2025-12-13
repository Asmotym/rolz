SHELL := /bin/bash

COMPOSE ?= docker compose
COMPOSE_FILE ?= docker-compose.yml
SERVICE ?= rolz
ENV_FILE ?= .env

export FRONTEND_PORT ?= 5173
export BACKEND_PORT ?= 4000
export MYSQL_PORT ?= 3306
export MYSQL_USER ?= rolz
export MYSQL_PASSWORD ?= rolz
export MYSQL_DATABASE ?= rolz
export MYSQL_ROOT_PASSWORD ?= root
export FRONTEND_URL ?= http://localhost:5173
export VITE_BACKEND_URL ?= http://localhost:4000
export DATABASE_URL ?= mysql://rolz:rolz@mysql:3306/rolz
export DATABASE_SSL ?= false

ENV_FILE_FLAG := $(shell test -f $(ENV_FILE) && echo "--env-file $(ENV_FILE)")
COMPOSE_CMD := $(COMPOSE) -f $(COMPOSE_FILE) $(ENV_FILE_FLAG)

.PHONY: build run up stop logs clean shell down

build:
	$(COMPOSE_CMD) build $(SERVICE)

run: up

up:
	$(COMPOSE_CMD) up -d --build $(SERVICE)

stop:
	-$(COMPOSE_CMD) stop $(SERVICE)

down:
	$(COMPOSE_CMD) down

logs:
	$(COMPOSE_CMD) logs -f $(SERVICE)

shell:
	$(COMPOSE_CMD) exec $(SERVICE) /bin/bash

clean:
	$(COMPOSE_CMD) down -v

.PHONY: db-update
db-update:
	@echo "Starting MySQL service..."
	@$(COMPOSE_CMD) up -d mysql
	@echo "Waiting for MySQL to be ready..."
	@$(COMPOSE_CMD) exec -T mysql sh -c 'until mysqladmin ping -h "$${MYSQL_HOST:-127.0.0.1}" -u root -p"$${MYSQL_ROOT_PASSWORD}" --silent; do sleep 1; done'
	@echo "Updating database schema..."
	@$(COMPOSE_CMD) run --rm \
		-e DATABASE_URL="mysql://$(MYSQL_USER):$(MYSQL_PASSWORD)@mysql:$(MYSQL_PORT)/$(MYSQL_DATABASE)" \
		$(SERVICE) npm run db:update

.PHONY: watch
watch:
	@echo "Starting frontend and backend watch servers..."
	@echo "Starting MySQL container..."
	@$(COMPOSE_CMD) up -d mysql
	@echo "Waiting for MySQL to be ready..."
	@$(COMPOSE_CMD) exec -T mysql sh -c 'until mysqladmin ping -h "$${MYSQL_HOST:-127.0.0.1}" -u root -p"$${MYSQL_ROOT_PASSWORD}" --silent; do sleep 1; done'
	@echo "Executing database bootstrap script..."
	@COMPOSE="$(COMPOSE)" COMPOSE_FILE="$(COMPOSE_FILE)" ENV_FILE="$(ENV_FILE)" ./docker/init-dev-db.sh
	@set -euo pipefail; \
		remaining=""; \
		if command -v lsof >/dev/null 2>&1; then \
			in_use=$$( { lsof -ti tcp:$(FRONTEND_PORT) 2>/dev/null || true; } | tr '\n' ' '); \
			if [ -n "$$in_use" ]; then \
				echo "Port $(FRONTEND_PORT) is already in use by PID(s): $$in_use — sending SIGTERM..." >&2; \
				kill $$in_use 2>/dev/null || true; \
				for attempt in $$(seq 1 10); do \
					sleep 0.2; \
					remaining=$$( { lsof -ti tcp:$(FRONTEND_PORT) 2>/dev/null || true; } | tr '\n' ' '); \
					if [ -z "$$remaining" ]; then \
						break; \
					fi; \
				done; \
				if [ -n "$$remaining" ]; then \
					echo "Unable to free port $(FRONTEND_PORT). Still held by: $$remaining" >&2; \
					echo "Stop those processes manually or run FRONTEND_PORT=<port> make watch." >&2; \
					exit 1; \
				fi; \
			fi; \
		fi; \
		backend_pid=; \
		frontend_pid=; \
		cleanup() { \
			set +e; \
			[ -n "$$backend_pid" ] && kill $$backend_pid 2>/dev/null || true; \
			[ -n "$$frontend_pid" ] && kill $$frontend_pid 2>/dev/null || true; \
			wait $$backend_pid $$frontend_pid 2>/dev/null || true; \
		}; \
		trap cleanup EXIT INT TERM; \
		npm run server:dev & \
		backend_pid=$$!; \
		npm run dev -- --host 0.0.0.0 --port $(FRONTEND_PORT) --strictPort & \
		frontend_pid=$$!; \
		wait $$backend_pid $$frontend_pid
