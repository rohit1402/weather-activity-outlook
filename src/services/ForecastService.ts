import { UpstreamUnavailableError } from '../errors.js';
import type { ForecastProvider, WeatherDay } from '../providers/ForecastProvider.js';
import type { Location } from '../providers/GeocodingProvider.js';
import type { WeatherConditionsRepository } from '../repositories/WeatherConditionsRepository.js';
import { localDate, type Clock } from '../time.js';

export interface ForecastConditions {
    days: WeatherDay[];
    fetchedAt: Date;
    isStale: boolean;
}

const HOUR_MS = 60 * 60 * 1000;

export class ForecastService {
    static readonly REFRESH_AFTER_MS = 3 * HOUR_MS;
    static readonly MAX_STALE_MS = 48 * HOUR_MS;

    constructor(
        private readonly provider: ForecastProvider,
        private readonly repository: WeatherConditionsRepository,
        private readonly clock: Clock,
    ) {}

    async getForecastConditions(location: Location): Promise<ForecastConditions> {
        const now = this.clock.now();
        const saved = this.repository.getWeatherState(location.id);
        const timezone = saved.timezone ?? location.timezone;
        const age = saved.fetchedAt ? now.getTime() - saved.fetchedAt.getTime() : Infinity;

        if (saved.fetchedAt && age < ForecastService.REFRESH_AFTER_MS) {
            return this.read(location.id, timezone, now, saved.fetchedAt, false);
        }

        try {
            const forecast = await this.provider.fetchForecast(
                location.latitude,
                location.longitude,
            );
            this.repository.saveWeather(location.id, forecast.days, now, forecast.timezone);
            return this.read(location.id, timezone ?? forecast.timezone, now, now, false);
        } catch (err) {
            if (
                err instanceof UpstreamUnavailableError &&
                saved.fetchedAt &&
                age < ForecastService.MAX_STALE_MS
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
    ): ForecastConditions {
        const today = localDate(now, timezone ?? 'UTC');
        return { days: this.repository.findWeatherDays(locationId, today), fetchedAt, isStale };
    }
}
