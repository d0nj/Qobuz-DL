import { Disc3Icon, DiscAlbumIcon, UsersIcon, LucideIcon } from 'lucide-react';
import { QobuzAlbum, QobuzArtist, QobuzSearchFilters, QobuzSearchResults, QobuzTrack } from '@/lib/qobuz-dl';

export type FilterDataType = {
    label: string;
    value: string;
    searchRoute?: string;
    icon: LucideIcon;
}[];

/** Lives in `lib/`: release-card imports it, and a leaf must not depend on the page. */
export const filterData: FilterDataType = [
    { label: 'Albums', value: 'albums', icon: DiscAlbumIcon },
    { label: 'Tracks', value: 'tracks', icon: Disc3Icon },
    { label: 'Artists', value: 'artists', icon: UsersIcon }
];

export type ResultPage<T> = {
    items: T[];
    limit: number;
    offset: number;
    total: number;
};

export type CatalogueResult = QobuzAlbum | QobuzTrack | QobuzArtist;

/**
 * How many skeleton slots to render after `items`.
 *
 * Separate from `items` on purpose: padding `items` with nulls makes
 * "how many results are loaded" mean different things to different readers.
 */
export function placeholderCount(page: unknown): number {
    const { items, limit, offset, total } = (page ?? {}) as Partial<ResultPage<unknown>>;
    if (typeof total !== 'number' || !Number.isFinite(total)) return 0;

    const fetched = (typeof offset === 'number' ? offset : 0) + (Array.isArray(items) ? items.length : 0);
    const remaining = Math.max(0, total - fetched);
    const pageSize = typeof limit === 'number' && limit > 0 ? limit : remaining;

    return Math.min(remaining, pageSize);
}

/**
 * Appends one page of results to what is already loaded.
 *
 * Total for the whole result set, not per page: callers compare it against the
 * item count to decide whether more can be fetched, and the API returns the
 * per-request page size as `limit`.
 */
export function mergePage(previous: unknown, incoming: unknown): ResultPage<CatalogueResult> {
    const previousPage = previous as Partial<ResultPage<CatalogueResult>> | undefined;
    const incomingPage = incoming as Partial<ResultPage<CatalogueResult>> | undefined;

    if (!incomingPage) {
        return (
            previousPage?.items
                ? (previousPage as ResultPage<CatalogueResult>)
                : { items: [], limit: 0, offset: 0, total: 0 }
        ) as ResultPage<CatalogueResult>;
    }

    const previousItems = Array.isArray(previousPage?.items) ? previousPage!.items : [];
    const incomingItems = Array.isArray(incomingPage.items) ? incomingPage.items : [];

    const seen = new Set(previousItems.map((item) => (item as { id?: string | number })?.id));
    const additions = incomingItems.filter((item) => {
        const id = (item as { id?: string | number })?.id;
        return id === undefined || !seen.has(id);
    });

    const items = [...previousItems, ...additions];

    return {
        items,
        limit: incomingPage.limit ?? previousPage?.limit ?? 0,
        offset: items.length,
        total: incomingPage.total ?? previousPage?.total ?? items.length
    };
}

export function mergeResults(
    previous: QobuzSearchResults | null,
    incoming: QobuzSearchResults | undefined,
    field: QobuzSearchFilters
): QobuzSearchResults {
    if (!incoming) return previous as QobuzSearchResults;

    const base = (previous ?? incoming) as QobuzSearchResults;
    // The three result sets share a page shape but differ in item type, so
    // QobuzSearchResults[key] widens to an intersection that cannot be
    // assigned directly. Build through a page-typed record, then return.
    const pages: Record<string, ResultPage<CatalogueResult>> = { ...(base as unknown as Record<string, ResultPage<CatalogueResult>>) };

    for (const filter of filterData) {
        const key = filter.value as QobuzSearchFilters;
        const incomingPage = incoming[key];
        if (key === field || incomingPage) {
            pages[key] = mergePage(previous?.[key], incomingPage);
        }
    }

    return {
        ...base,
        ...incoming,
        ...(pages as unknown as QobuzSearchResults),
        query: incoming.query ?? base.query
    };
}

export function hasMoreResults(results: QobuzSearchResults | null, field: QobuzSearchFilters): boolean {
    const page = results?.[field];
    if (!page || !Array.isArray(page.items)) return false;
    if (!Number.isFinite(page.total)) return false;
    return page.items.length < page.total;
}

/**
 * Drops releases flagged explicit. Artists are left alone: they carry no
 * `parental_warning`, and filtering them would hide artists rather than
 * releases. Always returns a new object.
 */
export function filterExplicit(results: QobuzSearchResults, explicit: boolean = true): QobuzSearchResults {
    if (explicit) return results;

    return {
        ...results,
        albums: {
            ...results.albums,
            items: results.albums?.items?.filter((album) => !album.parental_warning) ?? []
        },
        tracks: {
            ...results.tracks,
            items: results.tracks?.items?.filter((track) => !track.parental_warning) ?? []
        }
    };
}

/** Ties a response to the query that produced it so a stale one cannot land. */
export function isStaleResponse(query: string, responseQuery: unknown): boolean {
    return typeof responseQuery === 'string' && responseQuery !== query;
}
