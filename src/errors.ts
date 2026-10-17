export type ErrorCode = 'INVALID_INPUT' | 'LOCATION_NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';

/** Base class for errors the API reports to clients, each with a stable code. */
export abstract class AppError extends Error {
    abstract readonly code: ErrorCode;

    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = new.target.name;
    }
}

export class InvalidInputError extends AppError {
    readonly code = 'INVALID_INPUT';
}

export class LocationNotFoundError extends AppError {
    readonly code = 'LOCATION_NOT_FOUND';

    constructor(
        readonly locationName: string,
        readonly countryCode?: string,
    ) {
        const where = countryCode ? ` in ${countryCode}` : '';
        super(`No location found for "${locationName}"${where}`);
    }
}

/** How a call to an external service failed. */
export type UpstreamFailure =
    | 'timeout' // no response in time
    | 'network' // could not connect
    | 'http' // non-2xx status without a provider error payload
    | 'provider' // provider sent {"error": true, "reason": ...}
    | 'malformed'; // response is not the expected JSON shape

export interface UpstreamErrorOptions extends ErrorOptions {
    status?: number;
}

export class UpstreamUnavailableError extends AppError {
    readonly code = 'UPSTREAM_UNAVAILABLE';
    readonly status?: number;

    constructor(
        readonly service: string,
        readonly failure: UpstreamFailure,
        detail: string,
        options: UpstreamErrorOptions = {},
    ) {
        super(`${service}: ${detail}`, options);
        this.status = options.status;
    }
}
