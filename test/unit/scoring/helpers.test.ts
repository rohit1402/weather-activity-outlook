import { describe, expect, it } from 'vitest';
import {
    clamp,
    findTier,
    inRange,
    isThunderstorm,
    rainAmount,
    rankDays,
    requireFields,
    Tally,
} from '../../../src/scoring/helpers.js';

describe('inRange / findTier', () => {
    it('includes the lower bound and excludes the upper', () => {
        expect(inRange(1, { min: 1, max: 1.5 })).toBe(true);
        expect(inRange(1.5, { min: 1, max: 1.5 })).toBe(false);
        expect(inRange(0.99, { min: 1, max: 1.5 })).toBe(false);
    });

    it('treats a missing bound as open', () => {
        expect(inRange(-50, { max: 0.5 })).toBe(true);
        expect(inRange(1000, { min: 3.5 })).toBe(true);
    });

    it('puts a value on a boundary in the higher tier', () => {
        const tiers = [
            { min: 1, max: 5, points: -20 },
            { min: 5, points: -40 },
        ];
        expect(findTier(5, tiers)?.points).toBe(-40);
        expect(findTier(0.5, tiers)).toBeUndefined();
    });
});

describe('isThunderstorm', () => {
    it.each([
        [94, false],
        [95, true],
        [97, true],
        [99, true],
        [100, false],
        [3, false],
    ])('code %i -> %s', (code, expected) => {
        expect(isThunderstorm(code)).toBe(expected);
    });
});

describe('rainAmount', () => {
    it('does not count snow as rain', () => {
        // 8 cm of snow is about 11.4 mm of water, more than the 6 mm of precipitation.
        expect(rainAmount(6, 8)).toBe(0);
    });

    it('keeps the rain part of a mixed rain-and-snow day', () => {
        // 1.4 cm of snow is 2 mm of water, so 5 − 2 = 3 mm of rain.
        expect(rainAmount(5, 1.4)).toBeCloseTo(3);
    });

    it('is all precipitation when there is no snow', () => {
        expect(rainAmount(4, 0)).toBe(4);
    });
});

describe('requireFields', () => {
    const day = { a: 1, b: null as number | null, c: 'x' };

    it('returns the object when every needed field is set', () => {
        expect(requireFields(day, ['a', 'c'])).toBe(day);
    });

    it('returns null when a needed field is null', () => {
        expect(requireFields(day, ['a', 'b'])).toBeNull();
    });

    it('returns null when the object itself is null', () => {
        expect(requireFields(null as typeof day | null, ['a'])).toBeNull();
    });
});

describe('clamp and Tally', () => {
    it('clamps to 0–100', () => {
        expect(clamp(-50)).toBe(0);
        expect(clamp(130)).toBe(100);
        expect(clamp(42)).toBe(42);
    });

    it('clamps and rounds once at the end, keeping every reason', () => {
        const result = new Tally(10).add(-7.8, 'cold').add(-20, 'wind').note('a note').result();
        expect(result).toEqual({ score: 0, reasons: ['−7.8 cold', '−20 wind', 'a note'] });
    });

    it('rounds the final score to a whole number', () => {
        expect(new Tally(100).add(-7.6, 'cold').result().score).toBe(92);
    });
});

describe('rankDays', () => {
    it('ranks by score, 1 is best, and returns days in date order', () => {
        const ranked = rankDays([
            { date: '2026-10-19', score: 40 },
            { date: '2026-10-17', score: 90 },
            { date: '2026-10-18', score: 60 },
        ]);
        expect(ranked).toEqual([
            { date: '2026-10-17', score: 90, rank: 1 },
            { date: '2026-10-18', score: 60, rank: 2 },
            { date: '2026-10-19', score: 40, rank: 3 },
        ]);
    });

    it('gives ties to the earlier date', () => {
        const ranked = rankDays([
            { date: '2026-10-19', score: 80 },
            { date: '2026-10-18', score: 80 },
            { date: '2026-10-17', score: 50 },
        ]);
        expect(ranked.map((d) => [d.date, d.rank])).toEqual([
            ['2026-10-17', 3],
            ['2026-10-18', 1],
            ['2026-10-19', 2],
        ]);
    });

    it('leaves days with a null score unranked, without a gap in the ranks', () => {
        const ranked = rankDays([
            { date: '2026-10-17', score: null },
            { date: '2026-10-18', score: 70 },
            { date: '2026-10-19', score: 30 },
        ]);
        expect(ranked.map((d) => d.rank)).toEqual([null, 1, 2]);
    });
});
