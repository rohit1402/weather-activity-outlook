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
import type { DayConditions, DayScore } from './types.js';

export const NOT_APPLICABLE_REASON = 'no marine data, likely inland';
export const NO_FORECAST_REASON = 'wind and storm data unavailable';

export type SurfingApplicability = { applicable: true } | { applicable: false; reason: string };

/**
 * Surfing is "not applicable" when every wave value in the window is null (DECISIONS.md,
 * Point 9). An empty window isn't "not applicable": the data is unavailable, not absent.
 */
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

/**
 * Scored from wave height. When the day's forecast is missing entirely, the day is scored on
 * waves alone (the Point 9 exception); otherwise any null field gives "missing data".
 */
export function scoreSurfing({ marine, weather }: DayConditions): DayScore {
    const waves = requireFields(marine, ['waveHeightMax', 'wavePeriodMax']);
    if (!waves) return missingData();

    const forecast = weather && requireFields(weather, ['windSpeedMax', 'weatherCode']);
    if (weather && !forecast) return missingData();

    if (forecast && isThunderstorm(forecast.weatherCode)) {
        return fixedScore(0, `score 0: thunderstorm possible (code ${forecast.weatherCode})`);
    }

    const height = waves.waveHeightMax;
    const period = waves.wavePeriodMax;
    const tally = new Tally();
    tally.add(findTier(height, SURFING.waveHeightM)!.points, `waves ${formatNumber(height)} m`);

    if (period >= SURFING.longPeriodS) {
        if (height >= SURFING.dangerousWaveM) {
            tally.note(`no period bonus: waves of ${formatNumber(height)} m are dangerous`);
        } else {
            tally.add(SURFING.longPeriodPoints, `wave period ${formatNumber(period)} s`);
        }
    }

    if (!forecast) {
        tally.note(NO_FORECAST_REASON);
    } else if (forecast.windSpeedMax >= SURFING.windKmh) {
        tally.add(SURFING.windPoints, `wind ${formatNumber(forecast.windSpeedMax)} km/h`);
    }

    return tally.result();
}
