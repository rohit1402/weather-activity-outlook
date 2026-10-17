import { describe, expect, it } from 'vitest';
import { scoreIndoor } from '../../../src/scoring/indoor.js';

describe('scoreIndoor', () => {
    it('names what is wrong outside', () => {
        expect(scoreIndoor({ score: 80, reasons: ['Rain (1.2 mm)'] })).toEqual({
            score: 52,
            reasons: ['Expect rain (1.2 mm) outside'],
        });
        const outdoor = {
            score: 51,
            reasons: ['Rain (3 mm)', 'Cold weather (max 12 °C)', 'Strong wind (35 km/h)'],
        };
        expect(scoreIndoor(outdoor)).toEqual({
            score: 69,
            reasons: [
                'Expect rain (3 mm), cold weather (max 12 °C) and strong wind (35 km/h) outside',
            ],
        });
    });

    it('still scores 40 on a perfect day outside', () => {
        expect(scoreIndoor({ score: 100, reasons: [] })).toEqual({
            score: 40,
            reasons: ['Great weather outside, but indoor sightseeing is still an option'],
        });
    });

    it('reaches 100 on the worst day outside', () => {
        const outdoor = { score: 0, reasons: ['Heavy rain (30 mm)', 'Possible thunderstorms'] };
        expect(scoreIndoor(outdoor)).toEqual({
            score: 100,
            reasons: ['Expect heavy rain (30 mm) and possible thunderstorms outside'],
        });
    });

    it('gives "Missing data" when the outdoor score is null', () => {
        expect(scoreIndoor({ score: null, reasons: ['Missing data'] })).toEqual({
            score: null,
            reasons: ['Missing data'],
        });
    });
});
