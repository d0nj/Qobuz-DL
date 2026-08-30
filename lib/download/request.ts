import { SettingsProps } from '@/lib/settings-schema';
import { FetchedQobuzAlbum, QobuzAlbum, QobuzTrack } from '@/lib/qobuz-dl';

export type AlbumCache = {
    data: FetchedQobuzAlbum | null;
    setData: (data: FetchedQobuzAlbum | null) => void;
};

/**
 * Everything a download needs, as one value.
 *
 * The album cache and its invalidation callback are one unit, not two
 * independent options: they must be passed together or not at all, and
 * `undefined, undefined` is how a caller says "track, don't reuse album data".
 * The object makes that pairing structural instead of positional.
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
