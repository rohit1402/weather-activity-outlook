import { isDbUp, type Db } from '../db/connection.js';

export function createResolvers(db: Db) {
    return {
        Query: {
            health: () => {
                const database = isDbUp(db);
                return { status: database ? 'ok' : 'degraded', database };
            },
        },
    };
}
