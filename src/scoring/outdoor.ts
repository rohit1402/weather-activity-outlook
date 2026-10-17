import { OUTDOOR } from './config.js';
import {
    findTier,
    formatNumber,
    isThunderstorm,
    missingData,
    rainAmount,
    requireFields,
    Tally,
} from './helpers.js';
import type { DayConditions, DayScore } from './types.js';

/** Starts at 100 and subtracts. */
export function scoreOutdoor({ weather }: DayConditions): DayScore {
    const w = requireFields(weather, [
        'precipitation',
        'snowfall',
        'tempMax',
        'windSpeedMax',
        'weatherCode',
    ]);
    if (!w) return missingData();

    const tally = new Tally(OUTDOOR.start);

    const rain = rainAmount(w.precipitation, w.snowfall);
    const rainTier = findTier(rain, OUTDOOR.rainMm);
    if (rainTier) tally.add(rainTier.points, `${rainTier.label} (${formatNumber(rain)} mm)`);

    if (w.snowfall >= OUTDOOR.snowfallCm) {
        tally.add(OUTDOOR.snowfallPoints, `Snowfall (${formatNumber(w.snowfall)} cm)`);
    }

    const degreesOutside =
        w.tempMax < OUTDOOR.comfortableMinC
            ? OUTDOOR.comfortableMinC - w.tempMax
            : Math.max(0, w.tempMax - OUTDOOR.comfortableMaxC);
    if (degreesOutside > 0) {
        const penalty = Math.max(
            degreesOutside * OUTDOOR.pointsPerDegree,
            OUTDOOR.maxTemperaturePenalty,
        );
        const feel = w.tempMax < OUTDOOR.comfortableMinC ? 'Cold weather' : 'Hot weather';
        tally.add(penalty, `${feel} (max ${formatNumber(w.tempMax)} °C)`);
    }

    if (w.windSpeedMax >= OUTDOOR.windKmh) {
        tally.add(OUTDOOR.windPoints, `Strong wind (${formatNumber(w.windSpeedMax)} km/h)`);
    }

    if (isThunderstorm(w.weatherCode)) {
        tally.add(OUTDOOR.thunderstormPoints, 'Possible thunderstorms');
    }

    return tally.result();
}
