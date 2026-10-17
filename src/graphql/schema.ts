export const typeDefs = /* GraphQL */ `
    type Query {
        health: Health!
    }

    type Health {
        status: String!
        database: Boolean!
    }
`;
