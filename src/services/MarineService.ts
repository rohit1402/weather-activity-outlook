import { UpstreamUnavailableError } from '../errors.js';
import type { Location } from '../providers/GeocodingProvider.js';
import type { MarineDay, MarineProvider } from '../providers/MarineProvider.js';
import type { MarineConditionsRepository } from '../repositories/MarineConditionsRepository.js';
import { localDate, type Clock } from '../time.js';

export interface MarineConditions {
    days: MarineDay[];
    fetchedAt: Date;
    isStale: boolean;
}

const HOUR_MS = 60 * 60 * 1000;

export class MarineService {
    static readonly REFRESH_AFTER_MS = 3 * HOUR_MS;
    static readonly MAX_STALE_MS = 48 * HOUR_MS;

    constructor(
        private readonly provider: MarineProvider,
        private readonly repository: MarineConditionsRepository,
        private readonly clock: Clock,
    ) {}

    async getMarineConditions(location: Location): Promise<MarineConditions> {
        const now = this.clock.now();
        const saved = this.repository.getMarineState(location.id);
        const timezone = saved.timezone ?? location.timezone;
        const age = saved.fetchedAt ? now.getTime() - saved.fetchedAt.getTime() : Infinity;

        if (saved.fetchedAt && age < MarineService.REFRESH_AFTER_MS) {
            return this.read(location.id, timezone, now, saved.fetchedAt, false);
        }

        try {
            const forecast = await this.provider.fetchMarine(location.latitude, location.longitude);
            this.repository.saveMarine(location.id, forecast.days, now, forecast.timezone);
            return this.read(location.id, timezone ?? forecast.timezone, now, now, false);
        } catch (err) {
            if (
                err instanceof UpstreamUnavailableError &&
                saved.fetchedAt &&
                age < MarineService.MAX_STALE_MS
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
    ): MarineConditions {
        const today = localDate(now, timezone ?? 'UTC');
        return { days: this.repository.findMarineDays(locationId, today), fetchedAt, isStale };
    }
}
