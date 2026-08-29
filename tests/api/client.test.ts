import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, API_ROUTES, createApiClient, getApiClient, HttpTransport, setApiClient } from '@/lib/api/client';

/**
 * The named test adapter: a fake standing in for `fetch` at the HTTP layer.
 *
 * It records the exact URL and headers the client produced — which is the point
 * of injecting here rather than above URL-building, since that is what makes the
 * query-encoding fix observable. It is a `fetch` stand-in, not a business-logic
 * stub, so it still exercises URL construction and response decoding.
 */
type RecordedCall = { url: string; init: RequestInit };

function recordingTransport(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
    const calls: RecordedCall[] = [];
    const transport: HttpTransport = async (url, init) => {
        calls.push({ url, init });
        return respond(url, init);
    };
    return { transport, calls };
}

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }) {
    return new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
}

const envelope = (data: unknown) => jsonResponse({ success: true, data });

afterEach(() => {
    setApiClient(createApiClient());
    vi.restoreAllMocks();
});

describe('URL and header construction', () => {
    it('encodes the query so special characters cannot invent new params', async () => {
        const { transport, calls } = recordingTransport(() => envelope({}));
        await createApiClient(transport).get(API_ROUTES.search, { params: { q: 'tom & jerry', offset: 0 } });

        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe('/api/get-music?q=tom+%26+jerry&offset=0');
    });

    it('encodes the full set of reserved characters', async () => {
        const { transport, calls } = recordingTransport(() => envelope({}));
        for (const q of ['a#b', 'a+b', 'a=b', 'a?b', 'a/b', '50%']) {
            await createApiClient(transport).get(API_ROUTES.search, { params: { q } });
        }
        const urls = calls.map((call) => call.url);
        expect(urls).toContain('/api/get-music?q=a%23b');
        expect(urls).toContain('/api/get-music?q=a%2Bb');
        expect(urls).toContain('/api/get-music?q=a%3Db');
        expect(urls).toContain('/api/get-music?q=a%3Fb');
        // `/` and `%` are encoded too, so a search for "50% off" survives intact.
        expect(urls).toContain('/api/get-music?q=a%2Fb');
        expect(urls).toContain('/api/get-music?q=50%25');
    });

    it('sends Token-Country only when a country is set', async () => {
        const { transport, calls } = recordingTransport(() => envelope({}));
        const client = createApiClient(transport);

        await client.get(API_ROUTES.search, { params: { q: 'x' }, country: 'FR' });
        await client.get(API_ROUTES.search, { params: { q: 'x' } });
        await client.get(API_ROUTES.search, { params: { q: 'x' }, country: null });

        const headers = calls.map((call) => new Headers(call.init.headers));
        expect(headers[0].get('Token-Country')).toBe('FR');
        // An unset country must disappear, not be sent as the text "undefined".
        expect(headers[1].has('Token-Country')).toBe(false);
        expect(headers[2].has('Token-Country')).toBe(false);
        expect(calls[1].url).toBe('/api/get-music?q=x');
    });

    it('omits the question mark entirely when there are no params', async () => {
        const { transport, calls } = recordingTransport(() => envelope([]));
        await createApiClient(transport).get(API_ROUTES.countries);
        expect(calls[0].url).toBe('/api/get-countries');
    });

    it('requests JSON and same-origin credentials', async () => {
        const { transport, calls } = recordingTransport(() => envelope({}));
        await createApiClient(transport).get(API_ROUTES.album, { params: { album_id: 'abc' } });

        const headers = new Headers(calls[0].init.headers);
        expect(headers.get('Accept')).toBe('application/json');
        expect(calls[0].init.credentials).toBe('same-origin');
    });
});

describe('cancellation', () => {
    it('forwards the AbortSignal to the transport', async () => {
        const { transport, calls } = recordingTransport(() => envelope({ url: 'https://example.test/t' }));
        const controller = new AbortController();
        await createApiClient(transport).get(API_ROUTES.download, { params: { track_id: 1 }, signal: controller.signal });
        expect(calls[0].init.signal).toBe(controller.signal);
    });

    it('propagates an abort rather than swallowing it', async () => {
        // Mirrors real fetch: reject once the signal aborts. The download queue
        // relies on this to stop in-flight work.
        const transport: HttpTransport = (url, init) =>
            new Promise((_resolve, reject) => {
                init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })));
            });
        const controller = new AbortController();
        const pending = createApiClient(transport).unwrap(API_ROUTES.download, { params: { track_id: 1 }, signal: controller.signal });
        controller.abort();
        await expect(pending).rejects.toThrow(/abort/i);
    });
});

describe('response decoding', () => {
    it('returns the payload on success', async () => {
        const { transport } = recordingTransport(() => envelope({ url: 'https://example.test/t' }));
        await expect(createApiClient(transport).unwrap<{ url: string }>(API_ROUTES.download, { params: { track_id: 1 } })).resolves.toEqual({
            url: 'https://example.test/t'
        });
    });

    it('returns a failure envelope for a route error instead of throwing', async () => {
        const { transport } = recordingTransport(() => jsonResponse({ success: false, error: 'Query is required' }, { status: 400 }));
        await expect(createApiClient(transport).get(API_ROUTES.search, { params: { q: '' } })).resolves.toEqual({
            success: false,
            error: 'Query is required'
        });
    });

    it('flags a non-JSON error page instead of throwing a parse error', async () => {
        const { transport } = recordingTransport(() => new Response('<html>nope</html>', { status: 500, headers: { 'content-type': 'text/html' } }));
        const response = await createApiClient(transport).get(API_ROUTES.search, { params: { q: 'x' } });
        expect(response.success).toBe(false);
    });

    it('flags a body that is not valid JSON', async () => {
        const { transport } = recordingTransport(() => new Response('{not json', { headers: { 'content-type': 'application/json' } }));
        await expect(createApiClient(transport).get(API_ROUTES.search, { params: { q: 'x' } })).resolves.toMatchObject({ success: false });
    });

    it('flags a JSON body missing the success flag', async () => {
        const { transport } = recordingTransport(() => jsonResponse({ data: 'orphan' }));
        await expect(createApiClient(transport).get(API_ROUTES.search, { params: { q: 'x' } })).resolves.toMatchObject({ success: false });
    });

    it('throws ApiError from unwrap on failure, carrying the envelope error', async () => {
        const { transport } = recordingTransport(() => jsonResponse({ success: false, error: { path: 'q', message: 'Query is required' } }, { status: 400 }));
        const error: unknown = await createApiClient(transport).unwrap(API_ROUTES.search, { params: { q: '' } }).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).cause).toEqual({ path: 'q', message: 'Query is required' });
        expect((error as ApiError).detail).toBe('{"path":"q","message":"Query is required"}');
    });

    it('exposes a display-ready detail string for string errors', async () => {
        const { transport } = recordingTransport(() => jsonResponse({ success: false, error: 'Query is required' }, { status: 400 }));
        const error = (await createApiClient(transport).unwrap(API_ROUTES.search, { params: { q: '' } }).catch((e: unknown) => e)) as ApiError;
        expect(error.detail).toBe('Query is required');
    });
});

describe('substitutability', () => {
    it('lets a recording fake replace fetch without touching a call site', async () => {
        const { transport, calls } = recordingTransport(() => envelope({ stubbed: true }));
        setApiClient(createApiClient(transport));

        const data = await getApiClient().unwrap<{ stubbed: boolean }>(API_ROUTES.album, { params: { album_id: 'abc' }, country: 'US' });

        expect(data).toEqual({ stubbed: true });
        expect(calls[0].url).toBe('/api/get-album?album_id=abc');
        expect(new Headers(calls[0].init.headers).get('Token-Country')).toBe('US');
    });

    it('routes every path through the substitute', async () => {
        const { transport, calls } = recordingTransport(() => envelope({}));
        setApiClient(createApiClient(transport));
        const client = getApiClient();

        for (const route of Object.values(API_ROUTES)) await client.get(route);

        expect(calls.map((call) => call.url.split('?')[0])).toEqual(Object.values(API_ROUTES));
    });

    it('route table covers exactly the six /api paths', () => {
        expect(API_ROUTES).toEqual({
            search: '/api/get-music',
            album: '/api/get-album',
            artist: '/api/get-artist',
            releases: '/api/get-releases',
            download: '/api/download-music',
            countries: '/api/get-countries'
        });
    });
});

describe('default transport', () => {
    it('delegates to fetch', async () => {
        const spy = vi.fn().mockResolvedValue(envelope({}));
        vi.stubGlobal('fetch', spy);

        await createApiClient().get(API_ROUTES.search, { params: { q: 'x' } });

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toBe('/api/get-music?q=x');
    });
});
