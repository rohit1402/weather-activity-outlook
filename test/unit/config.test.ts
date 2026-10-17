import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('loadConfig', () => {
    it('uses defaults when nothing is set', () => {
        expect(loadConfig({})).toEqual({
            port: 4000,
            databasePath: 'data/weather.db',
            openMeteo: {
                geocodingUrl: 'https://geocoding-api.open-meteo.com/v1/search',
                forecastUrl: 'https://api.open-meteo.com/v1/forecast',
                marineUrl: 'https://marine-api.open-meteo.com/v1/marine',
                timeoutMs: 5000,
            },
        });
    });

    it('reads every variable from the environment', () => {
        expect(
            loadConfig({
                PORT: '8080',
                DATABASE_PATH: '/tmp/x.db',
                OPEN_METEO_GEOCODING_URL: 'http://localhost:9000/geo',
                OPEN_METEO_FORECAST_URL: 'http://localhost:9000/forecast',
                OPEN_METEO_MARINE_URL: 'http://localhost:9000/marine',
                OPEN_METEO_TIMEOUT_MS: '2500',
            }),
        ).toEqual({
            port: 8080,
            databasePath: '/tmp/x.db',
            openMeteo: {
                geocodingUrl: 'http://localhost:9000/geo',
                forecastUrl: 'http://localhost:9000/forecast',
                marineUrl: 'http://localhost:9000/marine',
                timeoutMs: 2500,
            },
        });
    });

    it('rejects an invalid PORT', () => {
        expect(() => loadConfig({ PORT: 'abc' })).toThrow('Invalid PORT: abc');
    });

    it('rejects a non-positive timeout', () => {
        expect(() => loadConfig({ OPEN_METEO_TIMEOUT_MS: '0' })).toThrow(
            'Invalid OPEN_METEO_TIMEOUT_MS: 0',
        );
    });

    it('rejects an invalid Open-Meteo URL', () => {
        expect(() => loadConfig({ OPEN_METEO_FORECAST_URL: 'not a url' })).toThrow(
            'Invalid OPEN_METEO_FORECAST_URL: not a url',
        );
    });
});
