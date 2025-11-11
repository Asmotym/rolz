FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build && npm run server:build

FROM node:20-slim AS runner
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql postgresql-contrib tini \
    && rm -rf /var/lib/apt/lists/*

ENV PG_MAJOR=15 \
    PGDATA=/var/lib/postgresql/data \
    POSTGRES_USER=rolz \
    POSTGRES_PASSWORD=rolz \
    POSTGRES_DB=rolz \
    POSTGRES_PORT=5432 \
    DATABASE_URL=postgresql://rolz:rolz@localhost:5432/rolz \
    BACKEND_PORT=4000 \
    PORT=4000 \
    FRONTEND_PORT=5173 \
    FRONTEND_URL=http://localhost:5173 \
    VITE_BACKEND_URL=http://localhost:4000 \
    HOST=0.0.0.0 \
    NODE_ENV=production

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh

VOLUME ["/var/lib/postgresql/data"]

EXPOSE 5173 4000 5432

ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["/app/docker/entrypoint.sh"]
