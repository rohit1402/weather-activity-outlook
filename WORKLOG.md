# Work Log

## 2026-10-17
- Open-Meteo data spike: collected raw responses (`docs/spike/responses/`) and wrote findings (`docs/spike/FINDINGS.md`).
- Wrote `REQUIREMENTS.md` and `DECISIONS.md`; reviewed decisions and added failure handling (Point 9) and fixtures (Point 10).
- Fetched test fixtures with the exact Point 3 requests (`test/fixtures/`).
- Set up the Node 24 + TypeScript + GraphQL Yoga + SQLite skeleton with a `health` query.
- Reorganised `src/` and `test/` into the folder layout described in the README.
- Implemented location resolution: Open-Meteo geocoding (validated with zod) saved to SQLite (`locations`, `geocode_queries`); saved queries resolve without a network call.
- Added the GraphQL `outlook(city, countryCode)` query returning the location, with error codes in `extensions.code` (BAD_USER_INPUT, LOCATION_NOT_FOUND, UPSTREAM_UNAVAILABLE, INTERNAL_ERROR).
- Added the marine data layer: `daily_marine_conditions` table (Point 3 marine fields), `OpenMeteoMarineProvider`, and `MarineService.getMarineConditions` with the 3-hour refresh and 48-hour stale rules. Not exposed through GraphQL yet.
- Added the forecast data layer: `daily_weather_conditions` table, `OpenMeteoForecastProvider` (hourly snow_depth reduced to a daily max in cm) and `ForecastService.getForecastConditions` with the same refresh rules as marine. Not exposed through GraphQL yet.
- Refactored the marine and forecast services: the refresh rules (3-hour TTL, 48-hour stale fallback, dropping past days by local timezone) now live in one generic `CachedDailyConditions<TDay>` class, and both services are thin wrappers around it. Shared types `DailyForecast<TDay>`, `DailyConditions<TDay>` and `FetchState` replace the duplicated marine/weather ones. Repositories and providers were left as they are.
- Decided the scoring rules and moved them from `DECISIONS.md` Point 2 into `SCORING.md`; recorded the surfing waves-only exception in Point 9.
- Added the four scorers as pure functions in `src/scoring/` (skiing, surfing, outdoor, indoor), with all thresholds in `config.ts` and shared helpers (rain, clamp, ranges, thunderstorm, required fields, ranking). Every rule adds its own reason. Fetched `test/fixtures/marine-mumbai.json` for the fixture tests.
- Simplified the scoring rules for v1: 3–5 factors per activity (dropped ski wind, outdoor fog and cloud cover, the rain-chance rule and the finer tiers), and one missing-data rule: any null field a scorer needs gives "missing data". A perfect ski day now scores 100. Not wired into GraphQL yet.
- Wired the scorers into the GraphQL `outlook` query: `fetchedAt`, `isStale` and `activities` (status AVAILABLE / NOT_APPLICABLE / UNAVAILABLE, days with score, rank and reasons). A weather or marine failure only makes its own activities UNAVAILABLE (Point 9); `OutlookService` combines the sources.
- Rewrote every scoring reason as plain English that states facts, with no points, codes or semicolons (e.g. "8 cm of fresh snow", "Strong wind (38 km/h) makes waves choppy"). Indoor lists what's wrong outside, e.g. "Expect rain (3 mm) and cold weather (max 12 °C) outside", or "Great weather outside, but indoor sightseeing is still an option".
- Skiing is now "not applicable" in a week with no snow ("Not enough snow forecast this week"). If some days have snow, the snowless days score 0 with "Not enough snow". Rewrote `DECISIONS.md` Point 7, which used to say skiing is never "not applicable".
- Weather and marine failures are now logged with `console.warn`: in `OutlookService` when an activity becomes UNAVAILABLE, and in `CachedDailyConditions` when stale data is served instead. Each failure is logged once. Before this, an outage only showed up in the API response.
- Rewrote `DECISIONS.md` Point 9 so it no longer contradicts itself: only a geocoding failure fails the request with `UPSTREAM_UNAVAILABLE`. A weather or marine failure still returns a response, with that source's activities UNAVAILABLE (or every activity, if both fail).
- Fixed the location timezone being wiped: saving a location again no longer clears a timezone that the forecast or marine response filled in, when the geocoder leaves it out.
- Simplified the scorer inputs: each scorer now takes only the data it reads (`scoreSkiing(weather)`, `scoreOutdoor(weather)`, `scoreSurfing(marine, weather or null)`). Removed `DayConditions` and the marine join for weather activities, and `requireFields` no longer accepts null.
- Removed unused options in `surfing.ts` (`surfingApplicability` only takes real marine days, and the `SurfingApplicability` alias is gone), and renamed the `Required` helper type to `NonNullFields` so it no longer hides TypeScript's built-in `Required`.
- Kept the dangerous-wave cutoff in one place: the 3.5 m wave tier is flagged `dangerous`, and the period-bonus rule reads that flag instead of a separate `SURFING.dangerousWaveM` constant.
