export interface Clock {
    now(): Date;
}

export const systemClock: Clock = {
    now: () => new Date(),
};

export function localDate(instant: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(instant);
}
