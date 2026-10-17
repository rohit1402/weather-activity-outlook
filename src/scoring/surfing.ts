import type { MarineDay } from '../providers/MarineProvider.js';
import { SURFING } from './config.js';
import {
    findTier,
    fixedScore,
    formatNumber,
    isThunderstorm,
    missingData,
    requireFields,
    Tally,
} from './helpers.js';
import type { Applicability, DayConditions, DayScore } from './types.js';

export const NOT_APPLICABLE_REASON = 'No marine data, likely inland';
export const NO_FORECAST_REASON = 'No wind or storm forecast available';

export type SurfingApplicability = Applicability;

export function surfingApplicability(
    marineDays: readonly (MarineDay | null)[],
): SurfingApplicability {
    const noWaveData = marineDays.every(
        (day) => day === null || (day.waveHeightMax === null && day.wavePeriodMax === null),
    );
    return marineDays.length > 0 && noWaveData
        ? { applicable: false, reason: NOT_APPLICABLE_REASON }
        : { applicable: true };
}

export function scoreSurfing({ marine, weather }: DayConditions): DayScore {
    const waves = requireFields(marine, ['waveHeightMax', 'wavePeriodMax']);
    if (!waves) return missingData();

    const forecast = weather && requireFields(weather, ['windSpeedMax', 'weatherCode']);
    if (weather && !forecast) return missingData();

    if (forecast && isThunderstorm(forecast.weatherCode)) {
        return fixedScore(0, 'Thunderstorms likely, unsafe in the water');
    }

    const height = waves.waveHeightMax;
    const period = waves.wavePeriodMax;
    const tally = new Tally();
    const waveTier = findTier(height, SURFING.waveHeightM)!;
    tally.add(waveTier.points, `${waveTier.label} (${formatNumber(height)} m)`);

    if (period >= SURFING.longPeriodS && height < SURFING.dangerousWaveM) {
        tally.add(SURFING.longPeriodPoints, `Long, well-spaced swell (${formatNumber(period)} s)`);
    }

    if (!forecast) {
        tally.note(NO_FORECAST_REASON);
    } else if (forecast.windSpeedMax >= SURFING.windKmh) {
        tally.add(
            SURFING.windPoints,
            `Strong wind (${formatNumber(forecast.windSpeedMax)} km/h) makes waves choppy`,
        );
    }

    return tally.result();
}
