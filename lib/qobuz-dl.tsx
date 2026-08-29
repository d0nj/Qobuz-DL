import { AxiosRequestConfig } from 'axios';
import { getApiClient } from '@/lib/api/client';
import { Disc3Icon, DiscAlbumIcon, LucideIcon, RadioTowerIcon } from 'lucide-react';

export type APIOptionProps = Partial<
    AxiosRequestConfig & {
        country: string;
    }
>;

export type QobuzGenre = {
    path: number[];
    color: string;
    name: string;
    id: number;
};

export type QobuzLabel = {
    name: string;
    id: number;
    albums_count: number;
};

export type QobuzArtist = {
    image: {
        small: string;
        medium: string;
        large: string;
        extralarge: string;
        mega: string;
    } | null;
    name: string;
    id: number;
    albums_count: number;
};

export type QobuzTrack = {
    isrc: string | null;
    copyright: string;
    maximum_bit_depth: number;
    maximum_sampling_rate: number;
    performer: {
        name: string;
        id: number;
    };
    composer?: {
        name: string;
        id: number;
    };
    album: QobuzAlbum;
    track_number: number;
    released_at: number;
    title: string;
    version: string | null;
    duration: number;
    parental_warning: boolean;
    id: number;
    hires: boolean;
    streamable: boolean;
    media_number: number;
};

export type FetchedQobuzAlbum = QobuzAlbum & {
    tracks: {
        offset: number;
        limit: number;
        total: number;
        items: QobuzTrack[];
    };
};

export type QobuzAlbum = {
    maximum_bit_depth: number;
    image: {
        small: string;
        thumbnail: string;
        large: string;
        back: string | null;
    };
    artist: QobuzArtist;
    artists: {
        id: number;
        name: string;
        roles: string[];
    }[];
    released_at: number;
    label: QobuzLabel;
    title: string;
    qobuz_id: number;
    version: string | null;
    duration: number;
    parental_warning: boolean;
    tracks_count: number;
    genre: QobuzGenre;
    id: string;
    maximum_sampling_rate: number;
    release_date_original: string;
    hires: boolean;
    upc: string;
    streamable: boolean;
};

export type QobuzSearchResults = {
    query: string;
    switchTo: QobuzSearchFilters | null;
    albums: {
        limit: number;
        offset: number;
        total: number;
        items: QobuzAlbum[];
    };
    tracks: {
        limit: number;
        offset: number;
        total: number;
        items: QobuzTrack[];
    };
    artists: {
        limit: number;
        offset: number;
        total: number;
        items: QobuzArtist[];
    };
};

export type QobuzArtistResults = {
    artist: {
        id: string;
        name: {
            display: string;
        };
        artist_category: string;
        biography: {
            content: string;
            source: null;
            language: string;
        };
        images: {
            portrait: {
                hash: string;
                format: string;
            };
        };
        top_tracks: QobuzTrack[];
        releases: {
            album: {
                has_more: boolean;
                items: QobuzAlbum[];
            };
            live: {
                has_more: boolean;
                items: QobuzAlbum[];
            };
            compilation: {
                has_more: boolean;
                items: QobuzAlbum[];
            };
            epSingle: {
                has_more: boolean;
                items: QobuzAlbum[];
            };
        };
    };
};

export type FilterDataType = {
    label: string;
    value: string;
    searchRoute?: string;
    icon: LucideIcon;
}[];

export type QobuzSearchFilters = 'albums' | 'tracks' | 'artists';

export type ReleaseCategoryValue = 'album' | 'epSingle' | 'live' | 'compilation';

export type ReleaseCategory = {
    label: string;
    value: ReleaseCategoryValue;
    icon: LucideIcon;
};

export const artistReleaseCategories: ReleaseCategory[] = [
    { label: 'albums', value: 'album', icon: DiscAlbumIcon },
    { label: 'EPs & singles', value: 'epSingle', icon: Disc3Icon },
    { label: 'live albums', value: 'live', icon: RadioTowerIcon },
    { label: 'compilations', value: 'compilation', icon: DiscAlbumIcon }
];

export const QOBUZ_ALBUM_URL_REGEX = /https:\/\/(play|open)\.qobuz\.com\/album\/[a-zA-Z0-9]+/;
export const QOBUZ_TRACK_URL_REGEX = /https:\/\/(play|open)\.qobuz\.com\/track\/\d+/;
export const QOBUZ_ARTIST_URL_REGEX = /https:\/\/(play|open)\.qobuz\.com\/artist\/\d+/;

export type CatalogueKind = 'albums' | 'tracks' | 'artists' | 'unknown';

/**
 * Discriminates a Qobuz result.
 *
 * The Qobuz API returns three shapes with no tag, so the shape has to be
 * inferred. The previous `getType` fell through to `'albums'` by elimination,
 * which meant an unrecognised object silently rendered as an album. `'unknown'`
 * makes that case visible instead; renderers treat it as "not an artist".
 */
export function getType(input: QobuzAlbum | QobuzTrack | QobuzArtist): CatalogueKind {
    if (!input || typeof input !== 'object') return 'unknown';
    if ('albums_count' in input) return 'artists';
    if ('album' in input) return 'tracks';
    if ('image' in input || 'tracks_count' in input) return 'albums';
    return 'unknown';
}

export function isArtist(input: QobuzAlbum | QobuzTrack | QobuzArtist): input is QobuzArtist {
    return getType(input) === 'artists';
}

export function isTrack(input: QobuzAlbum | QobuzTrack | QobuzArtist): input is QobuzTrack {
    return getType(input) === 'tracks';
}

/**
 * Everything a card needs, resolved once.
 *
 * Release cards re-ran `getType` fifteen times per render and cast the union
 * twenty-plus times. Resolving once moves the shape knowledge into this module
 * and leaves the renderer with plain values.
 */
export type CatalogueItemView = {
    kind: CatalogueKind;
    isArtist: boolean;
    isTrack: boolean;
    album: QobuzAlbum | undefined;
    artist: QobuzArtist | undefined;
    title: string;
    artists: string;
    duration: number | undefined;
    bitDepth: number | undefined;
    samplingRate: number | undefined;
    tracksCount: number | undefined;
    releasedYear: number | undefined;
    image: QobuzAlbum['image'] | QobuzArtist['image'] | undefined;
};

export function describeCatalogueItem(input: QobuzAlbum | QobuzTrack | QobuzArtist): CatalogueItemView {
    const kind = getType(input);
    const artistKind = kind === 'artists';
    const trackKind = kind === 'tracks';
    const album = artistKind ? undefined : getAlbum(input);
    const record = (input ?? {}) as QobuzAlbum | QobuzTrack;
    const releasedAt = record.released_at;

    return {
        kind,
        isArtist: artistKind,
        isTrack: trackKind,
        album,
        artist: artistKind
            ? (input as QobuzArtist)
            : ((input as QobuzAlbum)?.artist ?? (input as QobuzTrack)?.performer ?? (input as QobuzTrack)?.composer),
        title: formatTitle(input),
        artists: artistKind ? '' : formatArtists(record),
        duration: record.duration,
        bitDepth: record.maximum_bit_depth,
        samplingRate: record.maximum_sampling_rate,
        tracksCount: (record as QobuzAlbum).tracks_count,
        releasedYear: releasedAt ? new Date(releasedAt * 1000).getFullYear() : undefined,
        image: (input as QobuzAlbum | QobuzArtist)?.image
    };
}

export function getAlbum(input: QobuzAlbum | QobuzTrack | QobuzArtist) {
    if (!input || typeof input !== 'object') return undefined as unknown as QobuzAlbum;
    const album = (input as QobuzAlbum).image ? input : (input as QobuzTrack).album;
    return album as QobuzAlbum | undefined;
}

export function formatTitle(input: QobuzAlbum | QobuzTrack | QobuzArtist) {
    if (!input || typeof input !== 'object') return '';
    const record = input as QobuzAlbum | QobuzTrack;
    const name = record.title ?? (input as QobuzArtist).name ?? '';
    return `${name}${record.version ? ' (' + record.version + ')' : ''}`.trim();
}

export function getFullResImageUrl(input: QobuzAlbum | QobuzTrack) {
    const large = getAlbum(input)?.image?.large;
    if (!large) return '';
    return large.substring(0, large.length - 7) + 'org.jpg';
}

export function formatArtists(input: QobuzAlbum | QobuzTrack, separator: string = ', ') {
    const artists = getAlbum(input)?.artists;
    return artists && artists.length > 0
        ? artists.map((artist) => artist.name).join(separator)
        : (input as QobuzTrack)?.performer?.name || 'Various Artists';
}

export function filterExplicit(results: QobuzSearchResults, explicit: boolean = true) {
    return {
        ...results,
        albums: {
            ...results.albums,
            items: results.albums.items.filter((album) => (explicit ? true : !album.parental_warning))
        },
        tracks: {
            ...results.tracks,
            items: results.tracks.items.filter((track) => (explicit ? true : !track.parental_warning))
        }
    };
}

export function formatDuration(seconds: number | undefined) {
    if (!seconds || Number.isNaN(seconds)) return '0m';
    const totalMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const remainingSeconds = seconds % 60;

    return `${hours > 0 ? hours + 'h ' : ''} ${remainingMinutes > 0 ? remainingMinutes + 'm ' : ''} ${remainingSeconds > 0 && hours <= 0 ? remainingSeconds + 's' : ''}`.trim();
}

/**
 * Normalises an artist-release payload into a QobuzAlbum.
 *
 * Returns a new object. The previous version mutated its argument in place,
 * which meant calling it twice on the same album re-derived fields from the
 * already-overwritten ones.
 */
export function parseArtistAlbumData(album: QobuzAlbum): QobuzAlbum {
    const raw = album as unknown as {
        audio_info?: { maximum_sampling_rate?: number; maximum_bit_depth?: number };
        rights?: { streamable?: boolean };
        dates?: { stream?: string | number; original?: string };
    };

    return {
        ...album,
        maximum_sampling_rate: raw.audio_info?.maximum_sampling_rate ?? album.maximum_sampling_rate,
        maximum_bit_depth: raw.audio_info?.maximum_bit_depth ?? album.maximum_bit_depth,
        streamable: raw.rights?.streamable ?? album.streamable,
        released_at: raw.dates?.stream ? new Date(raw.dates.stream).getTime() / 1000 : album.released_at,
        release_date_original: raw.dates?.original ?? album.release_date_original
    };
}

export function parseArtistData(artistData: QobuzArtistResults) {
    // Fix weird inconsistencies in Qobuz API data
    if ((!artistData.artist.releases as any).length) return artistData;
    (artistData.artist.releases as any).forEach((release: any) =>
        release.items.forEach((album: any, index: number) => {
            release.items[index] = parseArtistAlbumData(album);
        })
    );
    const newReleases = {} as any;
    for (const type of ['album', 'live', 'compilation', 'epSingle']) {
        if (!(artistData.artist.releases as any).find((release: any) => release.type === type)) continue;
        newReleases[type] = {
            has_more: (artistData.artist.releases as any).find((release: any) => release.type === type)!.has_more,
            items: (artistData.artist.releases as any).find((release: any) => release.type === type)!.items
        };
    }
    artistData.artist.releases = newReleases;
    return artistData;
}

export async function getFullAlbumInfo(
    fetchedAlbumData: FetchedQobuzAlbum | null,
    setFetchedAlbumData: React.Dispatch<React.SetStateAction<FetchedQobuzAlbum | null>>,
    result: QobuzAlbum,
    country?: string
) {
    if (fetchedAlbumData && (fetchedAlbumData as FetchedQobuzAlbum).id === (result as QobuzAlbum).id) return fetchedAlbumData;
    setFetchedAlbumData(null);
    const albumData = await getApiClient().unwrap<FetchedQobuzAlbum>(getApiClient().routes.album, {
        params: { album_id: (result as QobuzAlbum).id },
        country
    });
    setFetchedAlbumData(albumData);
    return albumData;
}
