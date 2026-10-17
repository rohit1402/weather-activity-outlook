export interface Config {
    port: number;
    databasePath: string;
    openMeteo: {
        geocodingUrl: string;
        forecastUrl: string;
        marineUrl: string;
    };
}

function readUrl(env: NodeJS.ProcessEnv, name: string, fallback: string): string {
    const value = env[name] ?? fallback;
    if (!URL.canParse(value)) {
        throw new Error(`Invalid ${name}: ${value}`);
    }
    return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
    const port = Number(env.PORT ?? 4000);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error(`Invalid PORT: ${env.PORT}`);
    }
    return {
        port,
        databasePath: env.DATABASE_PATH ?? 'data/weather.db',
        openMeteo: {
            geocodingUrl: readUrl(
                env,
                'OPEN_METEO_GEOCODING_URL',
                'https://geocoding-api.open-meteo.com/v1/search',
            ),
            forecastUrl: readUrl(
                env,
                'OPEN_METEO_FORECAST_URL',
                'https://api.open-meteo.com/v1/forecast',
            ),
            marineUrl: readUrl(
                env,
                'OPEN_METEO_MARINE_URL',
                'https://marine-api.open-meteo.com/v1/marine',
            ),
        },
    };
}
