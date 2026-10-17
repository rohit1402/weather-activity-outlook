export const typeDefs = /* GraphQL */ `
    type Query {
        outlook(city: String!, countryCode: String): Outlook!
        health: Health!
    }

    type Outlook {
        location: Location!
    }

    type Location {
        name: String!
        region: String
        country: String
        countryCode: String
        latitude: Float!
        longitude: Float!
        timezone: String
    }

    type Health {
        status: String!
        database: Boolean!
    }
`;
