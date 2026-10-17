import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db/connection.js';
import { HttpClient } from './providers/HttpClient.js';
import { OpenMeteoGeocodingProvider } from './providers/OpenMeteoGeocodingProvider.js';
import { LocationRepository } from './repositories/LocationRepository.js';
import { LocationService } from './services/LocationService.js';

const config = loadConfig();
const db = openDb(config.databasePath);

const geocodingHttp = new HttpClient({
    service: 'Open-Meteo geocoding',
    timeoutMs: config.openMeteo.timeoutMs,
});

const locationService = new LocationService(
    new OpenMeteoGeocodingProvider(geocodingHttp, config.openMeteo.geocodingUrl),
    new LocationRepository(db),
);

const server = createServer(createApp({ db, locationService }));

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
