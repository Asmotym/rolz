# Rolz

Vue 3 + Vite front-end with a standalone Express API that manages rooms, Discord authentication, and Neon-backed persistence.

## Requirements

- Node.js 18+
- PostgreSQL/Neon connection string

## Setup

```bash
npm install
cp .env.example .env
```

Fill in the `.env` file with:

- `DATABASE_URL` – PostgreSQL connection string (works for Neon or local Docker)  
- `DATABASE_SSL` – Set to `true` if the connection requires SSL (e.g., Neon)  
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

To run the frontend, backend, and an embedded PostgreSQL instance inside a single container:

```bash
docker build -t rolz-all .
docker run --rm -it \
  -p 5173:5173 \
  -p 4000:4000 \
  -p 5432:5432 \
  rolz-all
```

Environment variables such as `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `BACKEND_PORT`, and `FRONTEND_PORT` can be overridden at `docker run` time. Set `DATABASE_SSL=false` for the bundled PostgreSQL instance; external providers like Neon should use `true`. Persistent database storage can be mapped by binding `/var/lib/postgresql/data` to a local volume.

### Make targets

The included `Makefile` wraps common Docker commands:

- `make build` – build (or rebuild) the image.
- `make run` – run the stack interactively with logs in the foreground.
- `make up` – run the stack in the background (detached).
- `make stop` – stop the detached container.
- `make logs` – follow container logs.

Variables such as `IMAGE`, `CONTAINER`, or the exposed ports (`FRONTEND_PORT`, `BACKEND_PORT`, `POSTGRES_PORT`) can be overridden inline, e.g. `make run BACKEND_PORT=5000`. The Makefile automatically mounts a persistent Docker volume for PostgreSQL data and, if a `.env` file exists, passes it through to the container.
