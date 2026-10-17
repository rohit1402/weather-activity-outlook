# Scoring

Each day gets a score from 0 to 100 for each activity. Higher is better.

## General rules

- Scores are kept between 0 and 100, then rounded to a whole number.
- A range like "1–1.5 m" includes 1 and excludes 1.5. "Over 40 km/h" means more than 40.
- Tiers don't add up: wind over 60 km/h is −40, not −20 − 40.
- "Temperature" means the day's maximum.
- Every rule that applies adds a reason, e.g. "+30 fresh snow (8 cm)".
- If a **required** value is missing, the day gets no score: "missing data".
- If an **optional** value (anything not listed as required) is missing, that rule is skipped: e.g. "wind data unavailable".
- Thunderstorm = weather code 95, 96 or 99. Fog = 45 or 48.

**Rain** means precipitation minus the melted snow: `rain = precipitation − snowfall ÷ 0.7` (never below 0).
If the chance of rain is under 30 %, rain counts as 0. If the chance is unknown, rain counts.

## Skiing

Required: snowfall, temperature.

- Thunderstorm -> 0.
- No snowfall and less than 10 cm of snow on the ground → 0, "no snow forecast at town elevation".
- Snow on the ground (10 cm or more): +40
- Fresh snow 1–20 cm: +30. 20 cm or more: +15 (poor visibility). Under 1 cm: nothing.
- Temperature 0 °C or below: +20. Above 0 and under 3 °C: +10. 3 °C or above: −20.
- Rain over 1 mm: −30
- Wind over 40 km/h: −20. Over 60 km/h: −40.

The best ski day scores 90. Skiing is never "not applicable".

## Surfing

- No wave data at all → "not applicable", "no marine data, likely inland".
- Wave height: under 0.5 m: 10 · 0.5–1 m: 40 · 1–1.5 m: 65 · 1.5–2.5 m: 80 · 2.5–3.5 m: 60 · 3.5 m or more: 20 (dangerous)
- Wave period 10 s or more: +20. 7–10 s: +10. No bonus for waves of 3.5 m or more.
- Wind over 30 km/h: −20
- Thunderstorm → 0.

If weather data is missing, surfing is scored on waves only: "wind data unavailable".

## Outdoor sightseeing

Required: precipitation, temperature. Start at 100.

- Rain 1–5 mm: −20. 5 mm or more: −40.
- Snowfall over 1 cm: −20
- Temperature below 15 °C: −3 per degree. Above 28 °C: −4 per degree. At most −40.
- Cloud cover over 80 %: −10
- Wind over 30 km/h: −15. Over 50 km/h: −30.
- Thunderstorm: −30. Fog: −5.

## Indoor sightseeing

`indoor = 40 + 0.6 × (100 − outdoor)`

Always between 40 and 100, and never "not applicable". If outdoor has "missing data", so does indoor.

## Example

A wet day: 3 mm of rain, 12 °C, 85 % cloud, wind 35 km/h.
Outdoor: 100 − 20 (rain) − 9 (3° below 15) − 10 (cloud) − 15 (wind) = **46**. Indoor: 40 + 0.6 × 54 = 72.4, rounded to **72**.
