import type { Statement } from 'better-sqlite3';
import type { Db } from '../db/connection.js';
import type { Location } from '../providers/GeocodingProvider.js';

interface LocationRow {
    id: number;
    name: string;
    region: string | null;
    country: string | null;
    country_code: string | null;
    latitude: number;
    longitude: number;
    timezone: string | null;
    elevation: number | null;
}

export interface QueryKey {
    query: string;
    countryCode: string;
}

export class LocationRepository {
    private readonly findByQueryStmt: Statement<[string, string], LocationRow>;
    private readonly upsertLocationStmt: Statement<[LocationRow]>;
    private readonly saveQueryStmt: Statement<[string, string, number]>;

    constructor(private readonly db: Db) {
        this.findByQueryStmt = db.prepare(`
            SELECT l.id, l.name, l.region, l.country, l.country_code,
                   l.latitude, l.longitude, l.timezone, l.elevation
            FROM geocode_queries q
            JOIN locations l ON l.id = q.location_id
            WHERE q.query = ? AND q.country_code = ?
        `);

        this.upsertLocationStmt = db.prepare(`
            INSERT INTO locations
                (id, name, region, country, country_code, latitude, longitude, timezone, elevation)
            VALUES
                (@id, @name, @region, @country, @country_code, @latitude, @longitude, @timezone, @elevation)
            ON CONFLICT (id) DO UPDATE SET
                name = excluded.name,
                region = excluded.region,
                country = excluded.country,
                country_code = excluded.country_code,
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                timezone = COALESCE(excluded.timezone, timezone),
                elevation = excluded.elevation
        `);

        this.saveQueryStmt = db.prepare(`
            INSERT INTO geocode_queries (query, country_code, location_id)
            VALUES (?, ?, ?)
            ON CONFLICT (query, country_code) DO UPDATE SET location_id = excluded.location_id
        `);
    }

    findByQuery({ query, countryCode }: QueryKey): Location | undefined {
        const row = this.findByQueryStmt.get(query, countryCode);
        return row && LocationRepository.toLocation(row);
    }

    save(location: Location, { query, countryCode }: QueryKey): void {
        this.db.transaction(() => {
            this.upsertLocationStmt.run(LocationRepository.toRow(location));
            this.saveQueryStmt.run(query, countryCode, location.id);
        })();
    }

    private static toRow(location: Location): LocationRow {
        return {
            id: location.id,
            name: location.name,
            region: location.region,
            country: location.country,
            country_code: location.countryCode,
            latitude: location.latitude,
            longitude: location.longitude,
            timezone: location.timezone,
            elevation: location.elevation,
        };
    }

    private static toLocation(row: LocationRow): Location {
        return {
            id: row.id,
            name: row.name,
            region: row.region,
            country: row.country,
            countryCode: row.country_code,
            latitude: row.latitude,
            longitude: row.longitude,
            timezone: row.timezone,
            elevation: row.elevation,
        };
    }
}
