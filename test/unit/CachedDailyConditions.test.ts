import { describe, expect, it, vi } from 'vitest';
import { UpstreamUnavailableError } from '../../src/errors.js';
import type { DailyForecast } from '../../src/providers/DailyForecast.js';
import type { Location } from '../../src/providers/GeocodingProvider.js';
import type { FetchState } from '../../src/repositories/FetchState.js';
import {
    CachedDailyConditions,
    type DailyConditionsSource,
} from '../../src/services/CachedDailyConditions.js';
import { FakeClock } from '../helpers/clock.js';

interface Day {
    date: string;
    value: number;
}

const LOCATION: Location = {
    id: 1,
    name: 'Somewhere',
    region: null,
    country: null,
    countryCode: null,
    latitude: 0,
    longitude: 0,
    timezone: 'Europe/Paris',
    elevation: null,
};

const FORECAST: DailyForecast<Day> = {
    timezone: 'Europe/Paris',
    days: [
        { date: '2026-10-17', value: 1 },
        { date: '2026-10-18', value: 2 },
    ],
};

class FakeSource implements DailyConditionsSource<Day> {
    fetches = 0;
    failWith: Error | null = null;
    private state: FetchState = { fetchedAt: null, timezone: null };
    private days: Day[] = [];

    async fetch(): Promise<DailyForecast<Day>> {
        this.fetches++;
        if (this.failWith) throw this.failWith;
        return FORECAST;
    }

    getState(): FetchState {
        return this.state;
    }

    save(_locationId: number, forecast: DailyForecast<Day>, fetchedAt: Date): void {
        this.days = forecast.days;
        this.state = { fetchedAt, timezone: this.state.timezone ?? forecast.timezone };
    }

    findDays(_locationId: number, fromDate: string): Day[] {
        return this.days.filter((d) => d.date >= fromDate);
    }
}

const upstream = () => new UpstreamUnavailableError('Test API', 'network', 'down');

function setup(startIso = '2026-10-17T08:00:00.000Z') {
    const source = new FakeSource();
    const clock = new FakeClock(startIso);
    return { source, clock, conditions: new CachedDailyConditions(source, clock) };
}

describe('CachedDailyConditions.get', () => {
    it('refreshes at exactly 3 hours (the limit is strict)', async () => {
        const { source, clock, conditions } = setup();
        await conditions.get(LOCATION);

        clock.advanceHours(3);
        await conditions.get(LOCATION);

        expect(source.fetches).toBe(2);
    });

    it('serves stale data just under 48 hours but not at exactly 48 hours', async () => {
        const { source, clock, conditions } = setup();
        await conditions.get(LOCATION);
        source.failWith = upstream();

        clock.advanceHours(47.9);
        await expect(conditions.get(LOCATION)).resolves.toMatchObject({ isStale: true });

        clock.advanceHours(0.1);
        await expect(conditions.get(LOCATION)).rejects.toBeInstanceOf(UpstreamUnavailableError);
    });

    it('logs the failed refresh when it serves stale data, and only then', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { source, clock, conditions } = setup();
        await conditions.get(LOCATION);
        const failure = upstream();
        source.failWith = failure;

        clock.advanceHours(10);
        await conditions.get(LOCATION);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(failure);

        // Too old to serve: the error is rethrown instead (and logged by the caller).
        clock.advanceHours(40);
        await expect(conditions.get(LOCATION)).rejects.toBe(failure);
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it('rethrows an unexpected error even when stale data could be served', async () => {
        const { source, clock, conditions } = setup();
        await conditions.get(LOCATION);
        const bug = new TypeError('bug in the provider');
        source.failWith = bug;

        clock.advanceHours(10);
        await expect(conditions.get(LOCATION)).rejects.toBe(bug);
    });

    it('drops days before local today on a fresh read too', async () => {
        const { source, clock, conditions } = setup('2026-10-17T20:00:00.000Z');
        await conditions.get(LOCATION);

        clock.advanceHours(2.5);
        const result = await conditions.get(LOCATION);

        expect(source.fetches).toBe(1);
        expect(result).toMatchObject({
            isStale: false,
            fetchedAt: new Date('2026-10-17T20:00:00Z'),
        });
        expect(result.days.map((d) => d.date)).toEqual(['2026-10-18']);
    });
});
