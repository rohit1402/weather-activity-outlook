import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unreachableFetch } from '../helpers/fakeFetch.js';
import { TestApp } from '../helpers/testApp.js';

const HEALTH = '{ health { status database } }';

describe('health query', () => {
    let testApp: TestApp;

    beforeEach(() => {
        testApp = new TestApp({ fetch: unreachableFetch });
    });

    afterEach(() => testApp.close());

    it('reports ok when the database responds', async () => {
        const { status, body } = await testApp.query(HEALTH);
        expect(status).toBe(200);
        expect(body).toEqual({ data: { health: { status: 'ok', database: true } } });
    });

    it('reports degraded when the database is closed', async () => {
        testApp.db.close();
        const { body } = await testApp.query(HEALTH);
        expect(body).toEqual({ data: { health: { status: 'degraded', database: false } } });
    });
});
