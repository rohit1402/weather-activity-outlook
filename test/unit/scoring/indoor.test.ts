import { describe, expect, it } from 'vitest';
import { scoreIndoor } from '../../../src/scoring/indoor.js';

describe('scoreIndoor', () => {
    it('scores 40 + 0.6 × (100 − outdoor), rounded', () => {
        expect(scoreIndoor({ score: 46, reasons: [] })).toEqual({
            score: 72,
            reasons: ['40 + 0.6 × (100 − outdoor 46) = 72.4'],
        });
    });

    it.each([
        [100, 40],
        [0, 100],
    ])('maps outdoor %i to indoor %i', (outdoor, indoor) => {
        expect(scoreIndoor({ score: outdoor, reasons: [] }).score).toBe(indoor);
    });

    it('gives "missing data" when the outdoor score is null', () => {
        expect(scoreIndoor({ score: null, reasons: ['missing data'] })).toEqual({
            score: null,
            reasons: ['missing data'],
        });
    });
});
