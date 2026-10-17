import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../../src/db/connection.js';
import type { Location } from '../../src/providers/GeocodingProvider.js';
import { LocationRepository } from '../../src/repositories/LocationRepository.js';

const PARIS: Location = {
    id: 2988507,
    name: 'Paris',
    region: 'Île-de-France Region',
    country: 'France',
    countryCode: 'FR',
    latitude: 48.85341,
    longitude: 2.3488,
    timezone: 'Europe/Paris',
    elevation: 42,
};

describe('LocationRepository', () => {
    let db: Db;
    let repository: LocationRepository;

    beforeEach(() => {
        db = openDb(':memory:');
        repository = new LocationRepository(db);
    });

    afterEach(() => db.close());

    it('returns undefined for an unknown query', () => {
        expect(repository.findByQuery({ query: 'paris', countryCode: '' })).toBeUndefined();
    });

    it('saves a location and finds it by the same query and country code', () => {
        repository.save(PARIS, { query: 'paris', countryCode: '' });

        expect(repository.findByQuery({ query: 'paris', countryCode: '' })).toStrictEqual(PARIS);
        expect(repository.findByQuery({ query: 'paris', countryCode: 'FR' })).toBeUndefined();
    });

    it('round-trips null fields', () => {
        const sparse: Location = {
            ...PARIS,
            region: null,
            country: null,
            countryCode: null,
            timezone: null,
            elevation: null,
        };
        repository.save(sparse, { query: 'paris', countryCode: '' });
        expect(repository.findByQuery({ query: 'paris', countryCode: '' })).toStrictEqual(sparse);
    });

    it('lets two queries share one location row', () => {
        repository.save(PARIS, { query: 'paris', countryCode: '' });
        repository.save(PARIS, { query: 'paris', countryCode: 'FR' });

        expect(db.prepare('SELECT COUNT(*) AS n FROM locations').get()).toEqual({ n: 1 });
        expect(db.prepare('SELECT COUNT(*) AS n FROM geocode_queries').get()).toEqual({ n: 2 });
    });

    it('updates geocoding fields on re-save but keeps the fetch times', () => {
        repository.save(PARIS, { query: 'paris', countryCode: '' });
        db.prepare(
            `UPDATE locations SET weather_fetched_at = '2026-10-17T10:00:00Z' WHERE id = ?`,
        ).run(PARIS.id);

        repository.save({ ...PARIS, elevation: 43 }, { query: 'paris', countryCode: '' });

        expect(db.prepare('SELECT elevation, weather_fetched_at FROM locations').get()).toEqual({
            elevation: 43,
            weather_fetched_at: '2026-10-17T10:00:00Z',
        });
    });

    it('keeps a saved timezone when a re-save has none', () => {
        repository.save({ ...PARIS, timezone: null }, { query: 'paris', countryCode: '' });
        db.prepare(`UPDATE locations SET timezone = 'Europe/Paris' WHERE id = ?`).run(PARIS.id);

        repository.save({ ...PARIS, timezone: null }, { query: 'paris', countryCode: 'FR' });

        expect(db.prepare('SELECT timezone FROM locations').get()).toEqual({
            timezone: 'Europe/Paris',
        });
    });

    it('still updates the timezone when a re-save has a new one', () => {
        repository.save(PARIS, { query: 'paris', countryCode: '' });
        repository.save(
            { ...PARIS, timezone: 'Europe/Berlin' },
            { query: 'paris', countryCode: '' },
        );

        expect(db.prepare('SELECT timezone FROM locations').get()).toEqual({
            timezone: 'Europe/Berlin',
        });
    });

    it('rejects a query mapping to a location that does not exist', () => {
        expect(() =>
            db
                .prepare(
                    `INSERT INTO geocode_queries (query, country_code, location_id) VALUES ('x', '', 999)`,
                )
                .run(),
        ).toThrow(/FOREIGN KEY/);
    });
});
