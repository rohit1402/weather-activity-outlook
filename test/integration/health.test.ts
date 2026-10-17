import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { openDb, type Db } from '../../src/db/connection.js';

async function query(app: ReturnType<typeof createApp>, source: string) {
    const res = await app.fetch('http://localhost/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: source }),
    });
    return { status: res.status, body: await res.json() };
}

describe('health query', () => {
    let db: Db;

    beforeEach(() => {
        db = openDb(':memory:');
    });

    afterEach(() => {
        if (db.open) db.close();
    });

    it('reports ok when the database responds', async () => {
        const { status, body } = await query(createApp(db), '{ health { status database } }');
        expect(status).toBe(200);
        expect(body).toEqual({ data: { health: { status: 'ok', database: true } } });
    });

    it('reports degraded when the database is closed', async () => {
        const app = createApp(db);
        db.close();
        const { body } = await query(app, '{ health { status database } }');
        expect(body).toEqual({ data: { health: { status: 'degraded', database: false } } });
    });
});
