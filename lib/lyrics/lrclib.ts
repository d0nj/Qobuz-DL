import { z } from 'zod';

/**
 * Lyrics lookup against LRCLIB.
 *
 * The API is a plain GET with no key. A miss is a 404, which is a normal
 * outcome rather than an error: most tracks simply are not in the database,
 * and a download must not fail because lyrics could not be found.
 */

const LRCLIB_ENDPOINT = 'https://lrclib.net/api/get';

/**
 * LRCLIB asks callers to send a identifying User-Agent; requests without one
 * may be rejected.
 */
const USER_AGENT = 'Qobuz-DL/1.0 (https://github.com/renzynx/Qobuz-DL)';

const lyricsSchema = z.object({
    plainLyrics: z.string().nullish(),
    syncedLyrics: z.string().nullish(),
    instrumental: z.boolean().nullish()
});

export type Lyrics = {
    /** Unsynchronised text, newline-separated. */
    plain: string;
    /** LRC format with `[mm:ss.xx]` timestamps, when the database has it. */
    synced: string | null;
    instrumental: boolean;
};

export type LyricsQuery = {
    artist: string;
    title: string;
    album?: string;
    /** Seconds. Narrows the match when several recordings share a title. */
    duration?: number;
};

export type LyricsSource = {
    fetchLyrics: (query: LyricsQuery, signal?: AbortSignal) => Promise<Lyrics | null>;
};

function buildUrl(query: LyricsQuery): string {
    const params = new URLSearchParams({
        artist_name: query.artist,
        track_name: query.title
    });
    if (query.album) params.set('album_name', query.album);
    if (query.duration && Number.isFinite(query.duration)) params.set('duration', String(Math.round(query.duration)));

    return `${LRCLIB_ENDPOINT}?${params.toString()}`;
}

/**
 * Resolve lyrics for one track.
 *
 * Returns `null` for anything other than a usable result — missing, malformed,
 * offline, aborted. Every caller must be able to proceed without lyrics, so a
 * lookup failure is never an exception.
 */
async function fetchLyrics(query: LyricsQuery, signal?: AbortSignal): Promise<Lyrics | null> {
    if (!query.artist.trim() || !query.title.trim()) return null;

    const response = await fetch(buildUrl(query), {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        ...(signal ? { signal } : {})
    });

    // 404 is the ordinary "no entry" answer, not a failure worth surfacing.
    if (!response.ok) return null;

    const parsed = lyricsSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) return null;

    const plain = parsed.data.plainLyrics?.trim();
    if (!plain) return null;

    const synced = parsed.data.syncedLyrics?.trim();
    return {
        plain,
        synced: synced || null,
        instrumental: parsed.data.instrumental ?? false
    };
}

export const lrclib: LyricsSource = { fetchLyrics };

/**
 * Escape a value for an FFMETADATA1 block.
 *
 * Verified against ffmpeg rather than taken from documentation: a raw newline
 * terminates the entry, so multi-line values silently truncate to their first
 * line — every song's lyrics would be cut to one line. Backslash-escaping the
 * newline preserves the whole value.
 *
 * `=`, `;` and `#` also need escaping once they appear after the key.
 */
export function escapeMetadataValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/=/g, '\\=').replace(/;/g, '\\;').replace(/#/g, '\\#').replace(/\r\n|\r|\n/g, '\\\n');
}
