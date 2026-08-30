import { describe, expect, it, vi } from 'vitest';
import { escapeMetadataValue, lrclib, type LyricsQuery } from '@/lib/lyrics/lrclib';

/** Stub the network so tests never depend on LRCLIB being reachable. */
function stubFetch(response: Partial<Response>) {
    const spy = vi.spyOn(globalThis, 'fetch');
    spy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        ...response
    } as Response);
    return spy;
}

const query: LyricsQuery = { artist: 'Radiohead', title: 'Creep', album: 'Pablo Honey', duration: 239 };

describe('lrclib lookup', () => {
    it('asks for the track by artist, title, album and duration', async () => {
        const spy = stubFetch({ ok: true, json: async () => ({ plainLyrics: 'a\nb' }) });
        await lrclib.fetchLyrics(query);

        const url = new URL(String(spy.mock.calls[0][0]));
        expect(url.origin + url.pathname).toBe('https://lrclib.net/api/get');
        expect(url.searchParams.get('artist_name')).toBe('Radiohead');
        expect(url.searchParams.get('track_name')).toBe('Creep');
        expect(url.searchParams.get('album_name')).toBe('Pablo Honey');
        expect(url.searchParams.get('duration')).toBe('239');
    });

    it('identifies itself with a User-Agent', async () => {
        const spy = stubFetch({ ok: true, json: async () => ({ plainLyrics: 'x' }) });
        await lrclib.fetchLyrics(query);
        const headers = spy.mock.calls[0][1]?.headers as Record<string, string>;
        expect(headers['User-Agent']).toBeTruthy();
    });

    it('returns plain and synced lyrics when both are present', async () => {
        stubFetch({
            ok: true,
            json: async () => ({ plainLyrics: 'plain text', syncedLyrics: '[00:19.16] timed', instrumental: false })
        });
        const result = await lrclib.fetchLyrics(query);
        expect(result).toEqual({ plain: 'plain text', synced: '[00:19.16] timed', instrumental: false });
    });

    it('treats a 404 as no lyrics rather than an error', async () => {
        // Most tracks are absent from the database; a download must still finish.
        stubFetch({ ok: false, status: 404 });
        await expect(lrclib.fetchLyrics(query)).resolves.toBeNull();
    });

    it('returns null when the entry has no usable text', async () => {
        stubFetch({ ok: true, json: async () => ({ plainLyrics: null, syncedLyrics: null }) });
        await expect(lrclib.fetchLyrics(query)).resolves.toBeNull();
    });

    it('returns null for an instrumental entry with no lyrics', async () => {
        stubFetch({ ok: true, json: async () => ({ plainLyrics: '   ', instrumental: true }) });
        await expect(lrclib.fetchLyrics(query)).resolves.toBeNull();
    });

    it('survives malformed JSON', async () => {
        stubFetch({ ok: true, json: async () => 'not an object' });
        await expect(lrclib.fetchLyrics(query)).resolves.toBeNull();
    });

    it('survives a rejected JSON parse', async () => {
        stubFetch({ ok: true, json: async () => Promise.reject(new Error('bad json')) });
        await expect(lrclib.fetchLyrics(query)).resolves.toBeNull();
    });

    it('skips the request when artist or title is empty', async () => {
        const spy = stubFetch({ ok: true, json: async () => ({}) });
        await expect(lrclib.fetchLyrics({ artist: '', title: 'Creep' })).resolves.toBeNull();
        await expect(lrclib.fetchLyrics({ artist: 'Radiohead', title: '  ' })).resolves.toBeNull();
        expect(spy).not.toHaveBeenCalled();
    });

    it('lets a cancelled download abort the lookup', async () => {
        const spy = stubFetch({ ok: true, json: async () => ({ plainLyrics: 'x' }) });
        const controller = new AbortController();
        await lrclib.fetchLyrics(query, controller.signal);
        expect(spy.mock.calls[0][1]?.signal).toBe(controller.signal);
    });
});

/**
 * Verified against ffmpeg 7.1 rather than assumed: an unescaped newline ends
 * the FFMETADATA1 entry, so multi-line lyrics silently truncate to their first
 * line. Every assertion here guards that.
 */
describe('escapeMetadataValue', () => {
    it('escapes newlines so multi-line lyrics survive', () => {
        expect(escapeMetadataValue('one\ntwo')).toBe('one\\\ntwo');
    });

    it('escapes the characters that terminate a key or value', () => {
        expect(escapeMetadataValue('a=b')).toBe('a\\=b');
        expect(escapeMetadataValue('a;b')).toBe('a\\;b');
        expect(escapeMetadataValue('a#b')).toBe('a\\#b');
    });

    it('escapes backslashes before anything else', () => {
        expect(escapeMetadataValue('a\\b')).toBe('a\\\\b');
    });

    it('normalises CRLF and CR to the ffmpeg line separator', () => {
        expect(escapeMetadataValue('a\r\nb')).toBe('a\\\nb');
        expect(escapeMetadataValue('a\rb')).toBe('a\\\nb');
    });

    it('leaves ordinary lyrics untouched', () => {
        const lyrics = "When you were here before\nCouldn't look you in the eye";
        expect(escapeMetadataValue(lyrics)).toBe(lyrics.replace(/\n/g, '\\\n'));
    });
});
