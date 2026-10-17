export const SCHEMA = `
    CREATE TABLE IF NOT EXISTS locations (
        id                 INTEGER PRIMARY KEY,
        name               TEXT    NOT NULL,
        region             TEXT,
        country            TEXT,
        country_code       TEXT,
        latitude           REAL    NOT NULL,
        longitude          REAL    NOT NULL,
        timezone           TEXT,
        elevation          REAL,
        weather_fetched_at TEXT,
        marine_fetched_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS geocode_queries (
        query        TEXT    NOT NULL,
        country_code TEXT    NOT NULL DEFAULT '',
        location_id  INTEGER NOT NULL REFERENCES locations (id),
        PRIMARY KEY (query, country_code)
    );

    CREATE TABLE IF NOT EXISTS daily_marine_conditions (
        location_id     INTEGER NOT NULL REFERENCES locations (id),
        date            TEXT    NOT NULL,
        wave_height_max REAL,
        wave_period_max REAL,
        PRIMARY KEY (location_id, date)
    );

    CREATE TABLE IF NOT EXISTS daily_weather_conditions (
        location_id               INTEGER NOT NULL REFERENCES locations (id),
        date                      TEXT    NOT NULL,
        temp_max                  REAL,
        temp_min                  REAL,
        precipitation             REAL,
        precipitation_probability REAL,
        snowfall                  REAL,
        wind_speed_max            REAL,
        weather_code              INTEGER,
        cloud_cover               REAL,
        snow_depth_max            REAL,
        PRIMARY KEY (location_id, date)
    );
`;
