import { describe, expect, it } from 'vitest';
import { UpstreamUnavailableError } from '../../src/errors.js';
import { HttpClient } from '../../src/providers/HttpClient.js';
import { OpenMeteoForecastProvider } from '../../src/providers/OpenMeteoForecastProvider.js';
import { FakeFetch } from '../helpers/fakeFetch.js';
import { fixture } from '../helpers/fixtures.js';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

function providerFor(fake: FakeFetch): OpenMeteoForecastProvider {
    const http = new HttpClient({
        service: 'Open-Meteo forecast',
        timeoutMs: 5000,
        fetch: fake.fetch,
    });
    return new OpenMeteoForecastProvider(http, BASE_URL);
}

function fetchBody(body: unknown) {
    return providerFor(new FakeFetch(JSON.stringify(body))).fetchForecast(1, 2);
}

const hoursOf = (date: string) =>
    Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`);

/** A valid two-day response; `snowDepth` gives the 48 hourly values (metres). */
function twoDayBody(snowDepth: (number | null)[]) {
    return {
        timezone: 'Europe/Zurich',
        daily: {
            time: ['2026-10-17', '2026-10-18'],
            temperature_2m_max: [1, null],
            temperature_2m_min: [-5, null],
            precipitation_sum: [0, null],
            precipitation_probability_max: [10, null],
            snowfall_sum: [0, null],
            wind_speed_10m_max: [12, null],
            weather_code: [3, null],
            cloud_cover_mean: [40, null],
        },
        hourly: {
            time: [...hoursOf('2026-10-17'), ...hoursOf('2026-10-18')],
            snow_depth: snowDepth,
        },
    };
}

describe('OpenMeteoForecastProvider.fetchForecast', () => {
    it('requests exactly the Point 3 parameters', async () => {
        const fake = new FakeFetch(fixture('forecast-zermatt.json'));
        await providerFor(fake).fetchForecast(46.01998, 7.74863);

        expect(fake.lastUrl.origin + fake.lastUrl.pathname).toBe(BASE_URL);
        expect(Object.fromEntries(fake.lastUrl.searchParams)).toEqual({
            latitude: '46.01998',
            longitude: '7.74863',
            daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,snowfall_sum,wind_speed_10m_max,weather_code,cloud_cover_mean',
            hourly: 'snow_depth',
            timezone: 'auto',
            forecast_days: '7',
        });
    });

    it('maps the daily fields and reduces snow depth to a daily max in cm', async () => {
        const forecast = await providerFor(
            new FakeFetch(fixture('forecast-zermatt.json')),
        ).fetchForecast(46.02, 7.75);

        expect(forecast.timezone).toBe('Europe/Zurich');
        expect(forecast.days).toHaveLength(7);
        expect(forecast.days[0]).toEqual({
            date: '2026-10-17',
            tempMax: 15.5,
            tempMin: 6.2,
            precipitation: 0,
            precipitationProbability: 28,
            snowfall: 0,
            windSpeedMax: 13.2,
            weatherCode: 3,
            cloudCover: 25,
            snowDepthMax: 0,
        });
        // The fixture's only snow is 0.01 m on the 22nd.
        expect(forecast.days.map((d) => d.snowDepthMax)).toEqual([0, 0, 0, 0, 0, 1, 0]);
    });

    it('takes the max per local date, ignoring null hours, without float noise', async () => {
        const day1 = Array.from({ length: 24 }, (_, h) => (h === 9 ? 0.58 : h === 3 ? null : 0.15));
        const forecast = await fetchBody(twoDayBody([...day1, ...Array(24).fill(0.3)]));

        expect(forecast.days.map((d) => d.snowDepthMax)).toEqual([58, 30]);
    });

    it('keeps nulls as null, including a day whose snow depth is null every hour', async () => {
        const forecast = await fetchBody(
            twoDayBody([...Array(24).fill(0.1), ...Array(24).fill(null)]),
        );

        expect(forecast.days[1]).toEqual({
            date: '2026-10-18',
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
    });

    it('treats an error payload as UPSTREAM_UNAVAILABLE', async () => {
        const err = await providerFor(
            new FakeFetch('{"error":true,"reason":"The service is overloaded"}'),
        )
            .fetchForecast(1, 2)
            .catch((e: unknown) => e);
        expect(err).toBeInstanceOf(UpstreamUnavailableError);
        expect(err).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', failure: 'provider' });
    });

    const valid = twoDayBody(Array(48).fill(0));
    it.each([
        ['hourly is missing', { ...valid, hourly: undefined }],
        [
            'a daily array is shorter than daily.time',
            { ...valid, daily: { ...valid.daily, cloud_cover_mean: [40] } },
        ],
        [
            'hourly.snow_depth is shorter than hourly.time',
            { ...valid, hourly: { ...valid.hourly, snow_depth: [0] } },
        ],
        [
            'weather_code is not an integer',
            { ...valid, daily: { ...valid.daily, weather_code: [3.5, null] } },
        ],
        [
            'a temperature is a string',
            { ...valid, daily: { ...valid.daily, temperature_2m_max: ['1', null] } },
        ],
    ])('treats a response where %s as UPSTREAM_UNAVAILABLE', async (_label, body) => {
        const err = await fetchBody(body).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(UpstreamUnavailableError);
        expect(err).toMatchObject({ service: 'Open-Meteo forecast', failure: 'malformed' });
    });
});
