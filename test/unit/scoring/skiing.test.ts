import { describe, expect, it } from 'vitest';
import { scoreSkiing, skiingApplicability } from '../../../src/scoring/skiing.js';
import { day, weatherDay } from '../../helpers/days.js';

const powder = {
    snowDepthMax: 35,
    snowfall: 8,
    tempMax: -2,
    precipitation: 6,
    weatherCode: 73,
};

describe('scoreSkiing', () => {
    it('scores a powder day 100, with a reason per rule', () => {
        expect(scoreSkiing(day(powder))).toEqual({
            score: 100,
            reasons: [
                '35 cm of snow on the ground',
                '8 cm of fresh snow',
                'Freezing temperatures (max -2 °C)',
            ],
        });
    });

    it('does not count the snow as rain', () => {
        // The 6 mm of precipitation fell as 8 cm of snow, so there's no rain reason.
        expect(scoreSkiing(day(powder)).reasons.some((r) => r.includes('Rain'))).toBe(false);
    });

    it('sets a thunderstorm day to 0, whatever the snow', () => {
        expect(scoreSkiing(day({ ...powder, weatherCode: 95 }))).toEqual({
            score: 0,
            reasons: ['Thunderstorms likely, unsafe on the slopes'],
        });
    });

    it('scores 0 with under 1 cm of snowfall and under 10 cm on the ground', () => {
        expect(scoreSkiing(day({ ...powder, snowfall: 0.9, snowDepthMax: 9.9 }))).toEqual({
            score: 0,
            reasons: ['Not enough snow'],
        });
    });

    it('counts exactly 10 cm on the ground and exactly 1 cm of fresh snow', () => {
        expect(
            scoreSkiing(day({ ...powder, snowDepthMax: 10, snowfall: 0, precipitation: 0 })),
        ).toEqual({
            score: 70,
            reasons: ['10 cm of snow on the ground', 'Freezing temperatures (max -2 °C)'],
        });
        expect(
            scoreSkiing(day({ ...powder, snowDepthMax: 0, snowfall: 1, precipitation: 0 })),
        ).toEqual({
            score: 50,
            reasons: ['1 cm of fresh snow', 'Freezing temperatures (max -2 °C)'],
        });
    });

    it.each([
        [0, ['Freezing temperatures (max 0 °C)']],
        [3, []],
        [3.1, ['Too warm, snow turns to slush (max 3.1 °C)']],
    ])('scores max %f °C', (tempMax, tempReasons) => {
        expect(scoreSkiing(day({ ...powder, tempMax })).reasons).toEqual([
            '35 cm of snow on the ground',
            '8 cm of fresh snow',
            ...tempReasons,
        ]);
    });

    it('penalizes rain over 1 mm, and clamps to 0', () => {
        // +30 fresh snow, −20 slush, −30 rain (20 − 5 ÷ 0.7 = 12.9 mm) = −20 → 0.
        const wet = {
            snowDepthMax: 0,
            snowfall: 5,
            tempMax: 5,
            precipitation: 20,
            weatherCode: 63,
        };
        expect(scoreSkiing(day(wet))).toEqual({
            score: 0,
            reasons: [
                '5 cm of fresh snow',
                'Too warm, snow turns to slush (max 5 °C)',
                'Rain (12.9 mm)',
            ],
        });
    });

    it('does not penalize exactly 1 mm of rain', () => {
        expect(scoreSkiing(day({ ...powder, snowfall: 0, precipitation: 1 })).reasons).toEqual([
            '35 cm of snow on the ground',
            'Freezing temperatures (max -2 °C)',
        ]);
    });

    it.each(['snowfall', 'snowDepthMax', 'tempMax', 'precipitation', 'weatherCode'] as const)(
        'gives "Missing data" when %s is null',
        (field) => {
            expect(scoreSkiing(day({ ...powder, [field]: null }))).toEqual({
                score: null,
                reasons: ['Missing data'],
            });
        },
    );

    it('ignores fields it does not need, such as wind', () => {
        expect(scoreSkiing(day({ ...powder, windSpeedMax: null })).score).toBe(100);
    });

    it('gives "Missing data" when there is no weather data at all', () => {
        expect(scoreSkiing(day(null))).toEqual({ score: null, reasons: ['Missing data'] });
    });
});

describe('skiingApplicability', () => {
    const snowless = weatherDay({ snowfall: 0.9, snowDepthMax: 9.9 });

    it('is not applicable when no day in the window has snow', () => {
        expect(skiingApplicability([snowless, snowless, snowless])).toEqual({
            applicable: false,
            reason: 'Not enough snow forecast this week',
        });
    });

    it.each([
        ['1 cm of fresh snow', weatherDay({ snowfall: 1, snowDepthMax: 0 })],
        ['10 cm on the ground', weatherDay({ snowfall: 0, snowDepthMax: 10 })],
    ])('is applicable when one day has %s', (_label, snowyDay) => {
        expect(skiingApplicability([snowless, snowyDay, snowless])).toEqual({ applicable: true });
    });

    it('is applicable when a day has unknown snow data (it might have snow)', () => {
        const unknown = weatherDay({ snowfall: null });
        expect(skiingApplicability([snowless, unknown])).toEqual({ applicable: true });
    });

    it('is applicable for an empty window (data unavailable, not absent)', () => {
        expect(skiingApplicability([])).toEqual({ applicable: true });
    });
});
