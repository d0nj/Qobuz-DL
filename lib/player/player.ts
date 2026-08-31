import type { FetchedQobuzAlbum, QobuzAlbum, QobuzTrack } from '@/lib/qobuz-dl';

/** Album ids are strings in the Qobuz payload (QobuzAlbum.id), though numeric in places. */
export type PlayerTrack = { track: QobuzTrack; albumId: QobuzAlbum['id'] };
export type PlayerQueue = { tracks: PlayerTrack[]; current: number };

/** Streamable is a Qobuz rights flag; the download path filters on it already. */
const fromAlbum = (album: FetchedQobuzAlbum): PlayerTrack[] =>
    album.tracks.items.filter((t) => t.streamable).map((track) => ({ track, albumId: album.id }));

export function startAlbum(album: FetchedQobuzAlbum, startIndex: number): PlayerQueue {
    const tracks = fromAlbum(album);
    const targetId = album.tracks.items[startIndex]?.id;
    const current = Math.max(0, tracks.findIndex((t) => t.track.id === targetId));
    return { tracks, current: current === -1 ? 0 : current };
}

export function startSingle(track: QobuzTrack): PlayerQueue {
    return { tracks: [{ track, albumId: track.album?.id ?? 0 }], current: 0 };
}

export function playNext(queue: PlayerQueue, track: QobuzTrack): PlayerQueue {
    const tracks = [...queue.tracks];
    tracks.splice(queue.current + 1, 0, { track, albumId: track.album?.id ?? 0 });
    return { ...queue, tracks };
}

export function addToQueue(queue: PlayerQueue, track: QobuzTrack): PlayerQueue {
    return { ...queue, tracks: [...queue.tracks, { track, albumId: track.album?.id ?? 0 }] };
}

export function skip(queue: PlayerQueue): PlayerQueue {
    return { ...queue, current: Math.min(queue.current + 1, queue.tracks.length - 1) };
}

export function previous(queue: PlayerQueue): PlayerQueue {
    return { ...queue, current: Math.max(queue.current - 1, 0) };
}
