# Weather Activity Outlook

## 1. Requirements
- Users should be able to provide a city or town and retrieve best days for following activities for next 7 days
    - Skiing
    - Surfing
    - Outdoor Sightseeing
    - Indoor Sightseeing
- Service should rank each day for each activity based on relevant weather data.
- For each day, there should be a score 0-100 where higher score means more suitable activity.
- If an activity isn't possible at a location, it should be marked not applicable with a reason instead of a score.
- Weather data should be retrieved from Open-Meteo and persisted.
- Service should expose a graphql API for this functionality.
- Service should be able to handle unknown locations, external API failures and missing data gracefully with proper message.


## 2. Assumptions
- City or town input will be provided as a string and resolved to geographical coordinates using an external geocoding API.
- The forecast window will include today and the following six calendar days, making a 7 day window.
- Service should make suggestions based on provided city/town local timezone
- Non-weather factors such as opening hours, crowds and access are not considered.
- Forecasts will be refreshed on demand: when a location is requested and its stored data is older than a TTL.
- Existing persisted forecasts may be served when a refresh fails, provided their age is made clear.


## 3. Out of Scope
- Building a frontend or mobile application.
- User accounts, authentication, and authorization.