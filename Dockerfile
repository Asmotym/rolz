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
    && apt-get install -y --no-install-recommends mariadb-server mariadb-client tini \
    && rm -rf /var/lib/apt/lists/*

ENV MYSQL_DATA_DIR=/var/lib/mysql \
    MYSQL_USER=rolz \
    MYSQL_PASSWORD=rolz \
    MYSQL_DATABASE=rolz \
    MYSQL_PORT=3306 \
    DATABASE_URL=mysql://rolz:rolz@localhost:3306/rolz \
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
COPY index.html ./
COPY src ./src
COPY server ./server
COPY public ./public
COPY tsup.config.ts ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh

VOLUME ["/var/lib/mysql"]

EXPOSE 5173 4000 3306

ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["/app/docker/entrypoint.sh"]
