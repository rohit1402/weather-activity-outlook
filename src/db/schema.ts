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
`;
