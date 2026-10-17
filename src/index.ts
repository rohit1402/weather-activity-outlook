import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db/connection.js';
import { HttpClient } from './providers/HttpClient.js';
import { OpenMeteoForecastProvider } from './providers/OpenMeteoForecastProvider.js';
import { OpenMeteoGeocodingProvider } from './providers/OpenMeteoGeocodingProvider.js';
import { OpenMeteoMarineProvider } from './providers/OpenMeteoMarineProvider.js';
import { LocationRepository } from './repositories/LocationRepository.js';
import { MarineConditionsRepository } from './repositories/MarineConditionsRepository.js';
import { WeatherConditionsRepository } from './repositories/WeatherConditionsRepository.js';
import { ForecastService } from './services/ForecastService.js';
import { LocationService } from './services/LocationService.js';
import { MarineService } from './services/MarineService.js';
import { OutlookService } from './services/OutlookService.js';
import { systemClock } from './time.js';

const config = loadConfig();
const db = openDb(config.databasePath);
const { timeoutMs } = config.openMeteo;

const locationService = new LocationService(
    new OpenMeteoGeocodingProvider(
        new HttpClient({ service: 'Open-Meteo geocoding', timeoutMs }),
        config.openMeteo.geocodingUrl,
    ),
    new LocationRepository(db),
);

const forecastService = new ForecastService(
    new OpenMeteoForecastProvider(
        new HttpClient({ service: 'Open-Meteo forecast', timeoutMs }),
        config.openMeteo.forecastUrl,
    ),
    new WeatherConditionsRepository(db),
    systemClock,
);

const marineService = new MarineService(
    new OpenMeteoMarineProvider(
        new HttpClient({ service: 'Open-Meteo marine', timeoutMs }),
        config.openMeteo.marineUrl,
    ),
    new MarineConditionsRepository(db),
    systemClock,
);

const outlookService = new OutlookService(locationService, forecastService, marineService);

const server = createServer(createApp({ db, outlookService }));

server.listen(config.port, () => {
    console.log(`GraphQL server on http://localhost:${config.port}/graphql`);
});

function shutdown() {
    server.close(() => {
        db.close();
        process.exit(0);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
