import type { GraphQLError } from 'graphql';
import { createGraphQLError } from 'graphql-yoga';
import { AppError } from '../errors.js';

function isGraphQLError(error: unknown): error is GraphQLError {
    return error instanceof Error && error.name === 'GraphQLError';
}

export const INTERNAL_ERROR_MESSAGE = 'Something went wrong. Please try again later.';

export function maskError(error: unknown): Error {
    const located = isGraphQLError(error) ? error : undefined;
    const original = located ? located.originalError : error;

    const location = {
        nodes: located?.nodes,
        source: located?.source,
        positions: located?.positions,
        path: located?.path,
    };

    if (original instanceof AppError) {
        return createGraphQLError(original.message, {
            ...location,
            extensions: { code: original.code },
        });
    }

    return createGraphQLError(INTERNAL_ERROR_MESSAGE, {
        ...location,
        extensions: { code: 'INTERNAL_ERROR' },
    });
}
