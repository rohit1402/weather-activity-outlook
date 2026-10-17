import { createSchema, createYoga } from 'graphql-yoga';
import { maskError } from './graphql/errors.js';
import { createResolvers, type ResolverDeps } from './graphql/resolvers.js';
import { typeDefs } from './graphql/schema.js';

export function createApp(deps: ResolverDeps) {
    return createYoga({
        schema: createSchema({ typeDefs, resolvers: createResolvers(deps) }),
        maskedErrors: { maskError },
    });
}
