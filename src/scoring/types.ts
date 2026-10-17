import type { WeatherDay } from '../providers/ForecastProvider.js';
import type { MarineDay } from '../providers/MarineProvider.js';

/** One local date's saved data. A source is null when there is no row for that date. */
export interface DayConditions {
    date: string;
    weather: WeatherDay | null;
    marine: MarineDay | null;
}

/** A scorer's result: score is null when the day can't be scored ("missing data"). */
export interface DayScore {
    score: number | null;
    reasons: string[];
}

export const MISSING_DATA = 'missing data';
