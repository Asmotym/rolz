SHELL := /bin/bash

COMPOSE ?= docker compose
COMPOSE_FILE ?= docker-compose.yml
PROD_COMPOSE_FILE ?= docker-compose.prod.yml
SERVICES ?= rolz api-docs phpmyadmin
PROD_SERVICES ?= rolz api-docs
ENV_FILE ?= .env
SENTRY_AUTH_TOKEN_FILE ?= .secrets/sentry-auth-token
SENTRY_AUTH_TOKEN_FROM_ENV := $(strip $(SENTRY_AUTH_TOKEN))

ifneq ("$(wildcard $(ENV_FILE))","")
include $(ENV_FILE)
export
endif

ifneq ($(SENTRY_AUTH_TOKEN_FROM_ENV),)
SENTRY_AUTH_TOKEN := $(SENTRY_AUTH_TOKEN_FROM_ENV)
endif

SENTRY_RELEASE := $(if $(strip $(SENTRY_RELEASE)),$(SENTRY_RELEASE),$(shell git rev-parse HEAD 2>/dev/null))
export SENTRY_RELEASE

FRONTEND_PORT ?= 5173
MYSQL_PORT ?= 3306
MYSQL_USER ?= rolz
MYSQL_PASSWORD ?= rolz
MYSQL_DATABASE ?= rolz
WATCH_DATABASE_URL ?= mysql://$(MYSQL_USER):$(MYSQL_PASSWORD)@127.0.0.1:$(MYSQL_PORT)/$(MYSQL_DATABASE)

ENV_FILE_FLAG := $(shell test -f $(ENV_FILE) && echo "--env-file $(ENV_FILE)")
COMPOSE_CMD := $(COMPOSE) -f $(COMPOSE_FILE) $(ENV_FILE_FLAG)
PROD_COMPOSE_CMD := $(COMPOSE) -f $(PROD_COMPOSE_FILE) $(ENV_FILE_FLAG)

.PHONY: build run up update update-repo prune-images stop logs clean shell down deploy prod-preflight prod-up prod-down prod-logs

build:
	$(COMPOSE_CMD) build $(SERVICE)

run: up

up:
	$(COMPOSE_CMD) up -d --build $(SERVICES)

update: update-repo
	@$(MAKE) prod-preflight SENTRY_RELEASE="$$(git rev-parse HEAD)"
	@$(MAKE) prod-down
	@$(MAKE) deploy SENTRY_RELEASE="$$(git rev-parse HEAD)"
	@$(MAKE) prune-images

update-repo:
	@echo "Updating repository..."
	@git fetch
	@git pull origin main

prune-images:
	@echo "Pruning old Docker images..."
	@docker image prune -f

deploy: 
	@echo "Deploying production services..."
	@$(MAKE) prod-up

prod-preflight:
	@[[ "$(SENTRY_RELEASE)" =~ ^[0-9a-f]{40}$$ ]] || (echo "SENTRY_RELEASE must be the full 40-character Git SHA" >&2; exit 1)
	@test -n "$(SENTRY_DSN)" || (echo "SENTRY_DSN is required" >&2; exit 1)
	@test -n "$(SENTRY_ORG)" || (echo "SENTRY_ORG is required" >&2; exit 1)
	@test -n "$(SENTRY_PROJECT)" || (echo "SENTRY_PROJECT is required" >&2; exit 1)
	@test -n "$${SENTRY_AUTH_TOKEN:-}" || test -s "$(SENTRY_AUTH_TOKEN_FILE)" || (echo "SENTRY_AUTH_TOKEN is required in the shell environment or $(SENTRY_AUTH_TOKEN_FILE)" >&2; exit 1)

prod-up: prod-preflight
	@echo "Starting production services..."
	@token="$${SENTRY_AUTH_TOKEN:-}"; \
	if [[ -z "$$token" ]]; then token="$$(tr -d '\r\n' < "$(SENTRY_AUTH_TOKEN_FILE)")"; fi; \
	SENTRY_AUTH_TOKEN="$$token" $(PROD_COMPOSE_CMD) up -d --build $(PROD_SERVICES)

prod-down:
	@echo "Stopping production services..."
	$(PROD_COMPOSE_CMD) down

prod-logs:
	$(PROD_COMPOSE_CMD) logs -f $(SERVICE)

up-api-docs:
	$(COMPOSE_CMD) up -d --build api-docs

up-phpmyadmin:
	$(COMPOSE_CMD) up -d --build phpmyadmin

up-rolz:
	$(COMPOSE_CMD) up -d --build rolz

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
	@echo "Starting frontend, backend, and API documentation watch services..."
	@echo "Starting MySQL and API documentation containers..."
	@$(COMPOSE_CMD) up -d mysql api-docs
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
		DATABASE_URL="$(WATCH_DATABASE_URL)" MYSQL_HOST=127.0.0.1 MYSQL_PORT=$(MYSQL_PORT) npm run server:dev & \
		backend_pid=$$!; \
		npm run dev -- --host 0.0.0.0 --port $(FRONTEND_PORT) --strictPort & \
		frontend_pid=$$!; \
		wait $$backend_pid $$frontend_pid
