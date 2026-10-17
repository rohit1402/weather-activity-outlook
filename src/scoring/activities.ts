import type { WeatherDay } from '../providers/ForecastProvider.js';
import type { MarineDay } from '../providers/MarineProvider.js';
import { rankDays } from './helpers.js';
import { scoreIndoor } from './indoor.js';
import { scoreOutdoor } from './outdoor.js';
import { scoreSkiing, skiingApplicability } from './skiing.js';
import { scoreSurfing, surfingApplicability } from './surfing.js';
import type { Applicability, DayConditions, DayScore } from './types.js';

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
        weatherActivity('SKIING', weatherDays, marineDays, scoreSkiing, skiingApplicability),
        surfingOutlook(weatherDays, marineDays),
        weatherActivity('OUTDOOR_SIGHTSEEING', weatherDays, marineDays, scoreOutdoor),
        weatherActivity('INDOOR_SIGHTSEEING', weatherDays, marineDays, (day) =>
            scoreIndoor(scoreOutdoor(day)),
        ),
    ];
}

function weatherActivity(
    activity: Activity,
    weatherDays: WeatherDay[] | null,
    marineDays: MarineDay[] | null,
    score: (day: DayConditions) => DayScore,
    applicability?: (days: WeatherDay[]) => Applicability,
): ActivityOutlook {
    if (weatherDays === null) return unavailable(activity, WEATHER_UNAVAILABLE);

    const check = applicability?.(weatherDays);
    if (check && !check.applicable) return notApplicable(activity, check.reason);

    const days = weatherDays.map((weather) => ({
        date: weather.date,
        weather,
        marine: marineDays?.find((m) => m.date === weather.date) ?? null,
    }));
    return available(activity, days, score);
}

function surfingOutlook(
    weatherDays: WeatherDay[] | null,
    marineDays: MarineDay[] | null,
): ActivityOutlook {
    if (marineDays === null) return unavailable('SURFING', MARINE_UNAVAILABLE);

    const applicability = surfingApplicability(marineDays);
    if (!applicability.applicable) return notApplicable('SURFING', applicability.reason);

    const days = marineDays.map((marine) => ({
        date: marine.date,
        marine,
        weather: weatherDays?.find((w) => w.date === marine.date) ?? null,
    }));
    return available('SURFING', days, scoreSurfing);
}

function available(
    activity: Activity,
    days: DayConditions[],
    score: (day: DayConditions) => DayScore,
): ActivityOutlook {
    const scored = days.map((day) => ({ date: day.date, ...score(day) }));
    return { activity, status: 'AVAILABLE', reason: null, days: rankDays(scored) };
}

function notApplicable(activity: Activity, reason: string): ActivityOutlook {
    return { activity, status: 'NOT_APPLICABLE', reason, days: [] };
}

function unavailable(activity: Activity, reason: string): ActivityOutlook {
    return { activity, status: 'UNAVAILABLE', reason, days: [] };
}
