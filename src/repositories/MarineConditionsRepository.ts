import type { Statement } from 'better-sqlite3';
import type { Db } from '../db/connection.js';
import type { FetchState } from './FetchState.js';
import type { MarineDay } from '../providers/MarineProvider.js';

interface MarineStateRow {
    marine_fetched_at: string | null;
    timezone: string | null;
}

interface MarineDayRow {
    date: string;
    wave_height_max: number | null;
    wave_period_max: number | null;
}

export class MarineConditionsRepository {
    private readonly marineStateStmt: Statement<[number], MarineStateRow>;
    private readonly marineDaysStmt: Statement<[number, string], MarineDayRow>;
    private readonly upsertMarineDayStmt: Statement<[number, string, number | null, number | null]>;
    private readonly markMarineFetchedStmt: Statement<[string, string, number]>;

    constructor(private readonly db: Db) {
        this.marineStateStmt = db.prepare(
            'SELECT marine_fetched_at, timezone FROM locations WHERE id = ?',
        );

        this.marineDaysStmt = db.prepare(`
            SELECT date, wave_height_max, wave_period_max
            FROM daily_marine_conditions
            WHERE location_id = ? AND date >= ?
            ORDER BY date
        `);

        this.upsertMarineDayStmt = db.prepare(`
            INSERT INTO daily_marine_conditions (location_id, date, wave_height_max, wave_period_max)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (location_id, date) DO UPDATE SET
                wave_height_max = excluded.wave_height_max,
                wave_period_max = excluded.wave_period_max
        `);

        this.markMarineFetchedStmt = db.prepare(`
            UPDATE locations
            SET marine_fetched_at = ?, timezone = COALESCE(timezone, ?)
            WHERE id = ?
        `);
    }

    getMarineState(locationId: number): FetchState {
        const row = this.marineStateStmt.get(locationId);
        return {
            fetchedAt: row?.marine_fetched_at ? new Date(row.marine_fetched_at) : null,
            timezone: row?.timezone ?? null,
        };
    }

    findMarineDays(locationId: number, fromDate: string): MarineDay[] {
        return this.marineDaysStmt.all(locationId, fromDate).map((row) => ({
            date: row.date,
            waveHeightMax: row.wave_height_max,
            wavePeriodMax: row.wave_period_max,
        }));
    }

    saveMarine(locationId: number, days: MarineDay[], fetchedAt: Date, timezone: string): void {
        this.db.transaction(() => {
            for (const day of days) {
                this.upsertMarineDayStmt.run(
                    locationId,
                    day.date,
                    day.waveHeightMax,
                    day.wavePeriodMax,
                );
            }
            this.markMarineFetchedStmt.run(fetchedAt.toISOString(), timezone, locationId);
        })();
    }
}
