import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../../src/db/connection.js';
import { UpstreamUnavailableError } from '../../src/errors.js';
import type { Location } from '../../src/providers/GeocodingProvider.js';
import { HttpClient } from '../../src/providers/HttpClient.js';
import { OpenMeteoMarineProvider } from '../../src/providers/OpenMeteoMarineProvider.js';
import { MarineConditionsRepository } from '../../src/repositories/MarineConditionsRepository.js';
import { LocationRepository } from '../../src/repositories/LocationRepository.js';
import { MarineService } from '../../src/services/MarineService.js';
import { FakeClock } from '../helpers/clock.js';
import { FakeFetch } from '../helpers/fakeFetch.js';
import { fixture } from '../helpers/fixtures.js';

const BIARRITZ: Location = {
    id: 3032797,
    name: 'Biarritz',
    region: 'Nouvelle-Aquitaine',
    country: 'France',
    countryCode: 'FR',
    latitude: 43.48055,
    longitude: -1.55684,
    timezone: 'Europe/Paris',
    elevation: 19,
};

const DELHI: Location = {
    id: 1273294,
    name: 'Delhi',
    region: 'National Capital Territory of Delhi',
    country: 'India',
    countryCode: 'IN',
    latitude: 28.65195,
    longitude: 77.23149,
    timezone: 'Asia/Kolkata',
    elevation: 227,
};

const FIRST_FETCH = '2026-10-17T08:00:00.000Z';
const ALL_FIXTURE_DATES = [17, 18, 19, 20, 21, 22, 23].map((d) => `2026-10-${d}`);

describe('MarineService.getMarineConditions', () => {
    let db: Db;
    let clock: FakeClock;

    beforeEach(() => {
        db = openDb(':memory:');
        clock = new FakeClock(FIRST_FETCH);
        const locations = new LocationRepository(db);
        locations.save(BIARRITZ, { query: 'biarritz', countryCode: '' });
        locations.save(DELHI, { query: 'delhi', countryCode: '' });
    });

    afterEach(() => db.close());

    function serviceAnswering(fixtureName: string) {
        const fake = new FakeFetch(fixture(fixtureName));
        const http = new HttpClient({
            service: 'Open-Meteo marine',
            timeoutMs: 5000,
            fetch: fake.fetch,
        });
        const service = new MarineService(
            new OpenMeteoMarineProvider(http, 'https://marine.test/v1/marine'),
            new MarineConditionsRepository(db),
            clock,
        );
        return { service, fake };
    }

    const dates = (days: { date: string }[]) => days.map((d) => d.date);

    it('fetches and saves on first use', async () => {
        const { service, fake } = serviceAnswering('marine-biarritz.json');

        const result = await service.getMarineConditions(BIARRITZ);

        expect(fake.urls).toHaveLength(1);
        expect(result).toMatchObject({ isStale: false, fetchedAt: new Date(FIRST_FETCH) });
        expect(dates(result.days)).toEqual(ALL_FIXTURE_DATES);
        expect(result.days[0]).toEqual({ date: '2026-10-17', waveHeightMax: 2, wavePeriodMax: 12 });
    });

    it('makes no network call while data is fresh (under 3 hours)', async () => {
        const { service, fake } = serviceAnswering('marine-biarritz.json');
        await service.getMarineConditions(BIARRITZ);

        clock.advanceHours(2.9);
        const result = await service.getMarineConditions(BIARRITZ);

        expect(fake.urls).toHaveLength(1);
        expect(result).toMatchObject({ isStale: false, fetchedAt: new Date(FIRST_FETCH) });
        expect(result.days).toHaveLength(7);
    });

    it('refreshes data older than 3 hours', async () => {
        const { service, fake } = serviceAnswering('marine-biarritz.json');
        await service.getMarineConditions(BIARRITZ);

        clock.advanceHours(4);
        const result = await service.getMarineConditions(BIARRITZ);

        expect(fake.urls).toHaveLength(2);
        expect(result).toMatchObject({ isStale: false, fetchedAt: clock.now() });
        expect(db.prepare('SELECT COUNT(*) AS n FROM daily_marine_conditions').get()).toEqual({
            n: 7,
        });
    });

    it('returns 10-hour-old data with isStale: true when the refresh fails', async () => {
        const { service, fake } = serviceAnswering('marine-biarritz.json');
        await service.getMarineConditions(BIARRITZ);

        fake.down = true;
        clock.advanceHours(10);
        const result = await service.getMarineConditions(BIARRITZ);

        expect(fake.urls).toHaveLength(2); // the refresh was attempted
        expect(result).toMatchObject({ isStale: true, fetchedAt: new Date(FIRST_FETCH) });
        expect(dates(result.days)).toEqual(ALL_FIXTURE_DATES); // still the 17th in Paris
    });

    it('throws UPSTREAM_UNAVAILABLE when the refresh fails and data is 50 hours old', async () => {
        const { service, fake } = serviceAnswering('marine-biarritz.json');
        await service.getMarineConditions(BIARRITZ);

        fake.down = true;
        clock.advanceHours(50);
        const err = await service.getMarineConditions(BIARRITZ).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(UpstreamUnavailableError);
        expect(err).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', service: 'Open-Meteo marine' });
    });

    it('throws UPSTREAM_UNAVAILABLE when the fetch fails and nothing is saved', async () => {
        const { service, fake } = serviceAnswering('marine-biarritz.json');
        fake.down = true;

        await expect(service.getMarineConditions(BIARRITZ)).rejects.toBeInstanceOf(
            UpstreamUnavailableError,
        );
    });

    it('drops days before local today when serving stale data, using the location timezone', async () => {
        const { service, fake } = serviceAnswering('marine-biarritz.json');
        await service.getMarineConditions(BIARRITZ);

        fake.down = true;
        // 22:30 UTC on the 18th is 00:30 on the 19th in Paris: the 17th and 18th are past.
        clock.advanceHours(38.5);
        expect(clock.now().toISOString()).toBe('2026-10-18T22:30:00.000Z');
        const result = await service.getMarineConditions(BIARRITZ);

        expect(result.isStale).toBe(true);
        expect(dates(result.days)).toEqual(ALL_FIXTURE_DATES.slice(2));
    });

    it("stores Delhi's missing wave data as null, not 0", async () => {
        const { service } = serviceAnswering('marine-delhi.json');

        const result = await service.getMarineConditions(DELHI);

        expect(result.days).toHaveLength(7);
        expect(result.days.every((d) => d.waveHeightMax === null && d.wavePeriodMax === null)).toBe(
            true,
        );
        expect(
            db
                .prepare(
                    `SELECT typeof(wave_height_max) AS height, typeof(wave_period_max) AS period
                     FROM daily_marine_conditions WHERE location_id = ?`,
                )
                .all(DELHI.id),
        ).toEqual(Array.from({ length: 7 }, () => ({ height: 'null', period: 'null' })));
    });

    it('uses and saves the timezone from the marine response when the location has none', async () => {
        const withoutTimezone: Location = { ...BIARRITZ, timezone: null };
        db.prepare('UPDATE locations SET timezone = NULL WHERE id = ?').run(BIARRITZ.id);
        const { service } = serviceAnswering('marine-biarritz.json');

        await service.getMarineConditions(withoutTimezone);

        expect(db.prepare('SELECT timezone FROM locations WHERE id = ?').get(BIARRITZ.id)).toEqual({
            timezone: 'Europe/Paris',
        });
    });
});
