import type { WeatherDay } from '../providers/ForecastProvider.js';
import type { MarineDay } from '../providers/MarineProvider.js';

export interface DayConditions {
    date: string;
    weather: WeatherDay | null;
    marine: MarineDay | null;
}

export interface DayScore {
    score: number | null;
    reasons: string[];
}

export const MISSING_DATA = 'Missing data';
