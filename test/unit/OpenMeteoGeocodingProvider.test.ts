import { describe, expect, it } from 'vitest';
import { UpstreamUnavailableError } from '../../src/errors.js';
import { HttpClient } from '../../src/providers/HttpClient.js';
import { OpenMeteoGeocodingProvider } from '../../src/providers/OpenMeteoGeocodingProvider.js';
import { FakeFetch } from '../helpers/fakeFetch.js';
import { fixture } from '../helpers/fixtures.js';

const BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

function providerFor(fake: FakeFetch): OpenMeteoGeocodingProvider {
    const http = new HttpClient({
        service: 'Open-Meteo geocoding',
        timeoutMs: 1000,
        fetch: fake.fetch,
    });
    return new OpenMeteoGeocodingProvider(http, BASE_URL);
}

function search(body: string) {
    return providerFor(new FakeFetch(body)).search({ name: 'x' });
}

describe('OpenMeteoGeocodingProvider', () => {
    it('requests up to 5 results for the name', async () => {
        const fake = new FakeFetch(fixture('geo-paris.json'));
        await providerFor(fake).search({ name: 'paris' });

        expect(fake.urls).toHaveLength(1);
        expect(fake.lastUrl.origin + fake.lastUrl.pathname).toBe(BASE_URL);
        expect(Object.fromEntries(fake.lastUrl.searchParams)).toEqual({
            name: 'paris',
            count: '5',
        });
    });

    it('adds countryCode when given', async () => {
        const fake = new FakeFetch(fixture('geo-queenstown-nz.json'));
        await providerFor(fake).search({ name: 'queenstown', countryCode: 'NZ' });
        expect(fake.lastUrl.searchParams.get('countryCode')).toBe('NZ');
    });

    it('maps admin1 to region, plus id, country, coordinates, timezone and elevation', async () => {
        const locations = await search(fixture('geo-paris.json'));
        expect(locations).toHaveLength(5);
        expect(locations[0]).toStrictEqual({
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
    });

    it('returns an empty list when the response has no results key', async () => {
        await expect(search(fixture('geo-not-found.json'))).resolves.toEqual([]);
    });

    it('uses null for fields the provider omits', async () => {
        const body = JSON.stringify({
            results: [{ id: 1, name: 'Aurangabad', latitude: 33.4, longitude: 72.1 }],
        });
        const [location] = await search(body);
        expect(location).toStrictEqual({
            id: 1,
            name: 'Aurangabad',
            region: null,
            country: null,
            countryCode: null,
            latitude: 33.4,
            longitude: 72.1,
            timezone: null,
            elevation: null,
        });
    });

    it.each([
        ['results is not an array', { results: { id: 1 } }],
        ['a result has no id', { results: [{ name: 'Paris', latitude: 1, longitude: 2 }] }],
        [
            'a result has a string latitude',
            { results: [{ id: 1, name: 'Paris', latitude: '48.8', longitude: 2 }] },
        ],
        [
            'admin1 is not a string',
            { results: [{ id: 1, name: 'Paris', latitude: 1, longitude: 2, admin1: 5 }] },
        ],
    ])('rejects a response where %s as UPSTREAM_UNAVAILABLE', async (_label, payload) => {
        const err = await search(JSON.stringify(payload)).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(UpstreamUnavailableError);
        expect(err).toMatchObject({
            code: 'UPSTREAM_UNAVAILABLE',
            failure: 'malformed',
            service: 'Open-Meteo geocoding',
        });
    });
});
