import type { Location } from '../providers/GeocodingProvider.js';
import type { MarineDay, MarineProvider } from '../providers/MarineProvider.js';
import type { MarineConditionsRepository } from '../repositories/MarineConditionsRepository.js';
import type { Clock } from '../time.js';
import { CachedDailyConditions, type DailyConditions } from './CachedDailyConditions.js';

export type MarineConditions = DailyConditions<MarineDay>;

export class MarineService {
    private readonly conditions: CachedDailyConditions<MarineDay>;

    constructor(provider: MarineProvider, repository: MarineConditionsRepository, clock: Clock) {
        this.conditions = new CachedDailyConditions<MarineDay>(
            {
                fetch: (location) => provider.fetchMarine(location.latitude, location.longitude),
                getState: (locationId) => repository.getMarineState(locationId),
                save: (locationId, forecast, fetchedAt) =>
                    repository.saveMarine(locationId, forecast.days, fetchedAt, forecast.timezone),
                findDays: (locationId, fromDate) => repository.findMarineDays(locationId, fromDate),
            },
            clock,
        );
    }

    getMarineConditions(location: Location): Promise<MarineConditions> {
        return this.conditions.get(location);
    }
}
