import { describe, expect, it } from 'vitest';
import { scoreOutdoor } from '../../../src/scoring/outdoor.js';
import { day } from '../../helpers/days.js';

describe('scoreOutdoor', () => {
    it('scores a mild, dry, calm day 100 with no reasons', () => {
        expect(scoreOutdoor(day({}))).toEqual({ score: 100, reasons: [] });
    });

    it('scores a grey wet day: rain, cold and wind', () => {
        const wet = { precipitation: 3, tempMax: 12, windSpeedMax: 35, weatherCode: 61 };
        expect(scoreOutdoor(day(wet))).toEqual({
            score: 51,
            reasons: ['Rain (3 mm)', 'Cold weather (max 12 °C)', 'Strong wind (35 km/h)'],
        });
    });

    it.each([
        [0.9, 100, []],
        [1, 80, ['Rain (1 mm)']],
        [5, 60, ['Heavy rain (5 mm)']],
    ])('scores %f mm of rain', (precipitation, score, reasons) => {
        expect(scoreOutdoor(day({ precipitation }))).toEqual({ score, reasons });
    });

    it('does not count snow as rain, and penalizes the snow once', () => {
        // 7 mm of precipitation fell as 10 cm of snow: −20 for snow, no rain penalty.
        expect(scoreOutdoor(day({ precipitation: 7, snowfall: 10 }))).toEqual({
            score: 80,
            reasons: ['Snowfall (10 cm)'],
        });
    });

    it('penalizes snowfall of exactly 1 cm', () => {
        expect(scoreOutdoor(day({ snowfall: 1 })).reasons).toEqual(['Snowfall (1 cm)']);
    });

    it.each([
        [15, 100, []],
        [28, 100, []],
        [12.4, 92, ['Cold weather (max 12.4 °C)']],
        [31, 91, ['Hot weather (max 31 °C)']],
        [-10, 60, ['Cold weather (max -10 °C)']],
    ])('scores max %f °C', (tempMax, score, reasons) => {
        expect(scoreOutdoor(day({ tempMax }))).toEqual({ score, reasons });
    });

    it('penalizes wind of 30 km/h or more', () => {
        expect(scoreOutdoor(day({ windSpeedMax: 29.9 })).score).toBe(100);
        expect(scoreOutdoor(day({ windSpeedMax: 30 }))).toEqual({
            score: 80,
            reasons: ['Strong wind (30 km/h)'],
        });
    });

    it('penalizes a thunderstorm', () => {
        expect(scoreOutdoor(day({ weatherCode: 95 }))).toEqual({
            score: 70,
            reasons: ['Possible thunderstorms'],
        });
    });

    it('no longer penalizes fog or cloud cover', () => {
        expect(scoreOutdoor(day({ weatherCode: 45, cloudCover: 100 }))).toEqual({
            score: 100,
            reasons: [],
        });
    });

    it('clamps to 0 on a terrible day', () => {
        const terrible = { precipitation: 30, tempMax: -5, windSpeedMax: 80, weatherCode: 95 };
        expect(scoreOutdoor(day(terrible))).toEqual({
            score: 0,
            reasons: [
                'Heavy rain (30 mm)',
                'Cold weather (max -5 °C)',
                'Strong wind (80 km/h)',
                'Possible thunderstorms',
            ],
        });
    });

    it.each(['precipitation', 'snowfall', 'tempMax', 'windSpeedMax', 'weatherCode'] as const)(
        'gives "Missing data" when %s is null',
        (field) => {
            expect(scoreOutdoor(day({ [field]: null }))).toEqual({
                score: null,
                reasons: ['Missing data'],
            });
        },
    );

    it('ignores fields it does not need, such as cloud cover', () => {
        expect(scoreOutdoor(day({ cloudCover: null })).score).toBe(100);
    });
});
