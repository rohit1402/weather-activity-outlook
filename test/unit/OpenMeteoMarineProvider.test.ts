import { describe, expect, it } from 'vitest';
import { UpstreamUnavailableError } from '../../src/errors.js';
import { HttpClient } from '../../src/providers/HttpClient.js';
import { OpenMeteoMarineProvider } from '../../src/providers/OpenMeteoMarineProvider.js';
import { FakeFetch } from '../helpers/fakeFetch.js';
import { fixture } from '../helpers/fixtures.js';

const BASE_URL = 'https://marine-api.open-meteo.com/v1/marine';

function providerFor(fake: FakeFetch): OpenMeteoMarineProvider {
    const http = new HttpClient({
        service: 'Open-Meteo marine',
        timeoutMs: 5000,
        fetch: fake.fetch,
    });
    return new OpenMeteoMarineProvider(http, BASE_URL);
}

async function upstreamFailure(body: string, status = 200) {
    const err = await providerFor(new FakeFetch(body, status))
        .fetchMarine(1, 2)
        .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpstreamUnavailableError);
    return err as UpstreamUnavailableError;
}

describe('OpenMeteoMarineProvider.fetchMarine', () => {
    it('requests exactly the Point 3 parameters', async () => {
        const fake = new FakeFetch(fixture('marine-biarritz.json'));
        await providerFor(fake).fetchMarine(43.48055, -1.55684);

        expect(fake.lastUrl.origin + fake.lastUrl.pathname).toBe(BASE_URL);
        expect(Object.fromEntries(fake.lastUrl.searchParams)).toEqual({
            latitude: '43.48055',
            longitude: '-1.55684',
            daily: 'wave_height_max,wave_period_max',
            timezone: 'auto',
            forecast_days: '7',
        });
    });

    it('maps each date to its wave height and period', async () => {
        const forecast = await providerFor(
            new FakeFetch(fixture('marine-biarritz.json')),
        ).fetchMarine(43.48, -1.56);

        expect(forecast.timezone).toBe('Europe/Paris');
        expect(forecast.days).toHaveLength(7);
        expect(forecast.days[0]).toEqual({
            date: '2026-10-17',
            waveHeightMax: 2.0,
            wavePeriodMax: 12.0,
        });
        expect(forecast.days[6]).toEqual({
            date: '2026-10-23',
            waveHeightMax: 2.5,
            wavePeriodMax: 11.1,
        });
    });

    it('keeps nulls as null for an inland location', async () => {
        const forecast = await providerFor(new FakeFetch(fixture('marine-delhi.json'))).fetchMarine(
            28.65,
            77.23,
        );

        expect(forecast.timezone).toBe('Asia/Kolkata');
        expect(forecast.days.map((d) => [d.waveHeightMax, d.wavePeriodMax])).toEqual(
            Array.from({ length: 7 }, () => [null, null]),
        );
    });

    it('treats an error payload as UPSTREAM_UNAVAILABLE', async () => {
        const err = await upstreamFailure('{"error":true,"reason":"The service is overloaded"}');
        expect(err).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', failure: 'provider' });
    });

    it.each([
        ['daily is missing', { timezone: 'UTC' }],
        [
            'a wave array is shorter than daily.time',
            {
                timezone: 'UTC',
                daily: {
                    time: ['2026-10-17', '2026-10-18'],
                    wave_height_max: [1],
                    wave_period_max: [9, 10],
                },
            },
        ],
        [
            'a wave value is a string',
            {
                timezone: 'UTC',
                daily: { time: ['2026-10-17'], wave_height_max: ['1.2'], wave_period_max: [9] },
            },
        ],
        [
            'a date is not YYYY-MM-DD',
            {
                timezone: 'UTC',
                daily: { time: ['17/10/2026'], wave_height_max: [1], wave_period_max: [9] },
            },
        ],
    ])('treats a response where %s as UPSTREAM_UNAVAILABLE', async (_label, payload) => {
        const err = await upstreamFailure(JSON.stringify(payload));
        expect(err).toMatchObject({ service: 'Open-Meteo marine', failure: 'malformed' });
    });
});
