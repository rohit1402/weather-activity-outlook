import { createApp } from '../../src/app.js';
import { openDb, type Db } from '../../src/db/connection.js';
import type { GeocodingProvider } from '../../src/providers/GeocodingProvider.js';
import { HttpClient, type FetchFn } from '../../src/providers/HttpClient.js';
import { OpenMeteoForecastProvider } from '../../src/providers/OpenMeteoForecastProvider.js';
import { OpenMeteoGeocodingProvider } from '../../src/providers/OpenMeteoGeocodingProvider.js';
import { OpenMeteoMarineProvider } from '../../src/providers/OpenMeteoMarineProvider.js';
import { LocationRepository } from '../../src/repositories/LocationRepository.js';
import { MarineConditionsRepository } from '../../src/repositories/MarineConditionsRepository.js';
import { WeatherConditionsRepository } from '../../src/repositories/WeatherConditionsRepository.js';
import { ForecastService } from '../../src/services/ForecastService.js';
import { LocationService } from '../../src/services/LocationService.js';
import { MarineService } from '../../src/services/MarineService.js';
import { OutlookService } from '../../src/services/OutlookService.js';
import type { Clock } from '../../src/time.js';
import { FakeClock } from './clock.js';
import { unreachableFetch } from './fakeFetch.js';

export interface GraphQLResponse<TData = Record<string, unknown>> {
    data?: TData | null;
    errors?: { message: string; path?: string[]; extensions?: Record<string, unknown> }[];
}

export interface TestAppOptions {
    fetch?: FetchFn;
    geocoder?: GeocodingProvider;
    forecastFetch?: FetchFn;
    marineFetch?: FetchFn;
    clock?: Clock;
}

const http = (service: string, fetch: FetchFn) =>
    new HttpClient({ service, timeoutMs: 5000, fetch });

export class TestApp {
    readonly db: Db;
    readonly app: ReturnType<typeof createApp>;

    constructor(options: TestAppOptions) {
        this.db = openDb(':memory:');
        const clock = options.clock ?? new FakeClock('2026-10-17T08:00:00.000Z');

        const geocoder =
            options.geocoder ??
            new OpenMeteoGeocodingProvider(
                http('Open-Meteo geocoding', options.fetch ?? unreachableFetch),
                'https://geocoding.test/v1/search',
            );
        const forecastService = new ForecastService(
            new OpenMeteoForecastProvider(
                http('Open-Meteo forecast', options.forecastFetch ?? unreachableFetch),
                'https://forecast.test/v1/forecast',
            ),
            new WeatherConditionsRepository(this.db),
            clock,
        );
        const marineService = new MarineService(
            new OpenMeteoMarineProvider(
                http('Open-Meteo marine', options.marineFetch ?? unreachableFetch),
                'https://marine.test/v1/marine',
            ),
            new MarineConditionsRepository(this.db),
            clock,
        );

        this.app = createApp({
            db: this.db,
            outlookService: new OutlookService(
                new LocationService(geocoder, new LocationRepository(this.db)),
                forecastService,
                marineService,
            ),
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
