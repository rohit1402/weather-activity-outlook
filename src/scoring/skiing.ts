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
import type { DayConditions, DayScore } from './types.js';

/** Never "not applicable" (DECISIONS.md, Point 7): a place without snow scores 0. */
export function scoreSkiing({ weather }: DayConditions): DayScore {
    const w = requireFields(weather, [
        'snowfall',
        'snowDepthMax',
        'tempMax',
        'precipitation',
        'weatherCode',
    ]);
    if (!w) return missingData();

    if (isThunderstorm(w.weatherCode)) {
        return fixedScore(0, `score 0: thunderstorm possible (code ${w.weatherCode})`);
    }
    if (w.snowfall < SKIING.minSnowCm && w.snowDepthMax < SKIING.minSnowDepthCm) {
        return fixedScore(0, 'score 0: no snow');
    }

    const tally = new Tally();
    if (w.snowDepthMax >= SKIING.minSnowDepthCm) {
        tally.add(
            SKIING.snowOnGroundPoints,
            `snow on the ground (${formatNumber(w.snowDepthMax)} cm)`,
        );
    }
    if (w.snowfall >= SKIING.minSnowCm) {
        tally.add(SKIING.freshSnowPoints, `fresh snow (${formatNumber(w.snowfall)} cm)`);
    }

    if (w.tempMax <= SKIING.freezingC) {
        tally.add(SKIING.freezingPoints, `max ${formatNumber(w.tempMax)} °C`);
    } else if (w.tempMax > SKIING.slushAboveC) {
        tally.add(SKIING.slushPoints, `slush: max ${formatNumber(w.tempMax)} °C`);
    }

    const rain = rainAmount(w.precipitation, w.snowfall);
    if (rain > SKIING.rainOverMm) {
        tally.add(SKIING.rainPoints, `rain ${formatNumber(rain)} mm`);
    }

    return tally.result();
}
