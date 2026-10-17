import { describe, expect, it } from 'vitest';
import { UpstreamUnavailableError } from '../../src/errors.js';
import { HttpClient, type FetchFn } from '../../src/providers/HttpClient.js';
import { FakeFetch, hangingFetch, unreachableFetch } from '../helpers/fakeFetch.js';

const URL_UNDER_TEST = new URL('https://example.test/v1/search');

function client(fetch: FetchFn, timeoutMs = 1000): HttpClient {
    return new HttpClient({ service: 'Test API', timeoutMs, fetch });
}

async function upstreamError(promise: Promise<unknown>): Promise<UpstreamUnavailableError> {
    const err = await promise.then(
        () => undefined,
        (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(UpstreamUnavailableError);
    return err as UpstreamUnavailableError;
}

describe('HttpClient.getJson', () => {
    it('returns the parsed JSON object', async () => {
        const fake = new FakeFetch('{"a":1}');
        await expect(client(fake.fetch).getJson(URL_UNDER_TEST)).resolves.toEqual({ a: 1 });
        expect(fake.lastUrl.href).toBe(URL_UNDER_TEST.href);
    });

    it('reports a timeout when the service does not answer in time', async () => {
        const err = await upstreamError(client(hangingFetch, 20).getJson(URL_UNDER_TEST));
        expect(err).toMatchObject({
            code: 'UPSTREAM_UNAVAILABLE',
            service: 'Test API',
            failure: 'timeout',
            message: 'Test API: no response within 20 ms',
        });
    });

    it('reports a network failure and keeps the original error as cause', async () => {
        const err = await upstreamError(client(unreachableFetch).getJson(URL_UNDER_TEST));
        expect(err.failure).toBe('network');
        expect(err.message).toBe('Test API: request failed: fetch failed');
        expect(err.cause).toBeInstanceOf(TypeError);
    });

    it('reports an HTTP error with its status when the body is not JSON', async () => {
        const fake = new FakeFetch('<html>Bad gateway</html>', 502);
        const err = await upstreamError(client(fake.fetch).getJson(URL_UNDER_TEST));
        expect(err).toMatchObject({ failure: 'http', status: 502 });
    });

    it('reports a provider error payload sent with an error status', async () => {
        // Shape returned by the live geocoding API for count=abc.
        const fake = new FakeFetch(
            '{"error":true,"reason":"Value was not of type \'Int\' at path \'count\'."}',
            400,
        );
        const err = await upstreamError(client(fake.fetch).getJson(URL_UNDER_TEST));
        expect(err).toMatchObject({ failure: 'provider', status: 400 });
        expect(err.message).toContain("Value was not of type 'Int'");
    });

    it('reports a provider error payload even with HTTP 200', async () => {
        const fake = new FakeFetch('{"error":true,"reason":"The service is overloaded"}');
        const err = await upstreamError(client(fake.fetch).getJson(URL_UNDER_TEST));
        expect(err).toMatchObject({
            failure: 'provider',
            message: 'Test API: The service is overloaded',
        });
    });

    it.each([
        ['invalid JSON', '{"results": ['],
        ['an empty body', ''],
        ['a JSON array', '[1, 2]'],
        ['JSON null', 'null'],
        ['a JSON string', '"ok"'],
    ])('reports %s as malformed', async (_label, body) => {
        const err = await upstreamError(client(new FakeFetch(body).fetch).getJson(URL_UNDER_TEST));
        expect(err.failure).toBe('malformed');
    });
});
