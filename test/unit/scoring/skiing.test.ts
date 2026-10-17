import { describe, expect, it } from 'vitest';
import { scoreSkiing } from '../../../src/scoring/skiing.js';
import { day } from '../../helpers/days.js';

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
            reasons: ['+50 snow on the ground (35 cm)', '+30 fresh snow (8 cm)', '+20 max −2 °C'],
        });
    });

    it('does not count the snow as rain', () => {
        // The 6 mm of precipitation fell as 8 cm of snow, so there's no rain reason.
        expect(scoreSkiing(day(powder)).reasons.some((r) => r.includes('rain'))).toBe(false);
    });

    it('sets a thunderstorm day to 0, whatever the snow', () => {
        expect(scoreSkiing(day({ ...powder, weatherCode: 95 }))).toEqual({
            score: 0,
            reasons: ['score 0: thunderstorm possible (code 95)'],
        });
    });

    it('scores 0 with under 1 cm of snowfall and under 10 cm on the ground', () => {
        expect(scoreSkiing(day({ ...powder, snowfall: 0.9, snowDepthMax: 9.9 }))).toEqual({
            score: 0,
            reasons: ['score 0: no snow'],
        });
    });

    it('counts exactly 10 cm on the ground and exactly 1 cm of fresh snow', () => {
        expect(
            scoreSkiing(day({ ...powder, snowDepthMax: 10, snowfall: 0, precipitation: 0 })),
        ).toEqual({ score: 70, reasons: ['+50 snow on the ground (10 cm)', '+20 max −2 °C'] });
        expect(
            scoreSkiing(day({ ...powder, snowDepthMax: 0, snowfall: 1, precipitation: 0 })),
        ).toEqual({ score: 50, reasons: ['+30 fresh snow (1 cm)', '+20 max −2 °C'] });
    });

    it.each([
        [0, ['+20 max 0 °C']],
        [3, []],
        [3.1, ['−20 slush: max 3.1 °C']],
    ])('scores max %f °C', (tempMax, tempReasons) => {
        expect(scoreSkiing(day({ ...powder, tempMax })).reasons).toEqual([
            '+50 snow on the ground (35 cm)',
            '+30 fresh snow (8 cm)',
            ...tempReasons,
        ]);
    });

    it('penalizes rain over 1 mm, and clamps to 0', () => {
        // +30 fresh snow, −20 slush, −30 rain (20 − 5 ÷ 0.7 = 12.9 mm) = −20 → 0.
        expect(
            scoreSkiing(
                day({
                    snowDepthMax: 0,
                    snowfall: 5,
                    tempMax: 5,
                    precipitation: 20,
                    weatherCode: 63,
                }),
            ),
        ).toEqual({
            score: 0,
            reasons: ['+30 fresh snow (5 cm)', '−20 slush: max 5 °C', '−30 rain 12.9 mm'],
        });
    });

    it('does not penalize exactly 1 mm of rain', () => {
        expect(scoreSkiing(day({ ...powder, snowfall: 0, precipitation: 1 })).reasons).toEqual([
            '+50 snow on the ground (35 cm)',
            '+20 max −2 °C',
        ]);
    });

    it.each(['snowfall', 'snowDepthMax', 'tempMax', 'precipitation', 'weatherCode'] as const)(
        'gives "missing data" when %s is null',
        (field) => {
            expect(scoreSkiing(day({ ...powder, [field]: null }))).toEqual({
                score: null,
                reasons: ['missing data'],
            });
        },
    );

    it('ignores fields it does not need, such as wind', () => {
        expect(scoreSkiing(day({ ...powder, windSpeedMax: null })).score).toBe(100);
    });

    it('gives "missing data" when there is no weather data at all', () => {
        expect(scoreSkiing(day(null))).toEqual({ score: null, reasons: ['missing data'] });
    });
});
