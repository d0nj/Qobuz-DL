import { describe, expect, it } from 'vitest';
import { filterExplicit, filterData, hasMoreResults, isStaleResponse, mergePage, mergeResults, placeholderCount } from '@/lib/search/results';
import { QobuzSearchResults } from '@/lib/qobuz-dl';

const page = (items: unknown[], total: number, limit = 10, offset = 0) => ({ items, limit, offset, total });

const results = (albums: unknown[] = [], tracks: unknown[] = [], artists: unknown[] = [], query = 'q'): QobuzSearchResults =>
    ({
        query,
        switchTo: null,
        albums: page(albums, 100),
        tracks: page(tracks, 50),
        artists: page(artists, 10)
    }) as unknown as QobuzSearchResults;

describe('mergePage', () => {
    it('appends one page to another', () => {
        const merged = mergePage(page([{ id: 1 }], 100), page([{ id: 2 }], 100));
        expect(merged.items.map((i: any) => i.id)).toEqual([1, 2]);
    });

    it('starts from nothing when there is no previous page', () => {
        expect(mergePage(undefined, page([{ id: 1 }], 5)).items).toHaveLength(1);
    });

    it('keeps the previous page when nothing is incoming', () => {
        expect(mergePage(page([{ id: 1 }], 5), undefined).items).toHaveLength(1);
    });

    it('drops duplicate ids', () => {
        const merged = mergePage(page([{ id: 1 }, { id: 2 }], 100), page([{ id: 2 }, { id: 3 }], 100));
        expect(merged.items.map((i: any) => i.id)).toEqual([1, 2, 3]);
    });

    it('keeps items without an id, since the API can return unnamed results', () => {
        const merged = mergePage(page([{ title: 'a' }], 10), page([{ title: 'b' }], 10));
        expect(merged.items).toHaveLength(2);
    });

    it('reports offset as the total fetched so far', () => {
        expect(mergePage(page([{ id: 1 }], 100), page([{ id: 2 }], 100)).offset).toBe(2);
    });

    it('survives a page with no items array', () => {
        expect(mergePage({ limit: 1, offset: 0, total: 0 }, undefined).items).toEqual([]);
        expect(() => mergePage(undefined, undefined)).not.toThrow();
    });

    it('survives pages missing limit, offset and total', () => {
        const merged = mergePage({ items: [{ id: 1 }] }, { items: [{ id: 2 }] });
        expect(merged.items).toHaveLength(2);
        expect(merged.offset).toBe(2);
        expect(merged.total).toBe(2);
    });

    it('does not mutate its inputs', () => {
        const previous = page([{ id: 1 }], 10);
        const incoming = page([{ id: 2 }], 10);
        mergePage(previous, incoming);
        expect(previous.items).toHaveLength(1);
        expect(incoming.items).toHaveLength(1);
    });

    it('handles 1000 merged items without quadratic behaviour', () => {
        let current = page([], 1000, 10, 0);
        for (let i = 0; i < 100; i++) {
            const batch = Array.from({ length: 10 }, (_, k) => ({ id: i * 10 + k }));
            current = mergePage(current, page(batch, 1000, 10, i * 10));
        }
        expect(current.items).toHaveLength(1000);
    });
});

describe('mergeResults', () => {
    it('merges the active field', () => {
        const merged = mergeResults(results([{ id: 1 }]), results([{ id: 2 }]), 'albums');
        expect((merged.albums.items as any[]).map((i) => i.id)).toEqual([1, 2]);
    });

    it('leaves untouched fields alone', () => {
        const previous = results([{ id: 1 }], [{ id: 9 }]);
        const merged = mergeResults(previous, results([{ id: 2 }]), 'albums');
        expect((merged.tracks.items as any[]).map((i) => i.id)).toEqual([9]);
    });

    it('merges every field when the response carries them all', () => {
        const previous = results([{ id: 1 }], [{ id: 1 }], [{ id: 1 }]);
        const incoming = results([{ id: 2 }], [{ id: 2 }], [{ id: 2 }]);
        const merged = mergeResults(previous, incoming, 'albums');
        expect(merged.albums.items).toHaveLength(2);
        expect(merged.tracks.items).toHaveLength(2);
        expect(merged.artists.items).toHaveLength(2);
    });

    it('returns the previous results when nothing is incoming', () => {
        const previous = results([{ id: 1 }]);
        expect(mergeResults(previous, undefined, 'albums')).toBe(previous);
    });

    it('keeps the newer query', () => {
        expect(mergeResults(results([], [], [], 'old'), results([], [], [], 'new'), 'albums').query).toBe('new');
    });

    it('preserves switchTo', () => {
        const withSwitch = { ...results(), switchTo: 'tracks' } as QobuzSearchResults;
        expect(mergeResults(withSwitch, results(), 'albums').switchTo).toBe('tracks');
    });
});

describe('placeholderCount', () => {
    it('is zero when everything is loaded', () => {
        expect(placeholderCount(page([{ id: 1 }], 1))).toBe(0);
    });

    it('caps at the remaining total', () => {
        expect(placeholderCount(page([{ id: 1 }], 5, 10, 0))).toBe(4);
    });

    it('caps at the page size', () => {
        expect(placeholderCount(page([], 1000, 10, 0))).toBe(10);
    });

    it('accounts for the offset already fetched', () => {
        expect(placeholderCount(page([{ id: 1 }], 100, 10, 90))).toBe(9);
    });

    it('is zero for a missing or malformed page', () => {
        for (const value of [undefined, null, {}, { items: [] }, { items: [], total: NaN }]) {
            expect(placeholderCount(value)).toBe(0);
        }
    });

    it('never returns a negative count', () => {
        expect(placeholderCount(page([{ id: 1 }], 1, 10, 500))).toBe(0);
    });
});

describe('hasMoreResults', () => {
    it('is true while items are fewer than the total', () => {
        expect(hasMoreResults(results([{ id: 1 }]), 'albums')).toBe(true);
    });

    it('is false when the page is complete', () => {
        const complete = { ...results(), albums: page([{ id: 1 }], 1) } as QobuzSearchResults;
        expect(hasMoreResults(complete, 'albums')).toBe(false);
    });

    it('is false for no results or a missing page', () => {
        expect(hasMoreResults(null, 'albums')).toBe(false);
        expect(hasMoreResults({} as QobuzSearchResults, 'albums')).toBe(false);
    });
});

describe('filterExplicit', () => {
    const flagged = { id: 1, parental_warning: true };
    const clean = { id: 2, parental_warning: false };

    it('returns the same object when explicit is allowed', () => {
        const input = results([flagged, clean]);
        expect(filterExplicit(input, true)).toBe(input);
    });

    it('removes flagged albums and tracks', () => {
        const filtered = filterExplicit(results([flagged, clean], [flagged, clean]), false);
        expect(filtered.albums.items).toEqual([clean]);
        expect(filtered.tracks.items).toEqual([clean]);
    });

    it('never filters artists', () => {
        const withArtist = results([], [], [{ id: 3, parental_warning: true }]);
        expect(filterExplicit(withArtist, false).artists.items).toHaveLength(1);
    });

    it('does not mutate its input', () => {
        const input = results([flagged, clean]);
        const before = JSON.stringify(input);
        filterExplicit(input, false);
        expect(JSON.stringify(input)).toBe(before);
    });

    it('defaults to allowing explicit content', () => {
        expect(filterExplicit(results([flagged])).albums.items).toHaveLength(1);
    });
});

describe('isStaleResponse', () => {
    it('flags a response from a different query', () => {
        expect(isStaleResponse('new', 'old')).toBe(true);
    });

    it('accepts a response for the current query', () => {
        expect(isStaleResponse('same', 'same')).toBe(false);
    });

    it('accepts a response that carries no query', () => {
        // Not every route echoes the query back; absence is not staleness.
        expect(isStaleResponse('q', undefined)).toBe(false);
        expect(isStaleResponse('q', null)).toBe(false);
    });
});

describe('filterData', () => {
    it('describes all three result sets', () => {
        expect(filterData.map((f) => f.value)).toEqual(['albums', 'tracks', 'artists']);
    });
});
