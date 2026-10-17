import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../../src/db/connection.js';
import { LocationNotFoundError, UpstreamUnavailableError } from '../../src/errors.js';
import { HttpClient, type FetchFn } from '../../src/providers/HttpClient.js';
import { OpenMeteoGeocodingProvider } from '../../src/providers/OpenMeteoGeocodingProvider.js';
import { LocationRepository } from '../../src/repositories/LocationRepository.js';
import { LocationService } from '../../src/services/LocationService.js';
import { FakeFetch, unreachableFetch } from '../helpers/fakeFetch.js';
import { fixture } from '../helpers/fixtures.js';

/**
 * Real classes and a real (in-memory) SQLite database; only fetch is mocked.
 * Each `serviceUsing` call shares the same database, like successive server requests.
 */
describe('resolveLocation with saved Open-Meteo responses', () => {
    let db: Db;

    beforeEach(() => {
        db = openDb(':memory:');
    });

    afterEach(() => db.close());

    function serviceUsing(fetch: FetchFn): LocationService {
        const http = new HttpClient({ service: 'Open-Meteo geocoding', timeoutMs: 5000, fetch });
        const provider = new OpenMeteoGeocodingProvider(http, 'https://geocoding.test/v1/search');
        return new LocationService(provider, new LocationRepository(db));
    }

    const count = (table: 'locations' | 'geocode_queries') =>
        (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

    it('resolves Paris to Paris, France, with region "Île-de-France Region"', async () => {
        const fake = new FakeFetch(fixture('geo-paris.json'));
        const paris = await serviceUsing(fake.fetch).resolveLocation('Paris');

        expect(paris).toStrictEqual({
            id: 2988507,
            name: 'Paris',
            region: 'Île-de-France Region',
            country: 'France',
            countryCode: 'FR',
            latitude: 48.85341,
            longitude: 2.3488,
            timezone: 'Europe/Paris',
            elevation: 42,
        });
        expect(Object.fromEntries(fake.lastUrl.searchParams)).toEqual({
            name: 'paris',
            count: '5',
        });
        expect(db.prepare('SELECT * FROM geocode_queries').all()).toEqual([
            { query: 'paris', country_code: '', location_id: 2988507 },
        ]);
    });

    it('resolves Aurangabad to Maharashtra, not Bihar', async () => {
        const fake = new FakeFetch(fixture('geo-aurangabad.json'));
        await expect(serviceUsing(fake.fetch).resolveLocation('Aurangabad')).resolves.toMatchObject(
            {
                id: 1278149,
                region: 'Maharashtra',
                country: 'India',
                timezone: 'Asia/Kolkata',
            },
        );
    });

    it('makes no network call for a second lookup of " PARIS "', async () => {
        const fake = new FakeFetch(fixture('geo-paris.json'));
        const service = serviceUsing(fake.fetch);

        const first = await service.resolveLocation('Paris');
        const second = await service.resolveLocation(' PARIS ');

        expect(second).toStrictEqual(first);
        expect(fake.urls).toHaveLength(1);
    });

    it('throws LOCATION_NOT_FOUND and saves nothing for a no-match response', async () => {
        const fake = new FakeFetch(fixture('geo-not-found.json'));
        const err = await serviceUsing(fake.fetch)
            .resolveLocation('qzxvbnmplk')
            .catch((e: unknown) => e);

        expect(err).toBeInstanceOf(LocationNotFoundError);
        expect(err).toMatchObject({ code: 'LOCATION_NOT_FOUND' });
        expect(count('locations')).toBe(0);
        expect(count('geocode_queries')).toBe(0);
    });

    it.each([
        [
            'an error payload with HTTP 200',
            '{"error":true,"reason":"The service is overloaded"}',
            200,
        ],
        ['an error payload with HTTP 400', '{"error":true,"reason":"Invalid parameter"}', 400],
        ['a bad HTTP status', '<html>Bad gateway</html>', 502],
        ['an unexpected shape', '{"results":[{"name":"Paris"}]}', 200],
    ])('throws UPSTREAM_UNAVAILABLE and saves nothing for %s', async (_label, body, status) => {
        const fake = new FakeFetch(body, status);
        const err = await serviceUsing(fake.fetch)
            .resolveLocation('Paris')
            .catch((e: unknown) => e);

        expect(err).toBeInstanceOf(UpstreamUnavailableError);
        expect(err).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
        expect(count('locations')).toBe(0);
        expect(count('geocode_queries')).toBe(0);
    });

    it('still resolves a saved query while the API is down', async () => {
        await serviceUsing(new FakeFetch(fixture('geo-paris.json')).fetch).resolveLocation('Paris');

        const whileDown = serviceUsing(unreachableFetch);
        await expect(whileDown.resolveLocation('paris')).resolves.toMatchObject({
            id: 2988507,
            region: 'Île-de-France Region',
        });
        // A query that was never saved still needs the API, so it fails.
        await expect(whileDown.resolveLocation('Lyon')).rejects.toBeInstanceOf(
            UpstreamUnavailableError,
        );
    });
});
