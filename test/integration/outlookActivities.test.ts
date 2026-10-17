import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpstreamUnavailableError } from '../../src/errors.js';
import { FakeClock } from '../helpers/clock.js';
import { FakeFetch, unreachableFetch } from '../helpers/fakeFetch.js';
import { fixture } from '../helpers/fixtures.js';
import { TestApp, type TestAppOptions } from '../helpers/testApp.js';

const OUTLOOK = /* GraphQL */ `
    query Outlook($city: String!) {
        outlook(city: $city) {
            location {
                name
            }
            fetchedAt
            isStale
            activities {
                activity
                status
                reason
                days {
                    date
                    score
                    rank
                    reasons
                }
            }
        }
    }
`;

interface Day {
    date: string;
    score: number | null;
    rank: number | null;
    reasons: string[];
}

interface ActivityOutlook {
    activity: string;
    status: string;
    reason: string | null;
    days: Day[];
}

interface OutlookData {
    outlook: {
        location: { name: string };
        fetchedAt: string | null;
        isStale: boolean;
        activities: ActivityOutlook[];
    };
}

const FIRST_FETCH = '2026-10-17T08:00:00.000Z';
const DATES = [17, 18, 19, 20, 21, 22, 23].map((d) => `2026-10-${d}`);

/** Saved responses for one city, each behind its own switchable fake fetch. */
function fakesFor(city: string) {
    return {
        geocoding: new FakeFetch(fixture(`geo-${city}.json`)),
        forecast: new FakeFetch(fixture(`forecast-${city}.json`)),
        marine: new FakeFetch(fixture(`marine-${city}.json`)),
    };
}

describe('outlook query with activities', () => {
    let testApp: TestApp;
    let clock: FakeClock;

    afterEach(() => testApp.close());

    function appFor(city: string, overrides: Partial<TestAppOptions> = {}) {
        const fakes = fakesFor(city);
        clock = new FakeClock(FIRST_FETCH);
        testApp = new TestApp({
            fetch: fakes.geocoding.fetch,
            forecastFetch: fakes.forecast.fetch,
            marineFetch: fakes.marine.fetch,
            clock,
            ...overrides,
        });
        return fakes;
    }

    async function outlook(city: string) {
        const { body } = await testApp.query<OutlookData>(OUTLOOK, { city });
        expect(body.errors).toBeUndefined();
        return body.data!.outlook;
    }

    const byActivity = (activities: ActivityOutlook[]) =>
        Object.fromEntries(activities.map((a) => [a.activity, a]));

    it('scores and ranks all four activities for Biarritz', async () => {
        appFor('biarritz');

        const result = await outlook('Biarritz');
        const activities = byActivity(result.activities);

        expect(result.location.name).toBe('Biarritz');
        expect(result.fetchedAt).toBe(FIRST_FETCH);
        expect(result.isStale).toBe(false);
        expect(result.activities.map((a) => [a.activity, a.status, a.reason])).toEqual([
            ['SKIING', 'NOT_APPLICABLE', 'Not enough snow forecast this week'],
            ['SURFING', 'AVAILABLE', null],
            ['OUTDOOR_SIGHTSEEING', 'AVAILABLE', null],
            ['INDOOR_SIGHTSEEING', 'AVAILABLE', null],
        ]);

        const surfing = activities.SURFING!.days;
        expect(surfing.map((d) => d.date)).toEqual(DATES);
        expect(surfing.map((d) => d.score)).toEqual([100, 80, 80, 80, 60, 80, 60]);
        expect(surfing.map((d) => d.rank)).toEqual([1, 2, 3, 4, 6, 5, 7]);
        expect(surfing[4]!.reasons).toEqual([
            'Big waves (2.6 m)',
            'Long, well-spaced swell (11.8 s)',
            'Strong wind (38 km/h) makes waves choppy',
        ]);

        expect(activities.SKIING!.days).toEqual([]);

        // Indoor is 40 + 0.6 × (100 − outdoor) for every day.
        const outdoor = activities.OUTDOOR_SIGHTSEEING!.days;
        const indoor = activities.INDOOR_SIGHTSEEING!.days;
        expect(indoor.map((d) => d.score)).toEqual(
            outdoor.map((d) => Math.round(40 + 0.6 * (100 - d.score!))),
        );
    });

    it('marks surfing in Delhi as not applicable, with no days', async () => {
        appFor('delhi');

        const surfing = byActivity((await outlook('Delhi')).activities).SURFING;

        expect(surfing).toEqual({
            activity: 'SURFING',
            status: 'NOT_APPLICABLE',
            reason: 'No marine data, likely inland',
            days: [],
        });
    });

    it('makes only surfing unavailable when the marine API is down', async () => {
        appFor('biarritz', { marineFetch: unreachableFetch });

        const result = await outlook('Biarritz');

        expect(result.activities.map((a) => [a.activity, a.status, a.reason])).toEqual([
            ['SKIING', 'NOT_APPLICABLE', 'Not enough snow forecast this week'],
            ['SURFING', 'UNAVAILABLE', 'Marine forecast unavailable'],
            ['OUTDOOR_SIGHTSEEING', 'AVAILABLE', null],
            ['INDOOR_SIGHTSEEING', 'AVAILABLE', null],
        ]);
        expect(byActivity(result.activities).SURFING!.days).toEqual([]);
        expect(result).toMatchObject({ fetchedAt: FIRST_FETCH, isStale: false });
    });

    it('logs a weather or marine failure that it turns into UNAVAILABLE', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        appFor('biarritz', { marineFetch: unreachableFetch });

        await outlook('Biarritz');

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]![0]).toBeInstanceOf(UpstreamUnavailableError);
        expect(warn.mock.calls[0]![0]).toMatchObject({ service: 'Open-Meteo marine' });
        warn.mockRestore();
    });

    it('scores surfing on waves alone when the weather API is down', async () => {
        appFor('biarritz', { forecastFetch: unreachableFetch });

        const result = await outlook('Biarritz');
        const surfing = byActivity(result.activities).SURFING!;

        expect(result.activities.map((a) => [a.activity, a.status, a.reason])).toEqual([
            ['SKIING', 'UNAVAILABLE', 'Weather forecast unavailable'],
            ['SURFING', 'AVAILABLE', null],
            ['OUTDOOR_SIGHTSEEING', 'UNAVAILABLE', 'Weather forecast unavailable'],
            ['INDOOR_SIGHTSEEING', 'UNAVAILABLE', 'Weather forecast unavailable'],
        ]);
        // Without wind, days 5 and 7 lose their −20: every day is 80 or 100.
        expect(surfing.days.map((d) => d.score)).toEqual([100, 80, 80, 80, 80, 80, 80]);
        expect(surfing.days[0]!.reasons).toEqual([
            'Good waves (2 m)',
            'Long, well-spaced swell (12 s)',
            'No wind or storm forecast available',
        ]);
    });

    it('returns the location with every activity unavailable when both APIs are down', async () => {
        appFor('biarritz', { forecastFetch: unreachableFetch, marineFetch: unreachableFetch });

        const result = await outlook('Biarritz');

        expect(result.location.name).toBe('Biarritz');
        expect(result.fetchedAt).toBeNull();
        expect(result.isStale).toBe(false);
        expect(
            result.activities.every((a) => a.status === 'UNAVAILABLE' && a.days.length === 0),
        ).toBe(true);
    });

    it('serves saved data with isStale: true when both refreshes fail 10 hours later', async () => {
        const fakes = appFor('biarritz');
        await outlook('Biarritz');

        fakes.forecast.down = true;
        fakes.marine.down = true;
        clock.advanceHours(10);
        const result = await outlook('Biarritz');

        expect(result).toMatchObject({ fetchedAt: FIRST_FETCH, isStale: true });
        expect(result.activities.map((a) => a.status)).toEqual([
            'NOT_APPLICABLE', // no snow in Biarritz
            'AVAILABLE',
            'AVAILABLE',
            'AVAILABLE',
        ]);
    });

    it('reports the oldest fetch time when only one source is stale', async () => {
        const fakes = appFor('biarritz');
        await outlook('Biarritz');

        fakes.marine.down = true;
        clock.advanceHours(4);
        const result = await outlook('Biarritz');

        // Weather refreshed at +4 h; marine is still the first fetch, served stale.
        expect(result).toMatchObject({ fetchedAt: FIRST_FETCH, isStale: true });
        expect(fakes.forecast.urls).toHaveLength(2);
    });

    it('marks skiing in Zermatt town as not applicable: no snow all week', async () => {
        appFor('zermatt');

        const skiing = byActivity((await outlook('Zermatt')).activities).SKIING;

        expect(skiing).toEqual({
            activity: 'SKIING',
            status: 'NOT_APPLICABLE',
            reason: 'Not enough snow forecast this week',
            days: [],
        });
    });

    it('scores skiing normally when some days have snow, with 0 on the snowless days', async () => {
        const forecast = JSON.parse(fixture('forecast-zermatt.json')) as {
            daily: { snowfall_sum: number[] };
        };
        forecast.daily.snowfall_sum[2] = 5;
        appFor('zermatt', { forecastFetch: new FakeFetch(JSON.stringify(forecast)).fetch });

        const skiing = byActivity((await outlook('Zermatt')).activities).SKIING!;

        expect(skiing.status).toBe('AVAILABLE');
        expect(skiing.days.map((d) => [d.date, d.score, d.rank])).toEqual([
            ['2026-10-17', 0, 2],
            ['2026-10-18', 0, 3],
            ['2026-10-19', 10, 1],
            ['2026-10-20', 0, 4],
            ['2026-10-21', 0, 5],
            ['2026-10-22', 0, 6],
            ['2026-10-23', 0, 7],
        ]);
        expect(skiing.days[0]!.reasons).toEqual(['Not enough snow']);
        expect(skiing.days[2]!.reasons).toEqual([
            '5 cm of fresh snow',
            'Too warm, snow turns to slush (max 14.4 °C)',
        ]);
    });
});
