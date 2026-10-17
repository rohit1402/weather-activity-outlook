# Scoring

Each day gets a score from 0 to 100 for each activity. Higher is better.

All numbers are in `src/scoring/config.ts`.

## Applies to all activities

- Scores are clamped to 0–100, then rounded to a whole number.
- If any field a scorer needs is null, that day gets no score and the reason "Missing data". (Exception: surfing, below.)
- Ranges include the lower bound and exclude the upper (1.0 m of waves falls in 1–1.5 m).
- Rain = max(0, precipitation - snowfall ÷ 0.7), so snow isn't counted as rain.
- Thunderstorm = weather code 95–99.
- Every rule that applies adds a reason in plain English, e.g. "8 cm of fresh snow" or "Strong wind (35 km/h)". Reasons don't show points.

## Skiing (start at 0)

- No day in the week has snow → not applicable, "Not enough snow forecast this week". A day with unknown snow data counts as possibly snowy.
- Snowfall under 1 cm and snow on the ground under 10 cm → 0, "Not enough snow"
- Snow on the ground of 10 cm or more: +50
- Fresh snowfall of 1 cm or more: +30
- Max temp 0 °C or below: +20; above 3 °C: -20 (slush)
- Rain of 1 mm or more: -30
- Thunderstorm → 0

## Surfing (score from wave height)

- All wave values null for the whole week → not applicable, "No marine data, likely inland"
- Wave height: under 0.5 m: 10 · 0.5–1 m: 40 · 1–1.5 m: 60 · 1.5–2.5 m: 80 · 2.5–3.5 m: 60 · 3.5 m or more: 20
- Wave period of 10 s or more: +20 (not for waves of 3.5 m or more)
- Wind of 30 km/h or more: -20
- Thunderstorm → 0
- Forecast missing: score on waves only, with the reason "No wind or storm forecast available"

## Outdoor sightseeing (start at 100)

- Rain 1–5 mm: -20; 5 mm or more: -40
- Snowfall of 1 cm or more: -20
- Max temp outside 15–28 °C: -3 per degree outside the range, up to -40
- Wind of 30 km/h or more: -20
- Thunderstorm: -30

## Indoor sightseeing

- 40 + 0.6 × (100 - outdoor score), so always between 40 and 100
- If the outdoor score is null, indoor is null too ("Missing data")
- The reason names what's wrong outside, e.g. "Expect rain (3 mm) and cold weather (max 12 °C) outside", or "Great weather outside, but indoor sightseeing is still an option"

## Example

A wet day: 3 mm of rain, max 12 °C, wind 35 km/h.
Outdoor: 100 - 20 (rain) - 9 (3° below 15) - 20 (wind) = **51**. Indoor: 40 + 0.6 × 49 = 69.4, rounded to **69**.
