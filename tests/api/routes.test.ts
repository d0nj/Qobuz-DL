import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const search = vi.fn();
const getAlbumInfo = vi.fn();
const getArtist = vi.fn();
const getArtistReleases = vi.fn();
const getDownloadURL = vi.fn();

vi.mock('@/lib/qobuz-dl-server', () => ({
    search: (...args: unknown[]) => search(...args),
    getAlbumInfo: (...args: unknown[]) => getAlbumInfo(...args),
    getArtist: (...args: unknown[]) => getArtist(...args),
    getArtistReleases: (...args: unknown[]) => getArtistReleases(...args),
    getDownloadURL: (...args: unknown[]) => getDownloadURL(...args)
}));

function request(path: string, country?: string) {
    return new Request(`http://localhost${path}`, country ? { headers: { 'Token-Country': country } } : undefined);
}

beforeEach(() => {
    search.mockReset();
    getAlbumInfo.mockReset();
    getArtist.mockReset();
    getArtistReleases.mockReset();
    getDownloadURL.mockReset();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GET /api/get-releases', () => {
    it('accepts track_size as a query string', async () => {
        // The bug: track_size was a bare z.number(), so the string "1000" failed
        // validation and every paginated artist fetch 400'd.
        getArtistReleases.mockResolvedValue({ items: [], has_more: false });
        const { GET } = await import('@/app/api/get-releases/route');

        const response = await GET(request('/api/get-releases?artist_id=1&release_type=album&track_size=1000&offset=0&limit=10'));

        expect(response.status).toBe(200);
        expect(getArtistReleases).toHaveBeenCalledWith('1', 'album', 10, 0, 1000, {});
    });

    it('applies documented defaults when optional params are omitted', async () => {
        getArtistReleases.mockResolvedValue({ items: [], has_more: false });
        const { GET } = await import('@/app/api/get-releases/route');

        const response = await GET(request('/api/get-releases?artist_id=1'));

        expect(response.status).toBe(200);
        expect(getArtistReleases).toHaveBeenCalledWith('1', 'album', 10, 0, 1000, {});
    });

    it('accepts offset=0, which is falsy but valid', async () => {
        getArtistReleases.mockResolvedValue({ items: [], has_more: false });
        const { GET } = await import('@/app/api/get-releases/route');

        const response = await GET(request('/api/get-releases?artist_id=1&offset=0&limit=5&track_size=50'));

        expect(response.status).toBe(200);
        expect(getArtistReleases).toHaveBeenCalledWith('1', 'album', 5, 0, 50, {});
    });

    it('rejects a non-numeric track_size with a 400 envelope', async () => {
        const { GET } = await import('@/app/api/get-releases/route');

        const response = await GET(request('/api/get-releases?artist_id=1&track_size=abc'));

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ success: false });
        expect(getArtistReleases).not.toHaveBeenCalled();
    });

    it('rejects a missing artist_id with a 400 envelope', async () => {
        const { GET } = await import('@/app/api/get-releases/route');

        const response = await GET(request('/api/get-releases'));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.success).toBe(false);
        expect(JSON.stringify(body.error)).toContain('ID is required');
    });

    it('rejects an unknown release_type', async () => {
        const { GET } = await import('@/app/api/get-releases/route');

        const response = await GET(request('/api/get-releases?artist_id=1&release_type=nope'));

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ success: false });
    });

    it('forwards Token-Country as a country option', async () => {
        getArtistReleases.mockResolvedValue({ items: [], has_more: false });
        const { GET } = await import('@/app/api/get-releases/route');

        await GET(request('/api/get-releases?artist_id=1', 'FR'));

        expect(getArtistReleases).toHaveBeenCalledWith('1', 'album', 10, 0, 1000, { country: 'FR' });
    });
});

describe('GET /api/get-music', () => {
    it('passes the query through with the fixed limit', async () => {
        search.mockResolvedValue({ query: 'x' });
        const { GET } = await import('@/app/api/get-music/route');

        const response = await GET(request('/api/get-music?q=test&offset=20'));

        expect(response.status).toBe(200);
        expect(search).toHaveBeenCalledWith('test', 10, 20, {});
    });

    it('decodes an encoded query so search terms survive intact', async () => {
        search.mockResolvedValue({ query: 'tom & jerry' });
        const { GET } = await import('@/app/api/get-music/route');

        // This is what the client now sends for the query `tom & jerry`; the
        // server must read it back as one term rather than `tom ` + `jerry`.
        const response = await GET(request('/api/get-music?q=tom+%26+jerry'));

        expect(response.status).toBe(200);
        expect(search).toHaveBeenCalledWith('tom & jerry', 10, 0, {});
    });

    it('decodes non-ASCII search terms', async () => {
        search.mockResolvedValue({ query: 'Björk' });
        const { GET } = await import('@/app/api/get-music/route');

        const response = await GET(request(`/api/get-music?q=${encodeURIComponent('Björk')}`));

        expect(response.status).toBe(200);
        expect(search).toHaveBeenCalledWith('Björk', 10, 0, {});
    });

    it('defaults offset to 0 and rejects a missing query', async () => {
        const { GET } = await import('@/app/api/get-music/route');

        expect((await GET(request('/api/get-music?q=x'))).status).toBe(200);
        expect(search).toHaveBeenCalledWith('x', 10, 0, {});

        expect((await GET(request('/api/get-music'))).status).toBe(400);
    });

    it('rejects an offset above the ceiling', async () => {
        const { GET } = await import('@/app/api/get-music/route');

        const response = await GET(request('/api/get-music?q=x&offset=5000'));

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ success: false });
    });
});

describe('GET /api/get-album', () => {
    it('returns album data under data', async () => {
        getAlbumInfo.mockResolvedValue({ id: 'abc' });
        const { GET } = await import('@/app/api/get-album/route');

        const response = await GET(request('/api/get-album?album_id=abc'));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ success: true, data: { id: 'abc' } });
        expect(getAlbumInfo).toHaveBeenCalledWith('abc', {});
    });

    it('rejects a missing album_id', async () => {
        const { GET } = await import('@/app/api/get-album/route');
        expect((await GET(request('/api/get-album'))).status).toBe(400);
    });
});

describe('GET /api/get-artist', () => {
    it('nests the artist under data, matching what parseArtistData expects', async () => {
        getArtist.mockResolvedValue({ id: '1', name: { display: 'A' } });
        const { GET } = await import('@/app/api/get-artist/route');

        const response = await GET(request('/api/get-artist?artist_id=1'));

        expect(response.status).toBe(200);
        const body = await response.json();
        // Shape preserved: artist-dialog reads response.data.data and passes it
        // straight to parseArtistData, which expects { artist: ... }.
        expect(body.data.artist).toEqual({ id: '1', name: { display: 'A' } });
        expect(getArtist).toHaveBeenCalledWith('1', {});
    });

    it('rejects a missing artist_id', async () => {
        const { GET } = await import('@/app/api/get-artist/route');
        expect((await GET(request('/api/get-artist'))).status).toBe(400);
    });
});

describe('GET /api/download-music', () => {
    it('accepts a numeric track_id and returns the url under data', async () => {
        getDownloadURL.mockResolvedValue('https://example.test/t');
        const { GET } = await import('@/app/api/download-music/route');

        const response = await GET(request('/api/download-music?track_id=123&quality=27'));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ success: true, data: { url: 'https://example.test/t' } });
        expect(getDownloadURL).toHaveBeenCalledWith(123, '27', {});
    });

    it('defaults quality to 27 and accepts each valid quality', async () => {
        getDownloadURL.mockResolvedValue('https://example.test/t');
        const { GET } = await import('@/app/api/download-music/route');

        await GET(request('/api/download-music?track_id=1'));
        expect(getDownloadURL).toHaveBeenCalledWith(1, '27', {});

        for (const quality of ['27', '7', '6', '5']) {
            await GET(request(`/api/download-music?track_id=1&quality=${quality}`));
            expect(getDownloadURL).toHaveBeenLastCalledWith(1, quality, {});
        }
    });

    it('rejects an invalid quality', async () => {
        const { GET } = await import('@/app/api/download-music/route');

        const response = await GET(request('/api/download-music?track_id=1&quality=99'));

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ success: false });
        expect(getDownloadURL).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric track_id', async () => {
        const { GET } = await import('@/app/api/download-music/route');
        expect((await GET(request('/api/download-music?track_id=abc'))).status).toBe(400);
    });
});

describe('GET /api/get-countries', () => {
    it('returns 200 with an empty list, since an empty list is the default config', async () => {
        // The bug: this returned { success: false } with no status, so the status
        // said 200 OK while the body said failure.
        const { GET } = await import('@/app/api/get-countries/route');

        const response = await GET();

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ success: true, data: [] });
    });
});

describe('upstream failures', () => {
    it('become a 400 failure envelope rather than an unhandled rejection', async () => {
        getAlbumInfo.mockRejectedValue(new Error('upstream exploded'));
        const { GET } = await import('@/app/api/get-album/route');

        const response = await GET(request('/api/get-album?album_id=abc'));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ success: false, error: 'upstream exploded' });
    });

    it('never leak a stack trace to the client', async () => {
        getAlbumInfo.mockRejectedValue(new Error('secret internal detail'));
        const { GET } = await import('@/app/api/get-album/route');

        const body = await (await GET(request('/api/get-album?album_id=abc'))).json();

        expect(body.error).toBe('secret internal detail');
        expect(JSON.stringify(body)).not.toContain('at ');
        expect(JSON.stringify(body)).not.toContain('.ts:');
    });

    it('surface zod issues without internal structures', async () => {
        const { GET } = await import('@/app/api/get-releases/route');

        const body = await (await GET(request('/api/get-releases?artist_id=1&track_size=abc'))).json();

        expect(body.success).toBe(false);
        const serialized = JSON.stringify(body.error);
        expect(serialized).not.toContain('ZodError');
        expect(serialized).not.toContain('invalid_type');
    });
});
