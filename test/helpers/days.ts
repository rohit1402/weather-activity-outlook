import type { WeatherDay } from '../../src/providers/ForecastProvider.js';
import type { MarineDay } from '../../src/providers/MarineProvider.js';
import type { DayConditions } from '../../src/scoring/types.js';

const DATE = '2026-10-17';

/** A calm, mild, dry day with no snow; override only what a test is about. */
export function weatherDay(overrides: Partial<WeatherDay> = {}): WeatherDay {
    return {
        date: DATE,
        tempMax: 20,
        tempMin: 10,
        precipitation: 0,
        precipitationProbability: 0,
        snowfall: 0,
        windSpeedMax: 10,
        weatherCode: 1,
        cloudCover: 20,
        snowDepthMax: 0,
        ...overrides,
    };
}

export function marineDay(overrides: Partial<MarineDay> = {}): MarineDay {
    return { date: DATE, waveHeightMax: 1.2, wavePeriodMax: 11, ...overrides };
}

export function day(
    weather: Partial<WeatherDay> | null,
    marine: Partial<MarineDay> | null = null,
): DayConditions {
    return {
        date: DATE,
        weather: weather === null ? null : weatherDay(weather),
        marine: marine === null ? null : marineDay(marine),
    };
}
