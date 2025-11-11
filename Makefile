IMAGE ?= rolz-all
TAG ?= latest
CONTAINER ?= rolz-stack
DATA_VOLUME ?= rolz-mysql-data
ENV_FILE ?= .env
FRONTEND_PORT ?= 5173
BACKEND_PORT ?= 4000
MYSQL_PORT ?= 3306

ENV_FILE_FLAG := $(shell test -f $(ENV_FILE) && echo "--env-file $(ENV_FILE)")
PORT_FLAGS := -p $(FRONTEND_PORT):5173 -p $(BACKEND_PORT):4000 -p $(MYSQL_PORT):3306
VOLUME_FLAGS := -v $(DATA_VOLUME):/var/lib/mysql
RUN_FLAGS := $(PORT_FLAGS) $(VOLUME_FLAGS) $(ENV_FILE_FLAG)

.PHONY: build run up stop logs clean shell

build:
	docker build -t $(IMAGE):$(TAG) .

run:
	docker run --rm -it --name $(CONTAINER) $(RUN_FLAGS) $(IMAGE):$(TAG)

up:
	docker run -d --name $(CONTAINER) $(RUN_FLAGS) $(IMAGE):$(TAG)

stop:
	-docker stop $(CONTAINER)

logs:
	docker logs -f $(CONTAINER)

shell:
	docker exec -it $(CONTAINER) /bin/bash

clean: stop
	-docker rm $(CONTAINER)
	-docker volume rm $(DATA_VOLUME)
