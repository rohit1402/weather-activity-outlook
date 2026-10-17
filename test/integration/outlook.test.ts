import { afterEach, describe, expect, it } from 'vitest';
import type { GeocodingProvider } from '../../src/providers/GeocodingProvider.js';
import { FakeFetch, unreachableFetch } from '../helpers/fakeFetch.js';
import { fixture } from '../helpers/fixtures.js';
import { TestApp } from '../helpers/testApp.js';

const OUTLOOK = `
    query Outlook($city: String!, $countryCode: String) {
        outlook(city: $city, countryCode: $countryCode) {
            location {
                name
                region
                country
                countryCode
                latitude
                longitude
                timezone
            }
        }
    }
`;

interface OutlookData {
    outlook: { location: Record<string, unknown> };
}

describe('outlook query', () => {
    let testApp: TestApp;

    afterEach(() => testApp.close());

    it('returns Paris, France with its region', async () => {
        const fake = new FakeFetch(fixture('geo-paris.json'));
        testApp = new TestApp({ fetch: fake.fetch });

        const { status, body } = await testApp.query<OutlookData>(OUTLOOK, { city: 'Paris' });

        expect(status).toBe(200);
        expect(body).toEqual({
            data: {
                outlook: {
                    location: {
                        name: 'Paris',
                        region: 'Île-de-France Region',
                        country: 'France',
                        countryCode: 'FR',
                        latitude: 48.85341,
                        longitude: 2.3488,
                        timezone: 'Europe/Paris',
                    },
                },
            },
        });
        expect(fake.urls).toHaveLength(1);
    });

    it('returns LOCATION_NOT_FOUND in extensions.code for an unknown city', async () => {
        testApp = new TestApp({ fetch: new FakeFetch(fixture('geo-not-found.json')).fetch });

        const { body } = await testApp.query(OUTLOOK, { city: 'qzxvbnmplk' });

        expect(body.data).toBeNull();
        expect(body.errors).toEqual([
            {
                message: 'No location found for "qzxvbnmplk"',
                locations: [{ line: 3, column: 9 }],
                path: ['outlook'],
                extensions: { code: 'LOCATION_NOT_FOUND' },
            },
        ]);
    });

    it.each([
        ['an empty city', { city: '' }],
        ['a whitespace-only city', { city: '   ' }],
        ['a 3-letter countryCode', { city: 'Queenstown', countryCode: 'NZL' }],
        ['a numeric countryCode', { city: 'Queenstown', countryCode: '64' }],
    ])('returns BAD_USER_INPUT for %s without calling Open-Meteo', async (_label, variables) => {
        const fake = new FakeFetch(fixture('geo-paris.json'));
        testApp = new TestApp({ fetch: fake.fetch });

        const { body } = await testApp.query(OUTLOOK, variables);

        expect(body.data).toBeNull();
        expect(body.errors?.[0]?.extensions).toEqual({ code: 'BAD_USER_INPUT' });
        expect(fake.urls).toHaveLength(0);
    });

    it.each([
        ['the API is unreachable', unreachableFetch],
        [
            'the API sends an error payload',
            new FakeFetch('{"error":true,"reason":"The service is overloaded"}', 503).fetch,
        ],
    ])('returns UPSTREAM_UNAVAILABLE when %s', async (_label, fetch) => {
        testApp = new TestApp({ fetch });

        const { body } = await testApp.query(OUTLOOK, { city: 'Paris' });

        expect(body.data).toBeNull();
        expect(body.errors).toHaveLength(1);
        expect(body.errors?.[0]).toMatchObject({
            path: ['outlook'],
            extensions: { code: 'UPSTREAM_UNAVAILABLE' },
        });
    });

    it('returns a generic INTERNAL_ERROR for an unexpected error, without its details', async () => {
        const brokenGeocoder: GeocodingProvider = {
            search: async () => {
                throw new Error('SQLITE_CORRUPT at /var/data/secret.db');
            },
        };
        testApp = new TestApp({ geocoder: brokenGeocoder });

        const { body } = await testApp.query(OUTLOOK, { city: 'Paris' });

        expect(body.errors).toEqual([
            {
                message: 'Something went wrong. Please try again later.',
                locations: [{ line: 3, column: 9 }],
                path: ['outlook'],
                extensions: { code: 'INTERNAL_ERROR' },
            },
        ]);
        expect(JSON.stringify(body)).not.toContain('secret');
    });

    it('rejects a query without city as a GraphQL validation error', async () => {
        testApp = new TestApp({ fetch: unreachableFetch });

        const { body } = await testApp.query('{ outlook { location { name } } }');

        expect(body.data).toBeUndefined();
        expect(body.errors?.[0]?.message).toMatch(/city.*is required/);
    });
});
