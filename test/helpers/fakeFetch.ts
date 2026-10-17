import type { FetchFn } from '../../src/providers/HttpClient.js';

export class FakeFetch {
    readonly urls: URL[] = [];
    down = false;

    constructor(
        private readonly body: string,
        private readonly status = 200,
    ) {}

    readonly fetch: FetchFn = async (input) => {
        this.urls.push(new URL(String(input)));
        if (this.down) throw new TypeError('fetch failed');
        return new Response(this.body, { status: this.status });
    };

    get lastUrl(): URL {
        const url = this.urls.at(-1);
        if (!url) throw new Error('fetch was not called');
        return url;
    }
}

export const hangingFetch: FetchFn = (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    });

export const unreachableFetch: FetchFn = async () => {
    throw new TypeError('fetch failed');
};
