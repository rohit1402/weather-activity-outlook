import { createSchema, createYoga } from 'graphql-yoga';
import type { Db } from './db.js';
import { typeDefs } from './graphql/typeDefs.js';

function databaseIsUp(db: Db): boolean {
    try {
        db.prepare('SELECT 1').get();
        return true;
    } catch {
        return false;
    }
}

export function createApp(db: Db) {
    return createYoga({
        schema: createSchema({
            typeDefs,
            resolvers: {
                Query: {
                    health: () => {
                        const database = databaseIsUp(db);
                        return { status: database ? 'ok' : 'degraded', database };
                    },
                },
            },
        }),
    });
}
