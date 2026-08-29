import { describe, expect, it } from 'vitest';
import {
    describeCatalogueItem,
    filterExplicit,
    formatArtists,
    formatTitle,
    getAlbum,
    getType,
    isArtist,
    isTrack,
    parseArtistAlbumData,
    type QobuzAlbum,
    type QobuzArtist,
    type QobuzTrack
} from '@/lib/qobuz-dl';

const image = { small: 's.jpg', thumbnail: 't.jpg', large: 'l.jpg', back: null };

const album: QobuzAlbum = {
    id: '1',
    title: 'Blue',
    version: null,
    image,
    artist: { id: 10, name: 'Joni Mitchell', albums_count: 3, image: null },
    artists: [{ id: 10, name: 'Joni Mitchell', roles: ['main'] }],
    released_at: 46080000,
    release_date_original: '1971-06-25',
    label: { name: 'Reprise', id: 2, albums_count: 1 },
    tracks_count: 12,
    duration: 2200,
    genre: { name: 'Folk', id: 1, path: [], color: '' },
    maximum_bit_depth: 24,
    maximum_sampling_rate: 192,
    parental_warning: false,
    qobuz_id: 1,
    hires: true,
    streamable: true,
    upc: '123'
} as QobuzAlbum;

const track: QobuzTrack = {
    id: 99,
    title: 'A Case of You',
    version: null,
    isrc: 'GBAYE0001234',
    copyright: '2024',
    album,
    artist: album.artist,
    track_number: 3,
    media_number: 1,
    released_at: 46080000,
    duration: 270,
    parental_warning: true,
    maximum_bit_depth: 24,
    maximum_sampling_rate: 192,
    performer: { id: 10, name: 'Joni Mitchell' },
    hires: true,
    streamable: true
} as unknown as QobuzTrack;

const artist: QobuzArtist = {
    id: 10,
    name: 'Joni Mitchell',
    albums_count: 3,
    image: null
} as QobuzArtist;

describe('getType', () => {
    it('identifies each shape', () => {
        expect(getType(album)).toBe('albums');
        expect(getType(track)).toBe('tracks');
        expect(getType(artist)).toBe('artists');
    });

    it('does not silently classify an unknown shape as an album', () => {
        // Previously the fallback returned 'albums' by elimination, so an
        // unrecognised payload rendered as an album card.
        expect(getType({} as QobuzAlbum)).toBe('unknown');
        expect(getType({ title: 'orphan' } as QobuzAlbum)).toBe('unknown');
    });

    it('does not throw on null, undefined, or primitives', () => {
        for (const value of [null, undefined, 0, '', 'album', []]) {
            expect(() => getType(value as unknown as QobuzAlbum)).not.toThrow();
        }
        expect(getType(null as unknown as QobuzAlbum)).toBe('unknown');
    });

    it('prefers artist when a shape carries both artist and album keys', () => {
        expect(getType({ albums_count: 3, album } as unknown as QobuzArtist)).toBe('artists');
    });
});

describe('isArtist / isTrack', () => {
    it('narrows each shape', () => {
        expect(isArtist(artist)).toBe(true);
        expect(isArtist(album)).toBe(false);
        expect(isTrack(track)).toBe(true);
        expect(isTrack(album)).toBe(false);
    });
});

describe('getAlbum', () => {
    it('returns the album itself for an album', () => {
        expect(getAlbum(album)).toBe(album);
    });

    it('returns the parent album for a track', () => {
        expect(getAlbum(track)).toBe(album);
    });
});

describe('formatTitle', () => {
    it('uses title and appends the version', () => {
        expect(formatTitle(album)).toBe('Blue');
        expect(formatTitle({ ...album, version: 'Deluxe' })).toBe('Blue (Deluxe)');
    });

    it('uses name for an artist', () => {
        expect(formatTitle(artist)).toBe('Joni Mitchell');
    });

    it('ignores a null version', () => {
        expect(formatTitle({ ...album, version: null })).toBe('Blue');
    });
});

describe('formatArtists', () => {
    it('joins album artists', () => {
        expect(formatArtists({ ...album, artists: [{ id: 1, name: 'A', roles: [] }, { id: 2, name: 'B', roles: [] }] })).toBe('A, B');
    });

    it('honours a custom separator', () => {
        expect(formatArtists({ ...album, artists: [{ id: 1, name: 'A', roles: [] }, { id: 2, name: 'B', roles: [] }] }, ' & ')).toBe('A & B');
    });

    it('falls back to performer, then Various Artists', () => {
        expect(formatArtists({ ...track, album: { ...album, artists: [] } } as QobuzTrack)).toBe('Joni Mitchell');
        expect(formatArtists({ ...track, album: { ...album, artists: [] }, performer: undefined } as QobuzTrack)).toBe('Various Artists');
    });
});

describe('filterExplicit', () => {
    const results = {
        query: 'q',
        switchTo: null,
        albums: { limit: 10, offset: 0, total: 2, items: [{ ...album, parental_warning: true }, { ...album, id: '2', parental_warning: false }] },
        tracks: { limit: 10, offset: 0, total: 1, items: [{ ...track, parental_warning: true }] },
        artists: { limit: 10, offset: 0, total: 1, items: [artist] }
    };

    it('keeps everything when explicit is on', () => {
        const out = filterExplicit(results, true);
        expect(out.albums.items).toHaveLength(2);
        expect(out.tracks.items).toHaveLength(1);
    });

    it('removes flagged albums and tracks when explicit is off', () => {
        const out = filterExplicit(results, false);
        expect(out.albums.items).toHaveLength(1);
        expect(out.tracks.items).toHaveLength(0);
    });

    it('never filters artists', () => {
        expect(filterExplicit(results, false).artists.items).toHaveLength(1);
    });

    it('does not mutate its input', () => {
        const before = JSON.stringify(results);
        filterExplicit(results, false);
        expect(JSON.stringify(results)).toBe(before);
    });

    it('defaults to keeping everything', () => {
        expect(filterExplicit(results).albums.items).toHaveLength(2);
    });
});

describe('parseArtistAlbumData', () => {
    it('normalises the nested payload', () => {
        const raw = {
            ...album,
            audio_info: { maximum_sampling_rate: 96, maximum_bit_depth: 16 },
            rights: { streamable: false },
            dates: { stream: 46080000, original: '1971-06-25' }
        } as unknown as QobuzAlbum;

        const parsed = parseArtistAlbumData(raw);
        expect(parsed.maximum_sampling_rate).toBe(96);
        expect(parsed.maximum_bit_depth).toBe(16);
        expect(parsed.streamable).toBe(false);
    });

    it('does not mutate its input', () => {
        const raw = {
            ...album,
            audio_info: { maximum_sampling_rate: 96, maximum_bit_depth: 16 },
            rights: { streamable: false },
            dates: { stream: 46080000, original: '1971-06-25' }
        } as unknown as QobuzAlbum;

        const snapshot = JSON.stringify(raw);
        parseArtistAlbumData(raw);
        expect(JSON.stringify(raw)).toBe(snapshot);
    });

    it('is idempotent', () => {
        const raw = {
            ...album,
            audio_info: { maximum_sampling_rate: 96, maximum_bit_depth: 16 },
            rights: { streamable: false },
            dates: { stream: 46080000, original: '1971-06-25' }
        } as unknown as QobuzAlbum;

        const once = parseArtistAlbumData(raw);
        const twice = parseArtistAlbumData(once);
        expect(twice).toEqual(once);
    });
});

describe('describeCatalogueItem', () => {
    it('resolves an album', () => {
        const view = describeCatalogueItem(album);
        expect(view.kind).toBe('albums');
        expect(view.isArtist).toBe(false);
        expect(view.title).toBe('Blue');
        expect(view.tracksCount).toBe(12);
        expect(view.bitDepth).toBe(24);
        expect(view.artists).toBe('Joni Mitchell');
    });

    it('resolves a track', () => {
        const view = describeCatalogueItem(track);
        expect(view.kind).toBe('tracks');
        expect(view.isTrack).toBe(true);
        expect(view.title).toBe('A Case of You');
    });

    it('resolves an artist', () => {
        const view = describeCatalogueItem(artist);
        expect(view.kind).toBe('artists');
        expect(view.isArtist).toBe(true);
        expect(view.title).toBe('Joni Mitchell');
        expect(view.artists).toBe('');
    });

    it('never throws on a degenerate input', () => {
        for (const value of [null, undefined, {}, { title: 'x' }]) {
            expect(() => describeCatalogueItem(value as QobuzAlbum)).not.toThrow();
        }
    });
});
