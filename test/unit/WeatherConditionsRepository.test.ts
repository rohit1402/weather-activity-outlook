import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../../src/db/connection.js';
import type { WeatherDay } from '../../src/providers/ForecastProvider.js';
import type { Location } from '../../src/providers/GeocodingProvider.js';
import { LocationRepository } from '../../src/repositories/LocationRepository.js';
import { WeatherConditionsRepository } from '../../src/repositories/WeatherConditionsRepository.js';

const ZERMATT: Location = {
    id: 2657928,
    name: 'Zermatt',
    region: 'Valais',
    country: 'Switzerland',
    countryCode: 'CH',
    latitude: 46.01998,
    longitude: 7.74863,
    timezone: null,
    elevation: 1608,
};

const day = (date: string, overrides: Partial<WeatherDay> = {}): WeatherDay => ({
    date,
    tempMax: 15.5,
    tempMin: 6.2,
    precipitation: 0,
    precipitationProbability: 28,
    snowfall: 0,
    windSpeedMax: 13.2,
    weatherCode: 3,
    cloudCover: 25,
    snowDepthMax: 0,
    ...overrides,
});

describe('WeatherConditionsRepository', () => {
    let db: Db;
    let repository: WeatherConditionsRepository;
    const fetchedAt = new Date('2026-10-17T08:00:00Z');

    beforeEach(() => {
        db = openDb(':memory:');
        new LocationRepository(db).save(ZERMATT, { query: 'zermatt', countryCode: '' });
        repository = new WeatherConditionsRepository(db);
    });

    afterEach(() => db.close());

    it('has no fetch time before the first save', () => {
        expect(repository.getWeatherState(ZERMATT.id)).toEqual({ fetchedAt: null, timezone: null });
    });

    it('saves days, the fetch time as ISO UTC, and a missing timezone', () => {
        repository.saveWeather(ZERMATT.id, [day('2026-10-17')], fetchedAt, 'Europe/Zurich');

        expect(repository.getWeatherState(ZERMATT.id)).toEqual({
            fetchedAt,
            timezone: 'Europe/Zurich',
        });
        expect(db.prepare('SELECT weather_fetched_at FROM locations').get()).toEqual({
            weather_fetched_at: '2026-10-17T08:00:00.000Z',
        });
    });

    it('round-trips every field, including nulls', () => {
        const allNull = day('2026-10-18', {
            tempMax: null,
            tempMin: null,
            precipitation: null,
            precipitationProbability: null,
            snowfall: null,
            windSpeedMax: null,
            weatherCode: null,
            cloudCover: null,
            snowDepthMax: null,
        });
        repository.saveWeather(
            ZERMATT.id,
            [day('2026-10-17', { snowDepthMax: 58 }), allNull],
            fetchedAt,
            'Europe/Zurich',
        );

        expect(repository.findWeatherDays(ZERMATT.id, '2026-10-01')).toEqual([
            day('2026-10-17', { snowDepthMax: 58 }),
            allNull,
        ]);
    });

    it('returns days on or after the given date, oldest first', () => {
        repository.saveWeather(
            ZERMATT.id,
            [day('2026-10-19'), day('2026-10-17'), day('2026-10-18')],
            fetchedAt,
            'Europe/Zurich',
        );
        expect(repository.findWeatherDays(ZERMATT.id, '2026-10-18').map((d) => d.date)).toEqual([
            '2026-10-18',
            '2026-10-19',
        ]);
    });

    it('overwrites a day on re-save without duplicating it', () => {
        repository.saveWeather(ZERMATT.id, [day('2026-10-17')], fetchedAt, 'Europe/Zurich');
        repository.saveWeather(
            ZERMATT.id,
            [day('2026-10-17', { tempMax: 9 })],
            fetchedAt,
            'Europe/Zurich',
        );

        expect(repository.findWeatherDays(ZERMATT.id, '2026-10-01')).toEqual([
            day('2026-10-17', { tempMax: 9 }),
        ]);
    });

    it('does not touch marine_fetched_at', () => {
        repository.saveWeather(ZERMATT.id, [day('2026-10-17')], fetchedAt, 'Europe/Zurich');
        expect(db.prepare('SELECT marine_fetched_at FROM locations').get()).toEqual({
            marine_fetched_at: null,
        });
    });

    it('rolls back the days if recording the fetch fails', () => {
        db.exec(`
            CREATE TRIGGER fail_mark BEFORE UPDATE OF weather_fetched_at ON locations
            BEGIN SELECT RAISE(ABORT, 'boom'); END;
        `);

        expect(() =>
            repository.saveWeather(ZERMATT.id, [day('2026-10-17')], fetchedAt, 'UTC'),
        ).toThrow('boom');
        expect(db.prepare('SELECT COUNT(*) AS n FROM daily_weather_conditions').get()).toEqual({
            n: 0,
        });
    });
});
