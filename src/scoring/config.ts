/**
 * Every threshold and point value used by the scorers (SCORING.md).
 * A Tier covers [min, max): min included, max excluded; a missing bound is open.
 */
export interface Tier {
    min?: number;
    max?: number;
    points: number;
}

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

/** Weather codes 95–99, both included. */
export const THUNDERSTORM_CODES = { min: 95, max: 99 } as const;

/** Fresh snow (cm) per mm of precipitation when fully frozen (spike finding). */
export const SNOW_CM_PER_MM = 0.7;

export const SKIING = {
    minSnowCm: 1,
    minSnowDepthCm: 10,
    snowOnGroundPoints: 50,
    freshSnowPoints: 30,
    freezingC: 0, // at or below
    freezingPoints: 20,
    slushAboveC: 3,
    slushPoints: -20,
    rainOverMm: 1,
    rainPoints: -30,
} as const;

export const SURFING = {
    waveHeightM: [
        { max: 0.5, points: 10 },
        { min: 0.5, max: 1, points: 40 },
        { min: 1, max: 1.5, points: 60 },
        { min: 1.5, max: 2.5, points: 80 },
        { min: 2.5, max: 3.5, points: 60 },
        { min: 3.5, points: 20 },
    ] satisfies Tier[],
    /** Waves this high or higher get no period bonus. */
    dangerousWaveM: 3.5,
    longPeriodS: 10,
    longPeriodPoints: 20,
    windKmh: 30, // or more
    windPoints: -20,
} as const;

export const OUTDOOR = {
    start: 100,
    rainMm: [
        { min: 1, max: 5, points: -20 },
        { min: 5, points: -40 },
    ] satisfies Tier[],
    snowfallCm: 1, // or more
    snowfallPoints: -20,
    comfortableMinC: 15,
    comfortableMaxC: 28,
    pointsPerDegree: -3,
    maxTemperaturePenalty: -40,
    windKmh: 30, // or more
    windPoints: -20,
    thunderstormPoints: -30,
} as const;

export const INDOOR = {
    base: 40,
    factor: 0.6,
} as const;
