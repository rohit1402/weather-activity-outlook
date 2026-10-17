export const typeDefs = `
    type Query {
        outlook(city: String!, countryCode: String): Outlook!
        health: Health!
    }

    type Outlook {
        location: Location!
        fetchedAt: String
        isStale: Boolean!
        activities: [ActivityOutlook!]!
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

    enum Activity {
        SKIING
        SURFING
        OUTDOOR_SIGHTSEEING
        INDOOR_SIGHTSEEING
    }

    enum ActivityStatus {
        AVAILABLE
        NOT_APPLICABLE
        UNAVAILABLE
    }

    type ActivityOutlook {
        activity: Activity!
        status: ActivityStatus!
        reason: String
        days: [DayScore!]!
    }

    type DayScore {
        date: String!
        score: Int
        rank: Int
        reasons: [String!]!
    }

    type Health {
        status: String!
        database: Boolean!
    }
`;
