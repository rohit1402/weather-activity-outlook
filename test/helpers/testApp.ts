import { createApp } from '../../src/app.js';
import { openDb, type Db } from '../../src/db/connection.js';
import type { GeocodingProvider } from '../../src/providers/GeocodingProvider.js';
import { HttpClient, type FetchFn } from '../../src/providers/HttpClient.js';
import { OpenMeteoGeocodingProvider } from '../../src/providers/OpenMeteoGeocodingProvider.js';
import { LocationRepository } from '../../src/repositories/LocationRepository.js';
import { LocationService } from '../../src/services/LocationService.js';

export interface GraphQLResponse<TData = Record<string, unknown>> {
    data?: TData | null;
    errors?: { message: string; path?: string[]; extensions?: Record<string, unknown> }[];
}

export class TestApp {
    readonly db: Db;
    readonly app: ReturnType<typeof createApp>;

    /** Pass a mocked `fetch` for the real Open-Meteo provider, or replace the `geocoder` itself. */
    constructor(options: { fetch: FetchFn } | { geocoder: GeocodingProvider }) {
        this.db = openDb(':memory:');
        const geocoder =
            'geocoder' in options
                ? options.geocoder
                : new OpenMeteoGeocodingProvider(
                      new HttpClient({
                          service: 'Open-Meteo geocoding',
                          timeoutMs: 5000,
                          fetch: options.fetch,
                      }),
                      'https://geocoding.test/v1/search',
                  );
        this.app = createApp({
            db: this.db,
            locationService: new LocationService(geocoder, new LocationRepository(this.db)),
        });
    }

    async query<TData = Record<string, unknown>>(
        query: string,
        variables?: Record<string, unknown>,
    ): Promise<{ status: number; body: GraphQLResponse<TData> }> {
        const res = await this.app.fetch('http://localhost/graphql', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ query, variables }),
        });
        return { status: res.status, body: (await res.json()) as GraphQLResponse<TData> };
    }

    close(): void {
        if (this.db.open) this.db.close();
    }
}
