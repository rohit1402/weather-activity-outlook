import type { ForecastProvider, WeatherDay } from '../providers/ForecastProvider.js';
import type { Location } from '../providers/GeocodingProvider.js';
import type { WeatherConditionsRepository } from '../repositories/WeatherConditionsRepository.js';
import type { Clock } from '../time.js';
import { CachedDailyConditions, type DailyConditions } from './CachedDailyConditions.js';

export type ForecastConditions = DailyConditions<WeatherDay>;

export class ForecastService {
    private readonly conditions: CachedDailyConditions<WeatherDay>;

    constructor(provider: ForecastProvider, repository: WeatherConditionsRepository, clock: Clock) {
        this.conditions = new CachedDailyConditions<WeatherDay>(
            {
                fetch: (location) => provider.fetchForecast(location.latitude, location.longitude),
                getState: (locationId) => repository.getWeatherState(locationId),
                save: (locationId, forecast, fetchedAt) =>
                    repository.saveWeather(locationId, forecast.days, fetchedAt, forecast.timezone),
                findDays: (locationId, fromDate) =>
                    repository.findWeatherDays(locationId, fromDate),
            },
            clock,
        );
    }

    getForecastConditions(location: Location): Promise<ForecastConditions> {
        return this.conditions.get(location);
    }
}
