'use client';

import { buildUrl, QueryParams } from './query';

/**
 * The browser side of the `/api/*` seam.
 *
 * Every `/api/*` call in the app goes through a single `ApiClient` instance
 * (`api` below). Tests substitute a different transport via `setApiClient`
 * or `createApiClient`, without touching a single call site.
 */

export type ApiResponse<TData> =
    | { success: true; data: TData }
    | { success: false; error: unknown };

/**
 * The substitutable unit: the minimal `fetch` surface — a URL plus a request
 * init, resolving to a `Response`.
 *
 * Injection happens at this layer rather than above URL-building on purpose: it
 * puts the seam where the wire is, so a test double observes the exact URL and
 * headers the client produced. That is what makes the query-encoding fix
 * assertable — a seam above this point would hand the fake a params object and
 * hide the encoding that was actually applied.
 */
export type HttpTransport = (url: string, init: RequestInit) => Promise<Response>;

export type ApiRequestOptions = {
    params?: QueryParams;
    /** ISO country code; omitted from the request when nullish. */
    country?: string | null;
    signal?: AbortSignal;
};

const JSON_HEADERS = { Accept: 'application/json' };

/** Default transport, backed by `fetch`. */
export const fetchTransport: HttpTransport = (url, init) => fetch(url, init);

/**
 * Decodes an HTTP response into the shared envelope.
 *
 * Transport-level failures still throw (network down, aborted); a well-formed
 * `{ success: false }` body is returned as a value so callers can branch.
 */
async function toEnvelope<TData>(response: Response): Promise<ApiResponse<TData>> {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        return { success: false, error: `Unexpected content type "${contentType || 'none'}" from ${response.url || 'response'}` };
    }
    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        return { success: false, error: 'Malformed response: body was not valid JSON.' };
    }
    if (payload && typeof payload === 'object' && 'success' in payload) {
        return payload as ApiResponse<TData>;
    }
    return { success: false, error: 'Malformed response: missing success flag.' };
}

/** The `/api/*` paths, so call sites never hand-write one. */
export const API_ROUTES = {
    search: '/api/get-music',
    album: '/api/get-album',
    artist: '/api/get-artist',
    releases: '/api/get-releases',
    download: '/api/download-music',
    countries: '/api/get-countries'
} as const;

/** Thrown by `unwrap` so callers can keep their existing try/catch shape. */
export class ApiError extends Error {
    readonly cause: unknown;

    constructor(cause: unknown, message: string = 'Request failed.') {
        super(message);
        this.name = 'ApiError';
        this.cause = cause;
    }

    /** The error body sent by the route, stringified for display. */
    get detail(): string {
        return typeof this.cause === 'string' ? this.cause : JSON.stringify(this.cause);
    }
}

export type ApiClient = {
    /** Returns the envelope, including `{ success: false }` for route-level errors. */
    get: <TData>(path: string, options?: ApiRequestOptions) => Promise<ApiResponse<TData>>;
    /** Resolves the typed payload, or throws `ApiError` carrying the envelope's error. */
    unwrap: <TData>(path: string, options?: ApiRequestOptions) => Promise<TData>;
    routes: typeof API_ROUTES;
};

export function createApiClient(transport: HttpTransport = fetchTransport): ApiClient {
    const get = async <TData>(path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<TData>> => {
        const url = buildUrl(path, options.params);
        const headers = new Headers(JSON_HEADERS);
        if (options.country) headers.set('Token-Country', options.country);
        // `fetch` rejects when the signal aborts, and the download queue depends on
        // that to cancel in-flight work, so the signal is passed straight through.
        const response = await transport(url, {
            headers,
            signal: options.signal ?? null,
            credentials: 'same-origin'
        });
        return toEnvelope<TData>(response);
    };

    const unwrap = async <TData>(path: string, options: ApiRequestOptions = {}): Promise<TData> => {
        const envelope = await get<TData>(path, options);
        if (!envelope.success) throw new ApiError(envelope.error);
        return envelope.data;
    };

    return { get, unwrap, routes: API_ROUTES };
}

export const api: ApiClient = createApiClient();

let activeClient: ApiClient = api;

/** Substitutes the client returned by `getApiClient`. */
export function setApiClient(client: ApiClient): void {
    activeClient = client;
}

export function getApiClient(): ApiClient {
    return activeClient;
}

export type { QueryParams };
