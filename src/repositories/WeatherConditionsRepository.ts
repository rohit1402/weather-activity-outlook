import type { Statement } from 'better-sqlite3';
import type { Db } from '../db/connection.js';
import type { FetchState } from './FetchState.js';
import type { WeatherDay } from '../providers/ForecastProvider.js';

interface WeatherStateRow {
    weather_fetched_at: string | null;
    timezone: string | null;
}

interface WeatherDayRow {
    location_id: number;
    date: string;
    temp_max: number | null;
    temp_min: number | null;
    precipitation: number | null;
    precipitation_probability: number | null;
    snowfall: number | null;
    wind_speed_max: number | null;
    weather_code: number | null;
    cloud_cover: number | null;
    snow_depth_max: number | null;
}

export class WeatherConditionsRepository {
    private readonly weatherStateStmt: Statement<[number], WeatherStateRow>;
    private readonly weatherDaysStmt: Statement<[number, string], WeatherDayRow>;
    private readonly upsertWeatherDayStmt: Statement<[WeatherDayRow]>;
    private readonly markWeatherFetchedStmt: Statement<[string, string, number]>;

    constructor(private readonly db: Db) {
        this.weatherStateStmt = db.prepare(
            'SELECT weather_fetched_at, timezone FROM locations WHERE id = ?',
        );

        this.weatherDaysStmt = db.prepare(`
            SELECT *
            FROM daily_weather_conditions
            WHERE location_id = ? AND date >= ?
            ORDER BY date
        `);

        this.upsertWeatherDayStmt = db.prepare(`
            INSERT INTO daily_weather_conditions (
                location_id, date, temp_max, temp_min, precipitation, precipitation_probability,
                snowfall, wind_speed_max, weather_code, cloud_cover, snow_depth_max
            ) VALUES (
                @location_id, @date, @temp_max, @temp_min, @precipitation, @precipitation_probability,
                @snowfall, @wind_speed_max, @weather_code, @cloud_cover, @snow_depth_max
            )
            ON CONFLICT (location_id, date) DO UPDATE SET
                temp_max = excluded.temp_max,
                temp_min = excluded.temp_min,
                precipitation = excluded.precipitation,
                precipitation_probability = excluded.precipitation_probability,
                snowfall = excluded.snowfall,
                wind_speed_max = excluded.wind_speed_max,
                weather_code = excluded.weather_code,
                cloud_cover = excluded.cloud_cover,
                snow_depth_max = excluded.snow_depth_max
        `);

        this.markWeatherFetchedStmt = db.prepare(`
            UPDATE locations
            SET weather_fetched_at = ?, timezone = COALESCE(timezone, ?)
            WHERE id = ?
        `);
    }

    getWeatherState(locationId: number): FetchState {
        const row = this.weatherStateStmt.get(locationId);
        return {
            fetchedAt: row?.weather_fetched_at ? new Date(row.weather_fetched_at) : null,
            timezone: row?.timezone ?? null,
        };
    }

    findWeatherDays(locationId: number, fromDate: string): WeatherDay[] {
        return this.weatherDaysStmt
            .all(locationId, fromDate)
            .map((row) => WeatherConditionsRepository.toDay(row));
    }

    saveWeather(locationId: number, days: WeatherDay[], fetchedAt: Date, timezone: string): void {
        this.db.transaction(() => {
            for (const day of days) {
                this.upsertWeatherDayStmt.run(WeatherConditionsRepository.toRow(locationId, day));
            }
            this.markWeatherFetchedStmt.run(fetchedAt.toISOString(), timezone, locationId);
        })();
    }

    private static toRow(locationId: number, day: WeatherDay): WeatherDayRow {
        return {
            location_id: locationId,
            date: day.date,
            temp_max: day.tempMax,
            temp_min: day.tempMin,
            precipitation: day.precipitation,
            precipitation_probability: day.precipitationProbability,
            snowfall: day.snowfall,
            wind_speed_max: day.windSpeedMax,
            weather_code: day.weatherCode,
            cloud_cover: day.cloudCover,
            snow_depth_max: day.snowDepthMax,
        };
    }

    private static toDay(row: WeatherDayRow): WeatherDay {
        return {
            date: row.date,
            tempMax: row.temp_max,
            tempMin: row.temp_min,
            precipitation: row.precipitation,
            precipitationProbability: row.precipitation_probability,
            snowfall: row.snowfall,
            windSpeedMax: row.wind_speed_max,
            weatherCode: row.weather_code,
            cloudCover: row.cloud_cover,
            snowDepthMax: row.snow_depth_max,
        };
    }
}
