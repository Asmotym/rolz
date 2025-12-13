FROM node:20-slim AS deps
WORKDIR /app
COPY package.json ./
# npm ci currently fails to install rollup's optional native binaries on arm64 builders;
# npm install works around https://github.com/npm/cli/issues/4828 until the bug is fixed.
RUN npm install

FROM deps AS build
COPY . .
RUN npm run build && npm run server:build

FROM node:20-slim AS runner
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends mariadb-client tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY .env ./.env
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src
COPY server ./server
COPY public ./public
COPY tsup.config.ts ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh

EXPOSE 5173 4000

ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["/app/docker/entrypoint.sh"]
