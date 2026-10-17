import type { Clock } from '../../src/time.js';

const HOUR_MS = 60 * 60 * 1000;

/** A clock that only moves when the test moves it. */
export class FakeClock implements Clock {
    private current: Date;

    constructor(iso: string) {
        this.current = new Date(iso);
    }

    now(): Date {
        return new Date(this.current);
    }

    advanceHours(hours: number): void {
        this.current = new Date(this.current.getTime() + hours * HOUR_MS);
    }
}
