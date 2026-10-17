import type { DailyForecast } from './DailyForecast.js';

export interface MarineDay {
    date: string;
    waveHeightMax: number | null;
    wavePeriodMax: number | null;
}

export type MarineForecast = DailyForecast<MarineDay>;

export interface MarineProvider {
    fetchMarine(latitude: number, longitude: number): Promise<MarineForecast>;
}
