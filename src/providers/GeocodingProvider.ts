export interface Location {
    id: number;
    name: string;
    region: string | null;
    country: string | null;
    countryCode: string | null;
    latitude: number;
    longitude: number;
    timezone: string | null;
    elevation: number | null;
}

export interface GeocodingQuery {
    name: string;
    countryCode?: string;
}

export interface GeocodingProvider {
    search(query: GeocodingQuery): Promise<Location[]>;
}
