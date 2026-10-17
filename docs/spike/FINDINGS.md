# Findings from the Open-Meteo spike

- Ski towns show no snow, because the forecast is for the town, not the mountain. Zermatt town gets rain during a storm while a nearby grid cell at 3,800 m (about 3 km away) gets snow. Decision: keep it simple, use the town forecast and document this limitation (D1).
- Inland places return empty wave data. Delhi's marine response isn't an error; all the values are just null. I'll use this to detect "surfing not applicable."
- Coastal doesn't mean surfable. Mumbai has wave data, but the waves are tiny (0.3–0.4 m), so it gets a low surf score, not "not applicable."
- The three surf spots give a natural scale. Mumbai is poor (0.3 m), Kovalam decent (about 1.2 m), Biarritz good (up to 2.7 m with long periods).
- No snow means a low score, not "not applicable." The data can't tell an off-season ski town (Gulmarg) from a place that never snows (Mumbai).
- `sunshine_duration` can't be trusted. Gulmarg shows about 10.7 hours of sunshine (close to the full day length) even on an overcast day and on a day with a 99% rain chance. `cloud_cover_mean` looks more plausible, but it isn't verified against observed weather and my default requests don't include it yet, so I'll add it.
- The daily `weather_code` reflects the most severe weather of the day, so it overstates bad weather. Brief morning fog gives code 45 even if the rest of the day is clear. I won't let it dominate scoring; precipitation and cloud cover will carry more weight.
- Units are mixed. Snow depth comes in metres, snowfall in cm, sunshine in seconds. I'll convert everything to one consistent set when saving the data.
- `timezone=auto` works. Dates come back as the local calendar, even in Queenstown (UTC+13), so I'll use the dates from the API rather than calculating "today" myself.
- Forecasts change over time. Two fetches for the same Zermatt point gave 9.67 mm and 6.10 mm of rain for the 21st (the order isn't known, and a different variable set may also play a part). This is why stored data needs refreshing and a "fetched at" time.
- Rain chance and rain amount can disagree. Zermatt on the 18th had a 73% chance and a "rain showers" weather code (80), but 0.0 mm of rain. I need to decide which one matters more when scoring.
- Geocoding picks sensible top results (Paris, France; Aurangabad, Maharashtra). I'll return admin1 so users can see which place was picked, and store places by id, because the weather APIs snap to grid cells several kilometres away (about 6–7 km for Biarritz's marine data, about 8 km for Gulmarg with an elevation override).