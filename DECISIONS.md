# Design Decisions

## 1: Skiing uses the town's own forecast
Problem: the forecast is for the town, not the mountain. 

Options I looked at:
- Use the town forecast as it is.
- For mountain towns, also fetch the forecast higher up. But how much higher? Any number would be a guess.
- Keep a list of real ski resorts. Too much work, and it doesn't scale.

Picked: town forecast. It keeps things simple.

## 2: Scoring is rule-based and computed on read
I'll save the weather data, but calculate the scores fresh on each request.

Why: I will keep changing the scoring rules while building. If scores were saved, every change would mean recalculating or refetching everything. Calculating scores is cheap anyway.

Each activity gets a simple rule-based function: weather in, score and reasons out. The rules for each activity are in [SCORING.md](SCORING.md).


## 3: Data fetched from Open-Meteo
- Geocoding: `name`, `count=5`, optional `countryCode`; take the top result. In v1, `countryCode` is the only way to steer the choice (e.g. Paris, US). The response includes `country` and `admin1` so users can see which place was picked (Aurangabad returns Maharashtra, not Bihar).
- Forecast (daily): temperature_2m_max, temperature_2m_min, precipitation_sum, precipitation_probability_max, snowfall_sum, wind_speed_10m_max, weather_code, cloud_cover_mean. Hourly: snow_depth, reduced to a daily max per local date (null hours ignored; a day with no values is null) and converted from m to cm, to match snowfall_sum.
- Marine (daily): wave_height_max, wave_period_max.
- All requests use `timezone=auto` and `forecast_days=7`. The API's `daily.time` gives the dates that get saved.
- Every read (fresh or stale) drops days before the location's local today. Even data under 3 hours old can span midnight, so the server always computes today from the location's timezone (Point 13).
- A response whose daily arrays don't each have one value per date in `daily.time` is treated as an unexpected shape (Point 9). Any number of days is accepted.

## 4: Storage is SQLite with normalized daily rows
SQLite because reviewers can run it with no setup. For production we can use Postgres.

First idea was to save locations by latitude and longitude. But the weather APIs move the point to the nearest grid cell (Biarritz moved about 6–7 km), so coordinates aren't stable. The geocoding id is, so I'm using that.

Weather and marine are fetched separately, so they're stored separately: one table each, with one row per location per local date. `daily_marine_conditions` holds the marine fields and `daily_weather_conditions` the forecast fields. On refresh I overwrite those rows, so no duplicates.

Each also has its own fetch time: two columns on locations, `weather_fetched_at` and `marine_fetched_at`, stored as ISO 8601 UTC strings.

Details:
- Columns use short names: `temp_max`, `temp_min`, `precipitation`, `precipitation_probability`, `snowfall`, `wind_speed_max`, `weather_code`, `cloud_cover`, `snow_depth_max` (weather) and `wave_height_max`, `wave_period_max` (marine). Values are in the units the API returns, except `snow_depth_max`, which is stored in cm (the API gives m).
- All condition values are nullable, and nulls are stored as null (Point 9).
- In `locations`, `id`, `name`, `latitude` and `longitude` are required; `region` (the API's `admin1`), `country`, `country_code`, `timezone` and `elevation` are nullable because the geocoder can omit them.
- Rows for dates that have dropped out of the window are kept. Reads filter them out, so there's nothing to clean up.
- Saving a location again updates its geocoding fields but keeps the fetch times.
- Tables are created with `CREATE TABLE IF NOT EXISTS` when the database opens; there are no migrations yet. An existing table isn't changed, so after a schema change, delete the local `data/` folder.

## 5: Refresh is lazy with a TTL
First idea was a background job that refreshes forecasts regularly. But for which cities? People can type any city, so there is no fixed list.

Picked: refresh when someone asks, if the data is older than 3 hours. 3 hours is a starting point.

Downside: the first request for a new city is slower. That's fine.

If Open-Meteo is down, I'll show the old data and clearly say it's old, rather than showing an error. Old data is only served up to 48 hours after it was fetched; after that it's an error. 48 hours is a starting point.

Both limits are strict: data is fresh if it's less than 3 hours old, and can be served as stale if it's less than 48 hours old.

Geocoding is also Open-Meteo, so I also save which place id each search (name plus `countryCode`) resolved to. Without that, I couldn't find the saved forecast while Open-Meteo is down.


## 6: Results grouped by activity, then days
I first thought of it as days → activities: "what should I do on Tuesday?" After discussing it, I switched to activity → days: "when should I go surfing?"

Why I switched:
- The assignment brief says "how good the next 7 days will be for each activity," which reads as activity -> days.
- Comparing a skiing score with an indoor score doesn't really make sense. Comparing days for the same activity does.
- People usually pick the activity first, then the day.

Each day gets a score from 0 to 100 and a rank. If an activity is impossible somewhere (surfing in Delhi), it says "not applicable" instead of giving a score.

## 7: Skiing is never "not applicable" in v1
The requirements say an impossible activity should be "not applicable". For skiing I'm not doing that in v1.

Why: the weather data can't tell an off-season ski town (Gulmarg in October, no snow) from a place that never snows (Mumbai). Both just show zero snow. Any N/A rule would need something other than weather.

Instead, skiing always gets a score, and the reason text explains a low one (e.g. no snow forecast, and the forecast is for the town's elevation, not the slopes; see Point 1).

## 8: Indoor sightseeing is the inverse of outdoor
Indoor sightseeing is possible everywhere, so it's never "not applicable". It's most useful on days that are bad for being outside.

Downside: indoor's best day is always outdoor's worst, so it adds no new information. That's fine for v1.

## 9: Failure handling
- City not found: return a `LOCATION_NOT_FOUND` error and don't save the miss. Checked with a nonsense name: Open-Meteo returns HTTP 200 with no `results` key at all, not an empty list (`test/fixtures/geo-not-found.json`).
- Error payloads: check every response for `"error": true`, not just the HTTP status. Treat it as a failure and never save it.
- Any Open-Meteo failure (error payload, bad HTTP status, timeout after 5 seconds, unreachable, or a response that doesn't match the expected shape, checked with zod) is an `UPSTREAM_UNAVAILABLE` error.
- Partly null data: if all wave values are null, surfing is "not applicable". If only some days or fields are null, that day gets no score with the reason "missing data", only for the activities that need that field. Nulls are stored as null, never 0.
- One call fails: weather and marine are independent. If one fails, its activities use old data if it's under 48 hours old (Point 5), or show "unavailable". The other activities aren't affected. The response returns the oldest fetch time used, with `isStale` true if any of the data is old.
- Exception for surfing: surfing needs marine and weather data. If the weather data is missing (a null field, or the forecast unavailable), surfing is still scored on waves alone, with the reason "wind data unavailable", instead of getting no score. Waves are what matters most for surfing. The trade-off: the wind penalty and the thunderstorm check are skipped, so a surf score can appear on a day that may have a storm.

## 10: Test fixtures
Fixtures in `test/fixtures/` are fetched with the exact Point 3 requests, and each file is checked for an `error` field before committing. The spike responses in `docs/spike/responses/` used other variable sets, so they aren't used for tests.

Exception: `geo-paris.json` and `geo-aurangabad.json` were copied from the spike. The geocoding request there looks the same as Point 3 (5 results, no `countryCode`), but the request URL wasn't recorded.

## 11: Location lookup
- The search is normalized before anything else: lower-case, trimmed, repeated spaces collapsed. `countryCode` is upper-cased. So "Paris", " PARIS " and "paris" are one search.
- Each search is saved in `geocode_queries` with the place id it resolved to (Point 5). The key is (query, country code), with `''` when no country code was given, so "Queenstown" and "Queenstown, NZ" are separate searches.
- A saved search is answered from the database with no network call.
- Input is checked before calling Open-Meteo, because the API answers bad input with an empty result that would look like "not found". A name under 2 characters, or a `countryCode` that isn't 2 letters, is a `BAD_USER_INPUT` error.

## 12: API errors
- Every error has a code in `extensions.code`: `BAD_USER_INPUT`, `LOCATION_NOT_FOUND` or `UPSTREAM_UNAVAILABLE`.
- Any other error returns a generic `INTERNAL_ERROR` message. The details are logged on the server, not returned.
- In the GraphQL `Location` type, `region`, `country`, `countryCode` and `timezone` are nullable, because the geocoder can omit them.
- The `health` query stays next to `outlook`, to check the server is up and the database responds.

## 13: Timezone for "today"
"Today" (Point 3) uses the location's timezone, in this order:
1. The timezone saved on the location (from the geocoder).
2. If there isn't one, the timezone the forecast or marine response returns (`timezone=auto`), whichever is fetched first. It's saved on the location, so it's only needed once.
3. UTC, only if neither exists: a location with no timezone whose forecast and marine fetches have never succeeded. This can be off by a day for places far from UTC.

A UTC offset isn't enough on its own, because it changes with daylight saving; the IANA name (e.g. `Europe/Paris`) is needed.