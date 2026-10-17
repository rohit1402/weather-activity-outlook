import { INDOOR } from './config.js';
import { missingData } from './helpers.js';
import type { DayScore } from './types.js';

export function scoreIndoor(outdoor: DayScore): DayScore {
    if (outdoor.score === null) return missingData();

    const score = INDOOR.base + INDOOR.factor * (100 - outdoor.score);
    const problemsOutside = outdoor.reasons.map((r) => r.charAt(0).toLowerCase() + r.slice(1));
    const reason =
        problemsOutside.length > 0
            ? `Expect ${joinList(problemsOutside)} outside`
            : 'Great weather outside, but indoor sightseeing is still an option';

    return { score: Math.round(score), reasons: [reason] };
}

function joinList(items: string[]): string {
    return items.length <= 1
        ? (items[0] ?? '')
        : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
