# Rolz

Vue 3 + Vite front-end with a standalone Express API that manages rooms, Discord authentication, and MySQL-backed persistence.

## Requirements

- Node.js 18+
- MySQL connection string

## Setup

```bash
npm install
cp .env.example .env
```

Fill in the `.env` file with:

- `DATABASE_URL` – MySQL connection string (PlanetScale, RDS, local Docker, etc.)  
- `DATABASE_SSL` – Set to `true` if the connection requires SSL  
- `BACKEND_PORT` – Port for the API server (default `4000`)  
- `FRONTEND_URL` – Comma-separated origins that should be allowed to call the API  
- `VITE_BACKEND_URL` – Base URL the Vue app uses when talking to the API

## Development

- `npm run dev` – Start the Vite dev server.
- `npm run server:dev` – Start the Express API with live TypeScript transpilation (`tsx`).

Run both commands in separate terminals for a full-stack dev experience.

## Production Builds

- `npm run build` – Type-check and bundle the Vue client (output in `dist/`).
- `npm run server:build` – Type-check and compile the Express server to `dist-server/`.
- `npm run server:start` – Run the compiled server (`dist-server/index.js`).

Deploy the static assets (e.g. Netlify) and host the Express server anywhere that can expose Node.js + access to the database.

## Docker (all-in-one)

To run the frontend, backend, and an embedded MySQL instance inside a single container:

```bash
docker build -t rolz-all .
docker run --rm -it \
  -p 5173:5173 \
  -p 4000:4000 \
  -p 3306:3306 \
  rolz-all
```

Environment variables such as `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `BACKEND_PORT`, and `FRONTEND_PORT` can be overridden at `docker run` time. Set `DATABASE_SSL=false` for the bundled MySQL instance; hosted providers should use `true`. Persistent database storage can be mapped by binding `/var/lib/mysql` to a local volume.

### Live reload inside Docker

`docker compose up --build` now gives you a full dev stack without rebuilding the image for every edit. The compose file bind-mounts the source tree and sets `ROLZ_DEV_MODE=true` so the entrypoint runs `npm run server:dev` and `npm run dev -- --host 0.0.0.0`. Any change under `server/`, `src/`, or the Vite/TypeScript configs is picked up instantly. If you want the previous production-style behavior, set `ROLZ_DEV_MODE=false` (or unset it) before starting Compose.

### Make targets

The included `Makefile` wraps common Docker commands:

- `make build` – build (or rebuild) the image.
- `make run` – run the stack interactively with logs in the foreground.
- `make up` – run the stack in the background (detached).
- `make stop` – stop the detached container.
- `make logs` – follow container logs.

Variables such as `IMAGE`, `CONTAINER`, or the exposed ports (`FRONTEND_PORT`, `BACKEND_PORT`, `MYSQL_PORT`) can be overridden inline, e.g. `make run BACKEND_PORT=5000`. The Makefile automatically mounts a persistent Docker volume for MySQL data and, if a `.env` file exists, passes it through to the container.
