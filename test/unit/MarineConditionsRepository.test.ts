import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../../src/db/connection.js';
import type { Location } from '../../src/providers/GeocodingProvider.js';
import type { MarineDay } from '../../src/providers/MarineProvider.js';
import { MarineConditionsRepository } from '../../src/repositories/MarineConditionsRepository.js';
import { LocationRepository } from '../../src/repositories/LocationRepository.js';

const BIARRITZ: Location = {
    id: 3032797,
    name: 'Biarritz',
    region: 'Nouvelle-Aquitaine',
    country: 'France',
    countryCode: 'FR',
    latitude: 43.48055,
    longitude: -1.55684,
    timezone: null,
    elevation: 19,
};

const day = (date: string, height: number | null, period: number | null): MarineDay => ({
    date,
    waveHeightMax: height,
    wavePeriodMax: period,
});

describe('MarineConditionsRepository', () => {
    let db: Db;
    let repository: MarineConditionsRepository;
    const fetchedAt = new Date('2026-10-17T08:00:00Z');

    beforeEach(() => {
        db = openDb(':memory:');
        new LocationRepository(db).save(BIARRITZ, { query: 'biarritz', countryCode: '' });
        repository = new MarineConditionsRepository(db);
    });

    afterEach(() => db.close());

    it('has no fetch time before the first save', () => {
        expect(repository.getMarineState(BIARRITZ.id)).toEqual({ fetchedAt: null, timezone: null });
    });

    it('saves days, the fetch time as ISO UTC, and a missing timezone', () => {
        repository.saveMarine(BIARRITZ.id, [day('2026-10-17', 2, 12)], fetchedAt, 'Europe/Paris');

        expect(repository.getMarineState(BIARRITZ.id)).toEqual({
            fetchedAt,
            timezone: 'Europe/Paris',
        });
        expect(db.prepare('SELECT marine_fetched_at FROM locations').get()).toEqual({
            marine_fetched_at: '2026-10-17T08:00:00.000Z',
        });
    });

    it('keeps an existing timezone', () => {
        db.prepare(`UPDATE locations SET timezone = 'Europe/Paris'`).run();
        repository.saveMarine(BIARRITZ.id, [], fetchedAt, 'UTC');
        expect(repository.getMarineState(BIARRITZ.id).timezone).toBe('Europe/Paris');
    });

    it('returns days on or after the given date, oldest first', () => {
        repository.saveMarine(
            BIARRITZ.id,
            [day('2026-10-19', 1, 9), day('2026-10-17', 2, 12), day('2026-10-18', 1.5, 10)],
            fetchedAt,
            'Europe/Paris',
        );
        expect(repository.findMarineDays(BIARRITZ.id, '2026-10-18').map((d) => d.date)).toEqual([
            '2026-10-18',
            '2026-10-19',
        ]);
    });

    it('overwrites a day on re-save without duplicating it', () => {
        repository.saveMarine(BIARRITZ.id, [day('2026-10-17', 2, 12)], fetchedAt, 'Europe/Paris');
        repository.saveMarine(BIARRITZ.id, [day('2026-10-17', 3, 14)], fetchedAt, 'Europe/Paris');

        expect(repository.findMarineDays(BIARRITZ.id, '2026-10-01')).toEqual([
            day('2026-10-17', 3, 14),
        ]);
    });

    it('rolls back the days if recording the fetch fails', () => {
        db.exec(`
            CREATE TRIGGER fail_mark BEFORE UPDATE OF marine_fetched_at ON locations
            BEGIN SELECT RAISE(ABORT, 'boom'); END;
        `);

        expect(() =>
            repository.saveMarine(BIARRITZ.id, [day('2026-10-17', 2, 12)], fetchedAt, 'UTC'),
        ).toThrow('boom');
        expect(db.prepare('SELECT COUNT(*) AS n FROM daily_marine_conditions').get()).toEqual({
            n: 0,
        });
    });
});
