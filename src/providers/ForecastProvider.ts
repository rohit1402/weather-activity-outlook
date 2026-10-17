import type { DailyForecast } from './DailyForecast.js';

export interface WeatherDay {
    date: string;
    tempMax: number | null;
    tempMin: number | null;
    precipitation: number | null;
    precipitationProbability: number | null;
    snowfall: number | null;
    windSpeedMax: number | null;
    weatherCode: number | null;
    cloudCover: number | null;
    snowDepthMax: number | null;
}

export type WeatherForecast = DailyForecast<WeatherDay>;

export interface ForecastProvider {
    fetchForecast(latitude: number, longitude: number): Promise<WeatherForecast>;
}
