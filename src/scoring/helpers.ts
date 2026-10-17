import { SCORE_MAX, SCORE_MIN, SNOW_CM_PER_MM, THUNDERSTORM_CODES, type Tier } from './config.js';
import { MISSING_DATA, type DayScore } from './types.js';

export function clamp(value: number, min = SCORE_MIN, max = SCORE_MAX): number {
    return Math.min(max, Math.max(min, value));
}

export function inRange(value: number, { min, max }: { min?: number; max?: number }): boolean {
    return (min === undefined || value >= min) && (max === undefined || value < max);
}

export function findTier<T extends Tier>(value: number, tiers: readonly T[]): T | undefined {
    return tiers.find((tier) => inRange(value, tier));
}

export function isThunderstorm(weatherCode: number): boolean {
    return weatherCode >= THUNDERSTORM_CODES.min && weatherCode <= THUNDERSTORM_CODES.max;
}

export function rainAmount(precipitation: number, snowfall: number): number {
    return Math.max(0, precipitation - snowfall / SNOW_CM_PER_MM);
}

type Required<T, K extends keyof T> = { [P in K]: NonNullable<T[P]> };

export function requireFields<T extends object, K extends keyof T>(
    source: T | null,
    fields: readonly K[],
): Required<T, K> | null {
    if (source === null) return null;
    return fields.every((field) => source[field] !== null && source[field] !== undefined)
        ? (source as unknown as Required<T, K>)
        : null;
}

export function formatNumber(value: number): string {
    return String(Math.round(value * 10) / 10);
}

export const missingData = (): DayScore => ({ score: null, reasons: [MISSING_DATA] });

export function fixedScore(score: number, reason: string): DayScore {
    return { score, reasons: [reason] };
}

export class Tally {
    private total: number;
    private readonly reasons: string[] = [];

    constructor(start = 0) {
        this.total = start;
    }

    add(points: number, reason: string): this {
        this.total += points;
        this.reasons.push(reason);
        return this;
    }

    note(reason: string): this {
        this.reasons.push(reason);
        return this;
    }

    result(): DayScore {
        return { score: Math.round(clamp(this.total)), reasons: this.reasons };
    }
}

export function rankDays<T extends { date: string; score: number | null }>(
    days: readonly T[],
): (T & { rank: number | null })[] {
    const ranked = days
        .filter((day): day is T & { score: number } => day.score !== null)
        .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
    const rankByDate = new Map(ranked.map((day, i) => [day.date, i + 1]));

    return [...days]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((day) => ({ ...day, rank: rankByDate.get(day.date) ?? null }));
}
