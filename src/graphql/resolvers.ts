import { isDbUp, type Db } from '../db/connection.js';
import type { Outlook, OutlookService } from '../services/OutlookService.js';

export interface ResolverDeps {
    db: Db;
    outlookService: OutlookService;
}

interface OutlookArgs {
    city: string;
    countryCode?: string | null;
}

type OutlookResult = Omit<Outlook, 'fetchedAt'> & { fetchedAt: string | null };

interface Health {
    status: 'ok' | 'degraded';
    database: boolean;
}

export function createResolvers({ db, outlookService }: ResolverDeps) {
    return {
        Query: {
            outlook: async (_parent: unknown, args: OutlookArgs): Promise<OutlookResult> => {
                const outlook = await outlookService.getOutlook(args.city, args.countryCode);
                return { ...outlook, fetchedAt: outlook.fetchedAt?.toISOString() ?? null };
            },

            health: (): Health => {
                const database = isDbUp(db);
                return { status: database ? 'ok' : 'degraded', database };
            },
        },
    };
}
