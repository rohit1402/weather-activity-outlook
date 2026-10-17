import { INDOOR } from './config.js';
import { formatNumber, missingData } from './helpers.js';
import type { DayScore } from './types.js';

/**
 * indoor = 40 + 0.6 × (100 − outdoor), from the day's outdoor result. Never "not applicable"
 * (DECISIONS.md, Point 8); "missing data" when the outdoor score is.
 */
export function scoreIndoor(outdoor: DayScore): DayScore {
    if (outdoor.score === null) return missingData();
    const score = INDOOR.base + INDOOR.factor * (100 - outdoor.score);
    return {
        score: Math.round(score),
        reasons: [
            `${INDOOR.base} + ${INDOOR.factor} × (100 − outdoor ${outdoor.score}) = ${formatNumber(score)}`,
        ],
    };
}
