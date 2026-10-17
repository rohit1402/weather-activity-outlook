import { z } from 'zod';
import type { HttpClient } from './HttpClient.js';
import type { MarineForecast, MarineProvider } from './MarineProvider.js';

const nullableNumbers = z.array(z.number().nullable());

const responseSchema = z
    .object({
        timezone: z.string(),
        daily: z.object({
            time: z.array(z.iso.date()),
            wave_height_max: nullableNumbers,
            wave_period_max: nullableNumbers,
        }),
    })
    .refine(
        ({ daily }) =>
            daily.wave_height_max.length === daily.time.length &&
            daily.wave_period_max.length === daily.time.length,
        { message: 'daily arrays must have one value per date in daily.time' },
    );

export class OpenMeteoMarineProvider implements MarineProvider {
    static readonly DAILY_FIELDS = ['wave_height_max', 'wave_period_max'] as const;
    static readonly FORECAST_DAYS = 7;

    constructor(
        private readonly http: HttpClient,
        private readonly baseUrl: string,
    ) {}

    async fetchMarine(latitude: number, longitude: number): Promise<MarineForecast> {
        const body = await this.http.getJson(this.buildUrl(latitude, longitude));

        const parsed = responseSchema.safeParse(body);
        if (!parsed.success) {
            throw this.http.failure('malformed', z.prettifyError(parsed.error));
        }

        const { timezone, daily } = parsed.data;
        return {
            timezone,
            days: daily.time.map((date, i) => ({
                date,
                waveHeightMax: daily.wave_height_max[i] ?? null,
                wavePeriodMax: daily.wave_period_max[i] ?? null,
            })),
        };
    }

    private buildUrl(latitude: number, longitude: number): URL {
        const url = new URL(this.baseUrl);
        url.searchParams.set('latitude', String(latitude));
        url.searchParams.set('longitude', String(longitude));
        url.searchParams.set('daily', OpenMeteoMarineProvider.DAILY_FIELDS.join(','));
        url.searchParams.set('timezone', 'auto');
        url.searchParams.set('forecast_days', String(OpenMeteoMarineProvider.FORECAST_DAYS));
        return url;
    }
}
