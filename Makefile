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
export FRONTEND_URL ?= http://localhost:5173
export VITE_BACKEND_URL ?= http://localhost:4000
export DATABASE_URL ?= mysql://rolz:rolz@localhost:3306/rolz
export DATABASE_SSL ?= false

ENV_FILE_FLAG := $(shell test -f $(ENV_FILE) && echo "--env-file $(ENV_FILE)")
COMPOSE_CMD := $(COMPOSE) -f $(COMPOSE_FILE) $(ENV_FILE_FLAG)

.PHONY: build run up stop logs clean shell down

build:
	$(COMPOSE_CMD) build $(SERVICE)

run:
	$(COMPOSE_CMD) up --build $(SERVICE)

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
