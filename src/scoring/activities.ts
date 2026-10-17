import type { WeatherDay } from '../providers/ForecastProvider.js';
import type { MarineDay } from '../providers/MarineProvider.js';
import { rankDays } from './helpers.js';
import { scoreIndoor } from './indoor.js';
import { scoreOutdoor } from './outdoor.js';
import { scoreSkiing, skiingApplicability } from './skiing.js';
import { scoreSurfing, surfingApplicability } from './surfing.js';
import type { Applicability, DayScore } from './types.js';

export type Activity = 'SKIING' | 'SURFING' | 'OUTDOOR_SIGHTSEEING' | 'INDOOR_SIGHTSEEING';
export type ActivityStatus = 'AVAILABLE' | 'NOT_APPLICABLE' | 'UNAVAILABLE';

export interface RankedDay extends DayScore {
    date: string;
    rank: number | null;
}

export interface ActivityOutlook {
    activity: Activity;
    status: ActivityStatus;
    reason: string | null;
    days: RankedDay[];
}

export const WEATHER_UNAVAILABLE = 'Weather forecast unavailable';
export const MARINE_UNAVAILABLE = 'Marine forecast unavailable';

export function buildActivityOutlooks(
    weatherDays: WeatherDay[] | null,
    marineDays: MarineDay[] | null,
): ActivityOutlook[] {
    return [
        weatherActivity('SKIING', weatherDays, scoreSkiing, skiingApplicability),
        surfingOutlook(weatherDays, marineDays),
        weatherActivity('OUTDOOR_SIGHTSEEING', weatherDays, scoreOutdoor),
        weatherActivity('INDOOR_SIGHTSEEING', weatherDays, (weather) =>
            scoreIndoor(scoreOutdoor(weather)),
        ),
    ];
}

function weatherActivity(
    activity: Activity,
    weatherDays: WeatherDay[] | null,
    score: (weather: WeatherDay) => DayScore,
    applicability?: (days: WeatherDay[]) => Applicability,
): ActivityOutlook {
    if (weatherDays === null) return unavailable(activity, WEATHER_UNAVAILABLE);

    const check = applicability?.(weatherDays);
    if (check && !check.applicable) return notApplicable(activity, check.reason);

    return available(
        activity,
        weatherDays.map((weather) => ({ date: weather.date, ...score(weather) })),
    );
}

function surfingOutlook(
    weatherDays: WeatherDay[] | null,
    marineDays: MarineDay[] | null,
): ActivityOutlook {
    if (marineDays === null) return unavailable('SURFING', MARINE_UNAVAILABLE);

    const applicability = surfingApplicability(marineDays);
    if (!applicability.applicable) return notApplicable('SURFING', applicability.reason);

    return available(
        'SURFING',
        marineDays.map((marine) => {
            const weather = weatherDays?.find((w) => w.date === marine.date) ?? null;
            return { date: marine.date, ...scoreSurfing(marine, weather) };
        }),
    );
}

function available(activity: Activity, days: (DayScore & { date: string })[]): ActivityOutlook {
    return { activity, status: 'AVAILABLE', reason: null, days: rankDays(days) };
}

function notApplicable(activity: Activity, reason: string): ActivityOutlook {
    return { activity, status: 'NOT_APPLICABLE', reason, days: [] };
}

function unavailable(activity: Activity, reason: string): ActivityOutlook {
    return { activity, status: 'UNAVAILABLE', reason, days: [] };
}
