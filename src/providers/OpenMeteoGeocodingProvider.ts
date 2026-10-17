import { z } from 'zod';
import type { GeocodingProvider, GeocodingQuery, Location } from './GeocodingProvider.js';
import type { HttpClient } from './HttpClient.js';

const resultSchema = z.object({
    id: z.number().int(),
    name: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    elevation: z.number().optional(),
    country: z.string().optional(),
    country_code: z.string().optional(),
    admin1: z.string().optional(),
    timezone: z.string().optional(),
});

const responseSchema = z.object({
    results: z.array(resultSchema).optional(),
});

type OpenMeteoGeocodingResult = z.infer<typeof resultSchema>;

export class OpenMeteoGeocodingProvider implements GeocodingProvider {
    static readonly RESULT_COUNT = 5;

    constructor(
        private readonly http: HttpClient,
        private readonly baseUrl: string,
    ) {}

    async search(query: GeocodingQuery): Promise<Location[]> {
        const body = await this.http.getJson(this.buildUrl(query));

        const parsed = responseSchema.safeParse(body);
        if (!parsed.success) {
            throw this.http.failure('malformed', z.prettifyError(parsed.error));
        }

        return (parsed.data.results ?? []).map((result) => this.toLocation(result));
    }

    private buildUrl({ name, countryCode }: GeocodingQuery): URL {
        const url = new URL(this.baseUrl);
        url.searchParams.set('name', name);
        url.searchParams.set('count', String(OpenMeteoGeocodingProvider.RESULT_COUNT));

        if (countryCode) {
            url.searchParams.set('countryCode', countryCode);
        }

        return url;
    }

    private toLocation(result: OpenMeteoGeocodingResult): Location {
        return {
            id: result.id,
            name: result.name,
            region: result.admin1 ?? null,
            country: result.country ?? null,
            countryCode: result.country_code ?? null,
            latitude: result.latitude,
            longitude: result.longitude,
            timezone: result.timezone ?? null,
            elevation: result.elevation ?? null,
        };
    }
}
