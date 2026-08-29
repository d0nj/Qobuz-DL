import { SettingsProps } from '@/lib/settings-schema';
import { FetchedQobuzAlbum, QobuzAlbum, QobuzTrack } from '@/lib/qobuz-dl';

export type AlbumCache = {
    data: FetchedQobuzAlbum | null;
    setData: (data: FetchedQobuzAlbum | null) => void;
};

/**
 * Everything a download needs, as one value.
 *
 * `createDownloadJob` took seven positional parameters, four of which were
 * ambient context that every caller had to reassemble from hooks. Worse, two
 * of them — `fetchedAlbumData` and `setFetchedAlbumData` — are not two options
 * but one cache with its invalidation callback, and they had to be passed as a
 * matched pair or omitted together. Encoding the mode in two nulled positional
 * slots (`undefined, undefined`) is how callers asked for "track, don't reuse
 * album data".
 *
 * Grouping them makes the pairing structural and the mode explicit.
 */
export type DownloadRequest = {
    target: QobuzAlbum | QobuzTrack;
    settings: SettingsProps;
    country?: string;
    albumCache?: AlbumCache;
};

export function albumCacheOf(
    data: FetchedQobuzAlbum | null | undefined,
    setData: ((data: FetchedQobuzAlbum | null) => void) | undefined
): AlbumCache | undefined {
    if (!setData) return undefined;
    return { data: data ?? null, setData };
}
