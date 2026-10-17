import { isDbUp, type Db } from '../db/connection.js';
import type { Location } from '../providers/GeocodingProvider.js';
import type { LocationService } from '../services/LocationService.js';

export interface ResolverDeps {
    db: Db;
    locationService: LocationService;
}

interface OutlookArgs {
    city: string;
    countryCode?: string | null;
}

interface Outlook {
    location: Location;
}

interface Health {
    status: 'ok' | 'degraded';
    database: boolean;
}

export function createResolvers({ db, locationService }: ResolverDeps) {
    return {
        Query: {
            outlook: async (_parent: unknown, args: OutlookArgs): Promise<Outlook> => ({
                location: await locationService.resolveLocation(args.city, args.countryCode),
            }),

            health: (): Health => {
                const database = isDbUp(db);
                return { status: database ? 'ok' : 'degraded', database };
            },
        },
    };
}
