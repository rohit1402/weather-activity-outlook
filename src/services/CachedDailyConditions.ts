import { UpstreamUnavailableError } from '../errors.js';
import type { DailyForecast } from '../providers/DailyForecast.js';
import type { Location } from '../providers/GeocodingProvider.js';
import type { FetchState } from '../repositories/FetchState.js';
import { localDate, type Clock } from '../time.js';

export interface DailyConditions<TDay> {
    days: TDay[];
    fetchedAt: Date;
    isStale: boolean;
}

export interface DailyConditionsSource<TDay extends { date: string }> {
    fetch(location: Location): Promise<DailyForecast<TDay>>;
    getState(locationId: number): FetchState;
    save(locationId: number, forecast: DailyForecast<TDay>, fetchedAt: Date): void;
    findDays(locationId: number, fromDate: string): TDay[];
}

const HOUR_MS = 60 * 60 * 1000;

export class CachedDailyConditions<TDay extends { date: string }> {
    static readonly REFRESH_AFTER_MS = 3 * HOUR_MS;
    static readonly MAX_STALE_MS = 48 * HOUR_MS;

    constructor(
        private readonly source: DailyConditionsSource<TDay>,
        private readonly clock: Clock,
    ) {}

    async get(location: Location): Promise<DailyConditions<TDay>> {
        const now = this.clock.now();
        const saved = this.source.getState(location.id);
        const timezone = saved.timezone ?? location.timezone;
        const age = saved.fetchedAt ? now.getTime() - saved.fetchedAt.getTime() : Infinity;

        if (saved.fetchedAt && age < CachedDailyConditions.REFRESH_AFTER_MS) {
            return this.read(location.id, timezone, now, saved.fetchedAt, false);
        }

        try {
            const forecast = await this.source.fetch(location);
            this.source.save(location.id, forecast, now);
            return this.read(location.id, timezone ?? forecast.timezone, now, now, false);
        } catch (err) {
            if (
                err instanceof UpstreamUnavailableError &&
                saved.fetchedAt &&
                age < CachedDailyConditions.MAX_STALE_MS
            ) {
                return this.read(location.id, timezone, now, saved.fetchedAt, true);
            }
            throw err;
        }
    }

    private read(
        locationId: number,
        timezone: string | null,
        now: Date,
        fetchedAt: Date,
        isStale: boolean,
    ): DailyConditions<TDay> {
        const today = localDate(now, timezone ?? 'UTC');
        return { days: this.source.findDays(locationId, today), fetchedAt, isStale };
    }
}
