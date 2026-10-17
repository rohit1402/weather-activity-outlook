import { createSchema, createYoga } from 'graphql-yoga';
import type { Db } from './db/connection.js';
import { createResolvers } from './graphql/resolvers.js';
import { typeDefs } from './graphql/schema.js';

export function createApp(db: Db) {
    return createYoga({
        schema: createSchema({ typeDefs, resolvers: createResolvers(db) }),
    });
}
