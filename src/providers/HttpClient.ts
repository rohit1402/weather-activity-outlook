import {
    UpstreamUnavailableError,
    type UpstreamErrorOptions,
    type UpstreamFailure,
} from '../errors.js';

export type FetchFn = typeof fetch;

export type JsonObject = Record<string, unknown>;

export interface HttpClientOptions {
    service: string;
    timeoutMs: number;
    fetch?: FetchFn;
}

export class HttpClient {
    readonly service: string;
    private readonly timeoutMs: number;
    private readonly fetchFn: FetchFn;

    constructor(options: HttpClientOptions) {
        this.service = options.service;
        this.timeoutMs = options.timeoutMs;
        this.fetchFn = options.fetch ?? fetch;
    }

    async getJson(url: URL): Promise<JsonObject> {
        const { status, ok, text } = await this.send(url);
        const body = HttpClient.parseObject(text);

        if (body?.error === true) {
            const reason = typeof body.reason === 'string' ? body.reason : 'unknown reason';
            throw this.failure('provider', reason, { status });
        }
        if (!ok) {
            throw this.failure('http', `HTTP ${status}`, { status });
        }
        if (!body) {
            throw this.failure('malformed', 'response is not a JSON object', { status });
        }
        return body;
    }

    failure(
        failure: UpstreamFailure,
        detail: string,
        options?: UpstreamErrorOptions,
    ): UpstreamUnavailableError {
        return new UpstreamUnavailableError(this.service, failure, detail, options);
    }

    private async send(url: URL): Promise<{ status: number; ok: boolean; text: string }> {
        try {
            const res = await this.fetchFn(url, { signal: AbortSignal.timeout(this.timeoutMs) });

            return {
                status: res.status,
                ok: res.ok,
                text: await res.text(),
            };
        } catch (err) {
            if (err instanceof Error && err.name === 'TimeoutError') {
                throw this.failure('timeout', `no response within ${this.timeoutMs} ms`, {
                    cause: err,
                });
            }

            const detail = err instanceof Error ? err.message : String(err);
            throw this.failure('network', `request failed: ${detail}`, { cause: err });
        }
    }

    private static parseObject(text: string): JsonObject | undefined {
        try {
            const value: unknown = JSON.parse(text);
            return isJsonObject(value) ? value : undefined;
        } catch {
            return undefined;
        }
    }
}

export function isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
