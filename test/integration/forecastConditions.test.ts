import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../../src/db/connection.js';
import { UpstreamUnavailableError } from '../../src/errors.js';
import type { Location } from '../../src/providers/GeocodingProvider.js';
import { HttpClient } from '../../src/providers/HttpClient.js';
import { OpenMeteoForecastProvider } from '../../src/providers/OpenMeteoForecastProvider.js';
import { OpenMeteoMarineProvider } from '../../src/providers/OpenMeteoMarineProvider.js';
import { LocationRepository } from '../../src/repositories/LocationRepository.js';
import { MarineConditionsRepository } from '../../src/repositories/MarineConditionsRepository.js';
import { WeatherConditionsRepository } from '../../src/repositories/WeatherConditionsRepository.js';
import { ForecastService } from '../../src/services/ForecastService.js';
import { MarineService } from '../../src/services/MarineService.js';
import { FakeClock } from '../helpers/clock.js';
import { FakeFetch } from '../helpers/fakeFetch.js';
import { fixture } from '../helpers/fixtures.js';

const ZERMATT: Location = {
    id: 2657928,
    name: 'Zermatt',
    region: 'Valais',
    country: 'Switzerland',
    countryCode: 'CH',
    latitude: 46.01998,
    longitude: 7.74863,
    timezone: 'Europe/Zurich',
    elevation: 1608,
};

const QUEENSTOWN: Location = {
    id: 6204696,
    name: 'Queenstown',
    region: 'Otago',
    country: 'New Zealand',
    countryCode: 'NZ',
    latitude: -45.03023,
    longitude: 168.6627,
    timezone: 'Pacific/Auckland',
    elevation: 328,
};

// The fixtures cover 2026-10-17 to 2026-10-23. 08:00 UTC is 10:00 in Zermatt and
// 21:00 in Queenstown (UTC+13), both still on the 17th.
const FIRST_FETCH = '2026-10-17T08:00:00.000Z';
const ALL_FIXTURE_DATES = [17, 18, 19, 20, 21, 22, 23].map((d) => `2026-10-${d}`);

describe('ForecastService.getForecastConditions', () => {
    let db: Db;
    let clock: FakeClock;

    beforeEach(() => {
        db = openDb(':memory:');
        clock = new FakeClock(FIRST_FETCH);
        const locations = new LocationRepository(db);
        locations.save(ZERMATT, { query: 'zermatt', countryCode: '' });
        locations.save(QUEENSTOWN, { query: 'queenstown', countryCode: 'NZ' });
    });

    afterEach(() => db.close());

    function serviceAnswering(fixtureName: string) {
        const fake = new FakeFetch(fixture(fixtureName));
        const http = new HttpClient({
            service: 'Open-Meteo forecast',
            timeoutMs: 5000,
            fetch: fake.fetch,
        });
        const service = new ForecastService(
            new OpenMeteoForecastProvider(http, 'https://forecast.test/v1/forecast'),
            new WeatherConditionsRepository(db),
            clock,
        );
        return { service, fake };
    }

    const dates = (days: { date: string }[]) => days.map((d) => d.date);

    it('fetches and saves on first use', async () => {
        const { service, fake } = serviceAnswering('forecast-zermatt.json');

        const result = await service.getForecastConditions(ZERMATT);

        expect(fake.urls).toHaveLength(1);
        expect(result).toMatchObject({ isStale: false, fetchedAt: new Date(FIRST_FETCH) });
        expect(dates(result.days)).toEqual(ALL_FIXTURE_DATES);
        expect(result.days[0]).toMatchObject({ date: '2026-10-17', tempMax: 15.5, weatherCode: 3 });
        expect(result.days[5]).toMatchObject({ date: '2026-10-22', snowDepthMax: 1 });
    });

    it('makes no network call while data is fresh (under 3 hours)', async () => {
        const { service, fake } = serviceAnswering('forecast-zermatt.json');
        await service.getForecastConditions(ZERMATT);

        clock.advanceHours(2.9);
        const result = await service.getForecastConditions(ZERMATT);

        expect(fake.urls).toHaveLength(1);
        expect(result).toMatchObject({ isStale: false, fetchedAt: new Date(FIRST_FETCH) });
        expect(result.days).toHaveLength(7);
    });

    it('refreshes data older than 3 hours', async () => {
        const { service, fake } = serviceAnswering('forecast-zermatt.json');
        await service.getForecastConditions(ZERMATT);

        clock.advanceHours(4);
        const result = await service.getForecastConditions(ZERMATT);

        expect(fake.urls).toHaveLength(2);
        expect(result).toMatchObject({ isStale: false, fetchedAt: clock.now() });
        expect(db.prepare('SELECT COUNT(*) AS n FROM daily_weather_conditions').get()).toEqual({
            n: 7,
        });
    });

    it('returns 10-hour-old data with isStale: true when the refresh fails', async () => {
        const { service, fake } = serviceAnswering('forecast-zermatt.json');
        await service.getForecastConditions(ZERMATT);

        fake.down = true;
        clock.advanceHours(10);
        const result = await service.getForecastConditions(ZERMATT);

        expect(fake.urls).toHaveLength(2);
        expect(result).toMatchObject({ isStale: true, fetchedAt: new Date(FIRST_FETCH) });
        expect(dates(result.days)).toEqual(ALL_FIXTURE_DATES);
    });

    it('throws UPSTREAM_UNAVAILABLE when the refresh fails and data is 50 hours old', async () => {
        const { service, fake } = serviceAnswering('forecast-zermatt.json');
        await service.getForecastConditions(ZERMATT);

        fake.down = true;
        clock.advanceHours(50);
        const err = await service.getForecastConditions(ZERMATT).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(UpstreamUnavailableError);
        expect(err).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', service: 'Open-Meteo forecast' });
    });

    it('throws UPSTREAM_UNAVAILABLE when the fetch fails and nothing is saved', async () => {
        const { service, fake } = serviceAnswering('forecast-zermatt.json');
        fake.down = true;

        await expect(service.getForecastConditions(ZERMATT)).rejects.toBeInstanceOf(
            UpstreamUnavailableError,
        );
    });

    it('drops days before local today when serving stale data, using the location timezone', async () => {
        const { service, fake } = serviceAnswering('forecast-queenstown-nz.json');
        await service.getForecastConditions(QUEENSTOWN);

        fake.down = true;
        // 11:30 UTC on the 17th is 00:30 on the 18th in Queenstown. In UTC it's still the 17th.
        clock.advanceHours(3.5);
        expect(clock.now().toISOString()).toBe('2026-10-17T11:30:00.000Z');
        const result = await service.getForecastConditions(QUEENSTOWN);

        expect(result.isStale).toBe(true);
        expect(dates(result.days)).toEqual(ALL_FIXTURE_DATES.slice(1));
    });

    it('stores null values as null, not 0', async () => {
        const withNulls = JSON.parse(fixture('forecast-zermatt.json')) as {
            daily: Record<string, unknown[]>;
            hourly: { snow_depth: (number | null)[] };
        };
        withNulls.daily.temperature_2m_max![0] = null;
        withNulls.daily.precipitation_probability_max![0] = null;
        withNulls.hourly.snow_depth = withNulls.hourly.snow_depth.map((v, i) =>
            i < 24 ? null : v,
        );
        const fake = new FakeFetch(JSON.stringify(withNulls));
        const service = new ForecastService(
            new OpenMeteoForecastProvider(
                new HttpClient({
                    service: 'Open-Meteo forecast',
                    timeoutMs: 5000,
                    fetch: fake.fetch,
                }),
                'https://forecast.test/v1/forecast',
            ),
            new WeatherConditionsRepository(db),
            clock,
        );

        const result = await service.getForecastConditions(ZERMATT);

        expect(result.days[0]).toMatchObject({
            tempMax: null,
            precipitationProbability: null,
            snowDepthMax: null,
        });
        expect(
            db
                .prepare(
                    `SELECT typeof(temp_max) AS temp, typeof(precipitation_probability) AS prob,
                            typeof(snow_depth_max) AS depth
                     FROM daily_weather_conditions WHERE date = '2026-10-17'`,
                )
                .get(),
        ).toEqual({ temp: 'null', prob: 'null', depth: 'null' });
    });

    it('uses and saves the timezone from the forecast response when the location has none', async () => {
        db.prepare('UPDATE locations SET timezone = NULL WHERE id = ?').run(ZERMATT.id);
        const { service } = serviceAnswering('forecast-zermatt.json');

        await service.getForecastConditions({ ...ZERMATT, timezone: null });

        expect(db.prepare('SELECT timezone FROM locations WHERE id = ?').get(ZERMATT.id)).toEqual({
            timezone: 'Europe/Zurich',
        });
    });

    it('keeps weather and marine fetch times independent', async () => {
        const forecast = serviceAnswering('forecast-zermatt.json');
        const marineFetch = new FakeFetch(fixture('marine-zermatt.json'));
        const marine = new MarineService(
            new OpenMeteoMarineProvider(
                new HttpClient({
                    service: 'Open-Meteo marine',
                    timeoutMs: 5000,
                    fetch: marineFetch.fetch,
                }),
                'https://marine.test/v1/marine',
            ),
            new MarineConditionsRepository(db),
            clock,
        );

        await forecast.service.getForecastConditions(ZERMATT); // weather at 0 h
        clock.advanceHours(2);
        await marine.getMarineConditions(ZERMATT); // marine at 2 h
        clock.advanceHours(2);

        // At 4 h, weather is 4 hours old (refresh) and marine is 2 hours old (no refresh).
        await forecast.service.getForecastConditions(ZERMATT);
        await marine.getMarineConditions(ZERMATT);

        expect(forecast.fake.urls).toHaveLength(2);
        expect(marineFetch.urls).toHaveLength(1);
    });
});
