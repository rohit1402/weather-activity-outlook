import { z } from 'zod';
import type { ForecastProvider, WeatherForecast } from './ForecastProvider.js';
import type { HttpClient } from './HttpClient.js';

const nullableNumbers = z.array(z.number().nullable());

const responseSchema = z
    .object({
        timezone: z.string(),
        daily: z.object({
            time: z.array(z.iso.date()),
            temperature_2m_max: nullableNumbers,
            temperature_2m_min: nullableNumbers,
            precipitation_sum: nullableNumbers,
            precipitation_probability_max: nullableNumbers,
            snowfall_sum: nullableNumbers,
            wind_speed_10m_max: nullableNumbers,
            weather_code: z.array(z.number().int().nullable()),
            cloud_cover_mean: nullableNumbers,
        }),
        hourly: z.object({
            // Local time without seconds, e.g. "2026-10-17T00:00".
            time: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)),
            snow_depth: nullableNumbers,
        }),
    })
    .refine(
        ({ daily }) => Object.values(daily).every((values) => values.length === daily.time.length),
        { message: 'daily arrays must have one value per date in daily.time' },
    )
    .refine(({ hourly }) => hourly.snow_depth.length === hourly.time.length, {
        message: 'hourly.snow_depth must have one value per entry in hourly.time',
    });

type OpenMeteoHourly = z.infer<typeof responseSchema>['hourly'];

export class OpenMeteoForecastProvider implements ForecastProvider {
    static readonly DAILY_FIELDS = [
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'snowfall_sum',
        'wind_speed_10m_max',
        'weather_code',
        'cloud_cover_mean',
    ] as const;
    static readonly HOURLY_FIELDS = ['snow_depth'] as const;
    static readonly FORECAST_DAYS = 7;

    constructor(
        private readonly http: HttpClient,
        private readonly baseUrl: string,
    ) {}

    async fetchForecast(latitude: number, longitude: number): Promise<WeatherForecast> {
        const body = await this.http.getJson(this.buildUrl(latitude, longitude));

        const parsed = responseSchema.safeParse(body);
        if (!parsed.success) {
            throw this.http.failure('malformed', z.prettifyError(parsed.error));
        }

        const { timezone, daily, hourly } = parsed.data;
        const snowDepthMax = OpenMeteoForecastProvider.dailySnowDepthMaxCm(hourly);

        return {
            timezone,
            days: daily.time.map((date, i) => ({
                date,
                tempMax: daily.temperature_2m_max[i] ?? null,
                tempMin: daily.temperature_2m_min[i] ?? null,
                precipitation: daily.precipitation_sum[i] ?? null,
                precipitationProbability: daily.precipitation_probability_max[i] ?? null,
                snowfall: daily.snowfall_sum[i] ?? null,
                windSpeedMax: daily.wind_speed_10m_max[i] ?? null,
                weatherCode: daily.weather_code[i] ?? null,
                cloudCover: daily.cloud_cover_mean[i] ?? null,
                snowDepthMax: snowDepthMax.get(date) ?? null,
            })),
        };
    }

    /**
     * Highest hourly snow depth per local date, converted from metres to centimetres.
     * Null hours are ignored; a date with no non-null hours is absent from the map.
     */
    private static dailySnowDepthMaxCm(hourly: OpenMeteoHourly): Map<string, number> {
        const maxMetres = new Map<string, number>();
        hourly.time.forEach((time, i) => {
            const depth = hourly.snow_depth[i];
            if (depth === null || depth === undefined) return;

            const date = time.slice(0, 10);
            maxMetres.set(date, Math.max(depth, maxMetres.get(date) ?? -Infinity));
        });

        // Rounded to 0.1 cm to drop float noise (0.58 m * 100 = 57.99999999999999);
        // the API reports depth to 0.01 m, so nothing is lost.
        return new Map(
            [...maxMetres].map(([date, metres]) => [date, Math.round(metres * 1000) / 10]),
        );
    }

    private buildUrl(latitude: number, longitude: number): URL {
        const url = new URL(this.baseUrl);
        url.searchParams.set('latitude', String(latitude));
        url.searchParams.set('longitude', String(longitude));
        url.searchParams.set('daily', OpenMeteoForecastProvider.DAILY_FIELDS.join(','));
        url.searchParams.set('hourly', OpenMeteoForecastProvider.HOURLY_FIELDS.join(','));
        url.searchParams.set('timezone', 'auto');
        url.searchParams.set('forecast_days', String(OpenMeteoForecastProvider.FORECAST_DAYS));
        return url;
    }
}
