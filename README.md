# weather-activity-outlook

GraphQL service that scores the next 7 days for skiing, surfing, outdoor and indoor sightseeing in a given city, using Open-Meteo data. See [REQUIREMENTS.md](REQUIREMENTS.md), [DECISIONS.md](DECISIONS.md) and [WORKLOG.md](WORKLOG.md).

Status: the API has a `health` query. Location lookup, weather ingestion and scoring aren't built yet.

## Project layout

```
src/
  index.ts          entrypoint: starts the HTTP server
  app.ts            builds the GraphQL Yoga app (used by index.ts and tests)
  config.ts         environment variables
  graphql/          schema.ts (type definitions), resolvers.ts
  services/         business logic (empty for now)
  providers/        Open-Meteo HTTP clients (empty for now)
  repositories/     SQLite queries (empty for now)
  scoring/          activity scoring rules (empty for now)
  db/               SQLite connection
test/
  fixtures/         saved Open-Meteo responses
  unit/             no I/O
  integration/      through the GraphQL app with a real (in-memory) SQLite
```

## Setup

Requires Node 22 or newer (`.nvmrc` pins 24).

```sh
nvm use          # or install Node 24 another way
npm ci
cp .env.example .env   # optional; defaults work without it
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the server with reload on change (tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server from `dist/` |
| `npm test` | Run all tests once (Vitest); `npm run test:watch` to watch |
| `npm run test:unit` / `test:integration` | Run one test folder |
| `npm run typecheck` | Type-check `src/` and `test/` |
| `npm run lint` | ESLint |
| `npm run format` / `format:check` | Prettier |

## Configuration

| Variable | Default | |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `DATABASE_PATH` | `data/weather.db` | SQLite file; the folder is created if missing |
| `OPEN_METEO_GEOCODING_URL` | `https://geocoding-api.open-meteo.com/v1/search` | Geocoding endpoint |
| `OPEN_METEO_FORECAST_URL` | `https://api.open-meteo.com/v1/forecast` | Weather forecast endpoint |
| `OPEN_METEO_MARINE_URL` | `https://marine-api.open-meteo.com/v1/marine` | Marine (wave) endpoint |

## Try it

With the server running, open http://localhost:4000/graphql for GraphiQL, or:

```sh
curl -X POST localhost:4000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ health { status database } }"}'
# {"data":{"health":{"status":"ok","database":true}}}
```
