export interface MarineDay {
    date: string;
    waveHeightMax: number | null;
    wavePeriodMax: number | null;
}

export interface MarineForecast {
    timezone: string;
    days: MarineDay[];
}

export interface MarineProvider {
    fetchMarine(latitude: number, longitude: number): Promise<MarineForecast>;
}
