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

- `DATABASE_URL` – Neon/PostgreSQL connection string  
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
