import { describe, expect, it } from 'vitest';
import { scoreSurfing, surfingApplicability } from '../../../src/scoring/surfing.js';
import { day, marineDay } from '../../helpers/days.js';

const calm = { windSpeedMax: 10, weatherCode: 1 };

describe('scoreSurfing', () => {
    it.each([
        [0.4, 10, 'Waves too small (0.4 m)'],
        [0.5, 40, 'Small waves (0.5 m)'],
        [1.0, 60, 'Decent waves (1 m)'],
        [1.5, 80, 'Good waves (1.5 m)'],
        [2.5, 60, 'Big waves (2.5 m)'],
        [3.5, 20, 'Dangerously big waves (3.5 m)'],
    ])('puts waves of %f m in the right tier (%i points)', (height, score, reason) => {
        expect(scoreSurfing(day(calm, { waveHeightMax: height, wavePeriodMax: 6 }))).toEqual({
            score,
            reasons: [reason],
        });
    });

    it('scores 1.0 m waves at 12 s as 60 + 20', () => {
        expect(scoreSurfing(day(calm, { waveHeightMax: 1.0, wavePeriodMax: 12 }))).toEqual({
            score: 80,
            reasons: ['Decent waves (1 m)', 'Long, well-spaced swell (12 s)'],
        });
    });

    it('gives a period of exactly 10 s the bonus, and 9.9 s none', () => {
        expect(scoreSurfing(day(calm, { waveHeightMax: 2, wavePeriodMax: 10 })).score).toBe(100);
        expect(scoreSurfing(day(calm, { waveHeightMax: 2, wavePeriodMax: 9.9 }))).toEqual({
            score: 80,
            reasons: ['Good waves (2 m)'],
        });
    });

    it('gives waves of 3.5 m or more no period bonus', () => {
        expect(scoreSurfing(day(calm, { waveHeightMax: 3.5, wavePeriodMax: 14 }))).toEqual({
            score: 20,
            reasons: ['Dangerously big waves (3.5 m)'],
        });
    });

    it('penalizes wind of 30 km/h or more', () => {
        expect(scoreSurfing(day({ ...calm, windSpeedMax: 29.9 }, { wavePeriodMax: 6 }))).toEqual({
            score: 60,
            reasons: ['Decent waves (1.2 m)'],
        });
        expect(scoreSurfing(day({ ...calm, windSpeedMax: 30 }, { wavePeriodMax: 6 }))).toEqual({
            score: 40,
            reasons: ['Decent waves (1.2 m)', 'Strong wind (30 km/h) makes waves choppy'],
        });
    });

    it('sets a thunderstorm day to 0', () => {
        expect(scoreSurfing(day({ ...calm, weatherCode: 96 }, {}))).toEqual({
            score: 0,
            reasons: ['Thunderstorms likely, unsafe in the water'],
        });
    });

    it('scores on waves alone when the forecast is missing', () => {
        expect(scoreSurfing(day(null, { waveHeightMax: 2, wavePeriodMax: 12 }))).toEqual({
            score: 100,
            reasons: [
                'Good waves (2 m)',
                'Long, well-spaced swell (12 s)',
                'No wind or storm forecast available',
            ],
        });
    });

    it.each([
        ['wave height', day(calm, { waveHeightMax: null })],
        ['wave period', day(calm, { wavePeriodMax: null })],
        ['all marine data', day(calm, null)],
        ['wind (forecast present)', day({ ...calm, windSpeedMax: null }, {})],
        ['weather code (forecast present)', day({ ...calm, weatherCode: null }, {})],
    ])('gives "Missing data" when %s is null', (_label, conditions) => {
        expect(scoreSurfing(conditions)).toEqual({ score: null, reasons: ['Missing data'] });
    });
});

describe('surfingApplicability', () => {
    const noWaves = marineDay({ waveHeightMax: null, wavePeriodMax: null });

    it('is not applicable when every wave value in the window is null', () => {
        expect(surfingApplicability([noWaves, noWaves, null])).toEqual({
            applicable: false,
            reason: 'No marine data, likely inland',
        });
    });

    it('is applicable when any day has wave data', () => {
        expect(surfingApplicability([noWaves, marineDay()])).toEqual({ applicable: true });
    });

    it('is applicable for an empty window (data unavailable, not absent)', () => {
        expect(surfingApplicability([])).toEqual({ applicable: true });
    });
});
