import { describe, expect, it } from 'vitest';
import type { WeatherDay } from '../../src/providers/ForecastProvider.js';
import { HttpClient } from '../../src/providers/HttpClient.js';
import type { MarineDay } from '../../src/providers/MarineProvider.js';
import { OpenMeteoForecastProvider } from '../../src/providers/OpenMeteoForecastProvider.js';
import { OpenMeteoMarineProvider } from '../../src/providers/OpenMeteoMarineProvider.js';
import { rankDays } from '../../src/scoring/helpers.js';
import { scoreSkiing } from '../../src/scoring/skiing.js';
import { scoreSurfing, surfingApplicability } from '../../src/scoring/surfing.js';
import type { DayConditions } from '../../src/scoring/types.js';
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

/** Joins weather and marine days by date; a city without a forecast fixture gets null weather. */
function join(marine: MarineDay[], weather: WeatherDay[] = []): DayConditions[] {
    return marine.map((m) => ({
        date: m.date,
        marine: m,
        weather: weather.find((w) => w.date === m.date) ?? null,
    }));
}

describe('scoring with saved Open-Meteo responses', () => {
    it('scores Biarritz surf above Mumbai on every day', async () => {
        const biarritz = join(await marineDays('biarritz'), await weatherDays('biarritz')).map(
            scoreSurfing,
        );
        // There is no Mumbai forecast fixture, so Mumbai is scored on waves alone.
        const mumbai = join(await marineDays('mumbai')).map(scoreSurfing);

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
        const days = join(await marineDays('biarritz'), await weatherDays('biarritz'));
        const ranked = rankDays(days.map((d) => ({ date: d.date, ...scoreSurfing(d) })));

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
        const zermatt = (await weatherDays('zermatt')).map((weather) =>
            scoreSkiing({ date: weather.date, weather, marine: null }),
        );

        // The fixture has no snowfall all week and at most 1 cm of snow on the ground.
        expect(zermatt).toEqual(
            Array.from({ length: 7 }, () => ({
                score: 0,
                reasons: ['Not enough snow'],
            })),
        );
    });
});
