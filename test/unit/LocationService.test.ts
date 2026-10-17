import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../../src/db/connection.js';
import {
    BadUserInputError,
    LocationNotFoundError,
    UpstreamUnavailableError,
} from '../../src/errors.js';
import type {
    GeocodingProvider,
    GeocodingQuery,
    Location,
} from '../../src/providers/GeocodingProvider.js';
import { LocationRepository } from '../../src/repositories/LocationRepository.js';
import { LocationService } from '../../src/services/LocationService.js';

/** Returns canned results (or throws a canned error) and records each query. */
class StubGeocoder implements GeocodingProvider {
    readonly queries: GeocodingQuery[] = [];

    constructor(private readonly outcome: Location[] | Error) {}

    async search(query: GeocodingQuery): Promise<Location[]> {
        this.queries.push(query);
        if (this.outcome instanceof Error) throw this.outcome;
        return this.outcome;
    }
}

const location = (id: number, countryCode: string): Location => ({
    id,
    name: 'Queenstown',
    region: null,
    country: null,
    countryCode,
    latitude: 0,
    longitude: 0,
    timezone: null,
    elevation: null,
});
const SOUTH_AFRICA = location(1, 'ZA');
const NEW_ZEALAND = location(2, 'NZ');

describe('LocationService.resolveLocation', () => {
    let db: Db;
    let repository: LocationRepository;

    beforeEach(() => {
        db = openDb(':memory:');
        repository = new LocationRepository(db);
    });

    afterEach(() => db.close());

    const serviceWith = (geocoder: GeocodingProvider) => new LocationService(geocoder, repository);

    it('returns and saves the top result', async () => {
        const service = serviceWith(new StubGeocoder([SOUTH_AFRICA, NEW_ZEALAND]));

        await expect(service.resolveLocation('Queenstown')).resolves.toStrictEqual(SOUTH_AFRICA);
        expect(repository.findByQuery({ query: 'queenstown', countryCode: '' })).toStrictEqual(
            SOUTH_AFRICA,
        );
    });

    it('normalizes the name and country code before searching and saving', async () => {
        const geocoder = new StubGeocoder([NEW_ZEALAND]);
        await serviceWith(geocoder).resolveLocation('  QUEENSTOWN   Lakes ', ' nz ');

        expect(geocoder.queries).toEqual([{ name: 'queenstown lakes', countryCode: 'NZ' }]);
        expect(
            repository.findByQuery({ query: 'queenstown lakes', countryCode: 'NZ' }),
        ).toBeDefined();
    });

    it.each([undefined, null, '', '  '])('omits countryCode %j from the search', async (code) => {
        const geocoder = new StubGeocoder([NEW_ZEALAND]);
        await serviceWith(geocoder).resolveLocation('Paris', code);
        expect(geocoder.queries).toEqual([{ name: 'paris' }]);
    });

    it('returns a saved query without calling the geocoder', async () => {
        repository.save(NEW_ZEALAND, { query: 'queenstown', countryCode: 'NZ' });
        const geocoder = new StubGeocoder(new Error('must not be called'));

        await expect(
            serviceWith(geocoder).resolveLocation('Queenstown', 'nz'),
        ).resolves.toStrictEqual(NEW_ZEALAND);
        expect(geocoder.queries).toEqual([]);
    });

    it('treats the same name with a different country code as a separate query', async () => {
        repository.save(SOUTH_AFRICA, { query: 'queenstown', countryCode: '' });
        const geocoder = new StubGeocoder([NEW_ZEALAND]);

        await expect(
            serviceWith(geocoder).resolveLocation('Queenstown', 'NZ'),
        ).resolves.toStrictEqual(NEW_ZEALAND);
        expect(geocoder.queries).toHaveLength(1);
    });

    it('throws LOCATION_NOT_FOUND and saves nothing when there are no results', async () => {
        const err = await serviceWith(new StubGeocoder([]))
            .resolveLocation('Nowhere', 'fr')
            .catch((e: unknown) => e);

        expect(err).toBeInstanceOf(LocationNotFoundError);
        expect(err).toMatchObject({
            code: 'LOCATION_NOT_FOUND',
            message: 'No location found for "nowhere" in FR',
        });
        expect(repository.findByQuery({ query: 'nowhere', countryCode: 'FR' })).toBeUndefined();
    });

    it('passes provider failures through and saves nothing', async () => {
        const failure = new UpstreamUnavailableError(
            'Open-Meteo geocoding',
            'timeout',
            'no response',
        );
        const service = serviceWith(new StubGeocoder(failure));

        await expect(service.resolveLocation('Paris')).rejects.toBe(failure);
        expect(repository.findByQuery({ query: 'paris', countryCode: '' })).toBeUndefined();
    });

    it('does not cache failed lookups: each call reaches the geocoder', async () => {
        const geocoder = new StubGeocoder([]);
        const service = serviceWith(geocoder);

        await expect(service.resolveLocation('Nowhere')).rejects.toThrow(LocationNotFoundError);
        await expect(service.resolveLocation('Nowhere')).rejects.toThrow(LocationNotFoundError);
        expect(geocoder.queries).toHaveLength(2);
    });

    it.each<[string, string, string | undefined]>([
        ['an empty name', '', undefined],
        ['a blank name', '   ', undefined],
        ['a 1-character name', 'P', undefined],
        ['a 3-letter country code', 'Queenstown', 'NZL'],
        ['a numeric country code', 'Queenstown', '64'],
    ])('rejects %s as BAD_USER_INPUT without calling the geocoder', async (_label, city, code) => {
        const geocoder = new StubGeocoder([NEW_ZEALAND]);
        const err = await serviceWith(geocoder)
            .resolveLocation(city, code)
            .catch((e: unknown) => e);

        expect(err).toBeInstanceOf(BadUserInputError);
        expect(err).toMatchObject({ code: 'BAD_USER_INPUT' });
        expect(geocoder.queries).toEqual([]);
    });
});
