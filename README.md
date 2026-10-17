# weather-activity-outlook

GraphQL service that scores the next 7 days for skiing, surfing, outdoor and indoor sightseeing in a given city, using Open-Meteo data. See [REQUIREMENTS.md](REQUIREMENTS.md), [DECISIONS.md](DECISIONS.md), [SCORING.md](SCORING.md) and [WORKLOG.md](WORKLOG.md).

`outlook(city, countryCode)` returns the location and, for each activity (skiing, surfing, outdoor and indoor sightseeing), a status (AVAILABLE, NOT_APPLICABLE or UNAVAILABLE) plus the next days' scores, ranks and reasons. Scoring rules are in [SCORING.md](SCORING.md).

## Project layout

```
src/
  index.ts          entrypoint: starts the HTTP server
  app.ts            builds the GraphQL Yoga app (used by index.ts and tests)
  config.ts         environment variables
  errors.ts         error classes with stable codes (BAD_USER_INPUT, LOCATION_NOT_FOUND, UPSTREAM_UNAVAILABLE)
  time.ts           Clock (injectable "now") and localDate(instant, timezone)
  graphql/          schema.ts (type definitions), resolvers.ts, errors.ts (maps errors to extensions.code)
  services/         business logic: LocationService, ForecastService, MarineService
  providers/        HttpClient and Open-Meteo providers
  repositories/     SQLite queries: LocationRepository, WeatherConditionsRepository, MarineConditionsRepository
  scoring/          one pure function per activity; thresholds in config
  db/               SQLite connection and schema (tables created on startup)
test/
  fixtures/         saved Open-Meteo responses
  unit/             one class at a time, with fakes
  integration/      real classes wired together; fetch is faked, SQLite is in-memory
  helpers/          fake fetch and fixture loader
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
| `OPEN_METEO_TIMEOUT_MS` | `5000` | Timeout for each Open-Meteo request |

## Try it

With the server running, open http://localhost:4000/graphql for GraphiQL, or:

```sh
curl -X POST localhost:4000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ outlook(city: \"Biarritz\") { location { name country } fetchedAt isStale activities { activity status reason days { date score rank reasons } } } }"}'
```

Errors carry a code in `extensions.code`: `BAD_USER_INPUT`, `LOCATION_NOT_FOUND`, `UPSTREAM_UNAVAILABLE`, or `INTERNAL_ERROR` (unexpected errors; details are logged on the server, not returned).

## How data is stored and refreshed

- Open-Meteo responses are stored in SQLite: one table for weather, one for marine data, one row per location per day.
- Data is refreshed on request when it's older than 3 hours. If Open-Meteo is down, data up to 48 hours old is served with `isStale: true`.
- City searches are saved too, so a known city still resolves while Open-Meteo is down.
- Scores are computed on each request, never stored, so scoring rules can change without refetching.

Details and reasoning: [DECISIONS.md](DECISIONS.md), points 4 and 5.

## Assumptions

- A city name resolves to the top geocoding match; `countryCode` steers it (e.g. Paris, US).
- The 7 days are today plus six, in the location's local timezone.
- Only weather and wave data count; opening hours, crowds and access don't.
- Thresholds in [SCORING.md](SCORING.md) are starting heuristics, not tuned values.
