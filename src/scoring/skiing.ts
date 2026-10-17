import { SKIING } from './config.js';
import {
    fixedScore,
    formatNumber,
    isThunderstorm,
    missingData,
    rainAmount,
    requireFields,
    Tally,
} from './helpers.js';
import type { WeatherDay } from '../providers/ForecastProvider.js';
import type { Applicability, DayScore } from './types.js';

export const NO_SNOW_THIS_WEEK = 'Not enough snow forecast this week';

function hasSnow(snowfall: number, snowDepthMax: number): boolean {
    return snowfall >= SKIING.minSnowCm || snowDepthMax >= SKIING.minSnowDepthCm;
}

export function skiingApplicability(weatherDays: readonly WeatherDay[]): Applicability {
    const noSnowAnyDay = weatherDays.every(
        (day) =>
            day.snowfall !== null &&
            day.snowDepthMax !== null &&
            !hasSnow(day.snowfall, day.snowDepthMax),
    );
    return weatherDays.length > 0 && noSnowAnyDay
        ? { applicable: false, reason: NO_SNOW_THIS_WEEK }
        : { applicable: true };
}

export function scoreSkiing(weather: WeatherDay): DayScore {
    const w = requireFields(weather, [
        'snowfall',
        'snowDepthMax',
        'tempMax',
        'precipitation',
        'weatherCode',
    ]);
    if (!w) return missingData();

    if (isThunderstorm(w.weatherCode)) {
        return fixedScore(0, 'Thunderstorms likely, unsafe on the slopes');
    }
    if (!hasSnow(w.snowfall, w.snowDepthMax)) {
        return fixedScore(0, 'Not enough snow');
    }

    const tally = new Tally();
    if (w.snowDepthMax >= SKIING.minSnowDepthCm) {
        tally.add(
            SKIING.snowOnGroundPoints,
            `${formatNumber(w.snowDepthMax)} cm of snow on the ground`,
        );
    }
    if (w.snowfall >= SKIING.minSnowCm) {
        tally.add(SKIING.freshSnowPoints, `${formatNumber(w.snowfall)} cm of fresh snow`);
    }

    if (w.tempMax <= SKIING.freezingC) {
        tally.add(
            SKIING.freezingPoints,
            `Freezing temperatures (max ${formatNumber(w.tempMax)} °C)`,
        );
    } else if (w.tempMax > SKIING.slushAboveC) {
        tally.add(
            SKIING.slushPoints,
            `Too warm, snow turns to slush (max ${formatNumber(w.tempMax)} °C)`,
        );
    }

    const rain = rainAmount(w.precipitation, w.snowfall);
    if (rain > SKIING.rainOverMm) {
        tally.add(SKIING.rainPoints, `Rain (${formatNumber(rain)} mm)`);
    }

    return tally.result();
}
