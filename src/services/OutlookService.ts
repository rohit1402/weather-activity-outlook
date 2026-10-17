import { UpstreamUnavailableError } from '../errors.js';
import type { Location } from '../providers/GeocodingProvider.js';
import { buildActivityOutlooks, type ActivityOutlook } from '../scoring/activities.js';
import type { DailyConditions } from './CachedDailyConditions.js';
import type { ForecastService } from './ForecastService.js';
import type { LocationService } from './LocationService.js';
import type { MarineService } from './MarineService.js';

export interface Outlook {
    location: Location;
    fetchedAt: Date | null;
    isStale: boolean;
    activities: ActivityOutlook[];
}

export class OutlookService {
    constructor(
        private readonly locations: LocationService,
        private readonly forecasts: ForecastService,
        private readonly marine: MarineService,
    ) {}

    async getOutlook(city: string, countryCode?: string | null): Promise<Outlook> {
        const location = await this.locations.resolveLocation(city, countryCode);
        const [weather, marine] = await Promise.all([
            orUnavailable(this.forecasts.getForecastConditions(location)),
            orUnavailable(this.marine.getMarineConditions(location)),
        ]);

        const shown = [weather, marine].filter((source) => source !== null);
        const fetchTimes = shown.map((source) => source.fetchedAt.getTime());

        return {
            location,
            fetchedAt: fetchTimes.length > 0 ? new Date(Math.min(...fetchTimes)) : null,
            isStale: shown.some((source) => source.isStale),
            activities: buildActivityOutlooks(weather?.days ?? null, marine?.days ?? null),
        };
    }
}

async function orUnavailable<TDay>(
    conditions: Promise<DailyConditions<TDay>>,
): Promise<DailyConditions<TDay> | null> {
    try {
        return await conditions;
    } catch (err) {
        if (err instanceof UpstreamUnavailableError) {
            console.warn(err);
            return null;
        }
        throw err;
    }
}
