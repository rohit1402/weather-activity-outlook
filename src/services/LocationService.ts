import { InvalidInputError, LocationNotFoundError } from '../errors.js';
import type { GeocodingProvider, Location } from '../providers/GeocodingProvider.js';
import type { LocationRepository, QueryKey } from '../repositories/LocationRepository.js';

export class LocationService {
    static readonly MIN_NAME_LENGTH = 2;
    private static readonly COUNTRY_CODE = /^[A-Z]{2}$/;

    constructor(
        private readonly geocoder: GeocodingProvider,
        private readonly repository: LocationRepository,
    ) {}

    async resolveLocation(city: string, countryCode?: string | null): Promise<Location> {
        const key = LocationService.normalize(city, countryCode);

        const saved = this.repository.findByQuery(key);
        if (saved) {
            return saved;
        }

        const [top] = await this.geocoder.search({
            name: key.query,
            ...(key.countryCode && { countryCode: key.countryCode }),
        });

        if (!top) {
            throw new LocationNotFoundError(key.query, key.countryCode || undefined);
        }

        this.repository.save(top, key);
        return top;
    }

    private static normalize(city: string, countryCode?: string | null): QueryKey {
        const query = city.trim().replace(/\s+/g, ' ').toLowerCase();
        if (query.length < LocationService.MIN_NAME_LENGTH) {
            throw new InvalidInputError(
                `Location name must be at least ${LocationService.MIN_NAME_LENGTH} characters`,
            );
        }

        const code = countryCode?.trim().toUpperCase() ?? '';
        if (code !== '' && !LocationService.COUNTRY_CODE.test(code)) {
            throw new InvalidInputError('countryCode must be a 2-letter ISO code, e.g. "NZ"');
        }

        return { query, countryCode: code };
    }
}
