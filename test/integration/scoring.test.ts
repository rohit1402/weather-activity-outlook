import { describe, expect, it } from 'vitest';
import type { WeatherDay } from '../../src/providers/ForecastProvider.js';
import { HttpClient } from '../../src/providers/HttpClient.js';
import type { MarineDay } from '../../src/providers/MarineProvider.js';
import { OpenMeteoForecastProvider } from '../../src/providers/OpenMeteoForecastProvider.js';
import { OpenMeteoMarineProvider } from '../../src/providers/OpenMeteoMarineProvider.js';
import { rankDays } from '../../src/scoring/helpers.js';
import { scoreSkiing } from '../../src/scoring/skiing.js';
import { scoreSurfing, surfingApplicability } from '../../src/scoring/surfing.js';
import { FakeFetch } from '../helpers/fakeFetch.js';
import { fixture } from '../helpers/fixtures.js';

const http = (body: string) =>
    new HttpClient({ service: 'test', timeoutMs: 5000, fetch: new FakeFetch(body).fetch });

/** Parses a saved response through the real provider, as the service would. */
async function weatherDays(city: string): Promise<WeatherDay[]> {
    const provider = new OpenMeteoForecastProvider(
        http(fixture(`forecast-${city}.json`)),
        'https://forecast.test',
    );
    return (await provider.fetchForecast(0, 0)).days;
}

async function marineDays(city: string): Promise<MarineDay[]> {
    const provider = new OpenMeteoMarineProvider(
        http(fixture(`marine-${city}.json`)),
        'https://marine.test',
    );
    return (await provider.fetchMarine(0, 0)).days;
}

/** Scores each marine day with that date's forecast; a city without a forecast fixture gets none. */
function scoreSurfDays(marine: MarineDay[], weather: WeatherDay[] = []) {
    return marine.map((m) => ({
        date: m.date,
        ...scoreSurfing(m, weather.find((w) => w.date === m.date) ?? null),
    }));
}

describe('scoring with saved Open-Meteo responses', () => {
    it('scores Biarritz surf above Mumbai on every day', async () => {
        const biarritz = scoreSurfDays(await marineDays('biarritz'), await weatherDays('biarritz'));
        // There is no Mumbai forecast fixture, so Mumbai is scored on waves alone.
        const mumbai = scoreSurfDays(await marineDays('mumbai'));

        expect(biarritz.map((d) => d.score)).toEqual([100, 80, 80, 80, 60, 80, 60]);
        expect(mumbai.map((d) => d.score)).toEqual([10, 10, 10, 10, 10, 10, 10]);
        biarritz.forEach((day, i) => expect(day.score).toBeGreaterThan(mumbai[i]!.score!));

        expect(biarritz[0]!.reasons).toEqual([
            'Good waves (2 m)',
            'Long, well-spaced swell (12 s)',
        ]);
        expect(biarritz[4]!.reasons).toEqual([
            'Big waves (2.6 m)',
            'Long, well-spaced swell (11.8 s)',
            'Strong wind (38 km/h) makes waves choppy',
        ]);
        expect(mumbai[0]!.reasons).toEqual([
            'Waves too small (0.3 m)',
            'No wind or storm forecast available',
        ]);
    });

    it('ranks the Biarritz surf days, ties going to the earlier date', async () => {
        const ranked = rankDays(
            scoreSurfDays(await marineDays('biarritz'), await weatherDays('biarritz')),
        );

        // Scores 100, 80, 80, 80, 60, 80, 60: the 80s and the 60s are ties.
        expect(ranked.map((d) => [d.date, d.score, d.rank])).toEqual([
            ['2026-10-17', 100, 1],
            ['2026-10-18', 80, 2],
            ['2026-10-19', 80, 3],
            ['2026-10-20', 80, 4],
            ['2026-10-21', 60, 6],
            ['2026-10-22', 80, 5],
            ['2026-10-23', 60, 7],
        ]);
    });

    it('marks surfing in Delhi as not applicable', async () => {
        expect(surfingApplicability(await marineDays('delhi'))).toEqual({
            applicable: false,
            reason: 'No marine data, likely inland',
        });
        expect(surfingApplicability(await marineDays('biarritz'))).toEqual({ applicable: true });
    });

    it('scores skiing in Zermatt town 0 on its dry, snowless days', async () => {
        const zermatt = (await weatherDays('zermatt')).map(scoreSkiing);

        // The fixture has no snowfall all week and at most 1 cm of snow on the ground.
        expect(zermatt).toEqual(
            Array.from({ length: 7 }, () => ({
                score: 0,
                reasons: ['Not enough snow'],
            })),
        );
    });
});
