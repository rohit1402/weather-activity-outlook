export interface DayScore {
    score: number | null;
    reasons: string[];
}

export const MISSING_DATA = 'Missing data';

export type Applicability = { applicable: true } | { applicable: false; reason: string };
