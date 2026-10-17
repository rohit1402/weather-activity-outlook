import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db/connection.js';

const config = loadConfig();
const db = openDb(config.databasePath);
const server = createServer(createApp(db));

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
