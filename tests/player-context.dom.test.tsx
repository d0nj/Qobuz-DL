import { describe, expect, it, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { act, render, cleanup, fireEvent, screen } from '@testing-library/react';
import { useEffect } from 'react';
import PlayerBar from '@/components/player/player-bar';
import { PlayerProvider, usePlayer } from '@/lib/player/context';
import type { QobuzTrack } from '@/lib/qobuz-dl';

// ESM exports are non-configurable, so `toast` must be mocked at module scope
// rather than spied on after import.
const toastErrors: string[] = [];
vi.mock('sonner', () => ({
    toast: {
        error: (message: string) => {
            toastErrors.push(message);
            return 'id';
        }
    }
}));

/**
 * jsdom ships no media playback and no Media Session API, so both are filled
 * in here. The provider still talks to the real element and the real API —
 * only the platform behind them is fake.
 */
const mediaPrototypes = { play: undefined as unknown, pause: undefined as unknown, paused: undefined as unknown };

beforeAll(() => {
    const element = window.HTMLMediaElement.prototype as unknown as Record<string, unknown>;
    mediaPrototypes.play = element.play;
    mediaPrototypes.pause = element.pause;
    mediaPrototypes.paused = Object.getOwnPropertyDescriptor(element, 'paused');

    // jsdom has no playback engine; `paused` starts as an internal true and is
    // never updated because play/pause are no-ops. Flipping the internal flag
    // is the smallest change that makes pause state observable to the provider.
    const pausedByElement = new WeakMap<object, boolean>();
    Object.defineProperty(element, 'paused', {
        configurable: true,
        get(this: object) {
            return pausedByElement.get(this) ?? true;
        }
    });
    Object.defineProperty(element, 'play', {
        configurable: true,
        value: function (this: HTMLAudioElement) {
            pausedByElement.set(this, false);
            return Promise.resolve();
        }
    });
    Object.defineProperty(element, 'pause', {
        configurable: true,
        value: function (this: HTMLAudioElement) {
            pausedByElement.set(this, true);
            this.dispatchEvent(new Event('pause'));
        }
    });

    Object.defineProperty(window, 'MediaMetadata', {
        configurable: true,
        writable: true,
        value: class {
            constructor(init: Record<string, unknown>) {
                Object.assign(this, init);
            }
        }
    });
    Object.defineProperty(navigator, 'mediaSession', { configurable: true, writable: true, value: { metadata: null } });
});

afterAll(() => {
    const element = window.HTMLMediaElement.prototype as unknown as Record<string, unknown>;
    Object.defineProperty(element, 'play', { configurable: true, value: mediaPrototypes.play });
    Object.defineProperty(element, 'pause', { configurable: true, value: mediaPrototypes.pause });
    Object.defineProperty(element, 'paused', mediaPrototypes.paused as PropertyDescriptor);
});

const track = {
    id: 1,
    title: 't1',
    streamable: true,
    duration: 100,
    // lrclib skips the lookup when artist or title is blank.
    performer: { name: 'Artist One', id: 99 },
    album: { id: '10', title: 'Album', image: { small: 's', large: 'l' } }
} as unknown as QobuzTrack;

const settle = () => new Promise((r) => setTimeout(r, 0));

/** Lets queued microtasks and post-fetch state updates flush. */
const flush = async () => {
    for (let i = 0; i < 10; i++) await settle();
};

const unwrapMock = vi.fn().mockImplementation((path: string, options?: { params?: Record<string, unknown> }) =>
    path.includes('album')
        ? Promise.resolve({ id: '10', tracks: { items: [track, { ...track, id: 2, title: 't2' }] } })
        : // Echo the requested track_id so a test can tell which track loaded.
          Promise.resolve({ url: `https://cdn.example.com/stream?id=${String(options?.params?.track_id ?? '?')}` })
);

vi.mock('@/lib/api/client', () => ({
    getApiClient: () => ({
        unwrap: unwrapMock,
        routes: { album: '/api/get-album', download: '/api/download-music' }
    })
}));

/**
 * Captures the hook from inside the tree. Assigning during render would be a
 * side effect, so the capture happens in an effect.
 */
let hook: ReturnType<typeof usePlayer> | null = null;
const Probe = () => {
    const value = usePlayer();
    useEffect(() => {
        hook = value;
    });
    return null;
};

/** The audio element the provider owns. */
const audio = () => document.querySelector('audio')!;

beforeEach(() => {
    hook = null;
    unwrapMock.mockClear();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('lyrics offline'))));
});

describe('PlayerProvider', () => {
    it('plays a track and advances on ended', async () => {
        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });

        expect(audio()).toBeTruthy();
        expect(audio().src).toContain('cdn.example.com');
        expect(hook!.state.playing).toBe(true);

        await act(async () => {
            audio().dispatchEvent(new Event('ended'));
            await flush();
        });

        expect(audio().src).toContain('id=2');
        expect(hook!.state.queue?.current).toBe(1);
        cleanup();
    });

    it('pauses and resumes on toggle', async () => {
        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });
        expect(audio().paused).toBe(false);

        await act(async () => {
            hook!.toggle();
            await flush();
        });
        expect(audio().paused).toBe(true);
        expect(hook!.state.playing).toBe(false);

        await act(async () => {
            hook!.toggle();
            await flush();
        });
        expect(audio().paused).toBe(false);
        expect(hook!.state.playing).toBe(true);
        cleanup();
    });

    it('tracks position and duration from audio events', async () => {
        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });

        const element = audio();
        await act(async () => {
            Object.defineProperty(element, 'duration', { value: 240, configurable: true });
            element.dispatchEvent(new Event('loadedmetadata'));
            element.currentTime = 12.5;
            element.dispatchEvent(new Event('timeupdate'));
            await flush();
        });

        expect(hook!.state.duration).toBe(240);
        expect(hook!.state.position).toBe(12.5);
        cleanup();
    });

    it('seeks by assigning currentTime', async () => {
        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
            hook!.seek(42);
            await flush();
        });

        expect(audio().currentTime).toBe(42);
        expect(hook!.state.position).toBe(42);
        cleanup();
    });

    it('enqueues and plays next without disturbing the current track', async () => {
        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );
        const third = { ...track, id: 3, title: 't3' } as unknown as QobuzTrack;
        const extra = { ...track, id: 9, title: 't9' } as unknown as QobuzTrack;

        await act(async () => {
            hook!.play(track);
            await flush();
        });

        await act(async () => {
            hook!.playNextTrack(extra);
            hook!.enqueue(third);
            await flush();
        });

        expect(hook!.state.queue?.tracks.map((t) => t.track.id)).toEqual([1, 9, 2, 3]);
        expect(hook!.current?.track.id).toBe(1);
        expect(audio().src).toContain('id=1');
        cleanup();
    });

    it('skipForward and skipBackward move through the queue', async () => {
        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });
        expect(hook!.state.queue?.current).toBe(0);

        await act(async () => {
            hook!.skipForward();
            await flush();
        });
        expect(hook!.state.queue?.current).toBe(1);
        expect(audio().src).toContain('id=2');

        await act(async () => {
            hook!.skipBackward();
            await flush();
        });
        expect(hook!.state.queue?.current).toBe(0);
        expect(audio().src).toContain('id=1');
        cleanup();
    });

    it('reports duration from the track and stops at the end of the queue', async () => {
        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });
        expect(hook!.state.duration).toBe(100);

        await act(async () => {
            hook!.skipForward();
            await flush();
        });
        expect(hook!.state.queue?.current).toBe(1);
        expect(audio().src).toContain('id=2');

        await act(async () => {
            audio().dispatchEvent(new Event('ended'));
            await flush();
        });

        expect(hook!.state.queue?.current).toBe(1);
        expect(hook!.state.playing).toBe(false);
        cleanup();
    });

    it('reuses the cached album instead of refetching it', async () => {
        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });
        const albumsAfterFirst = unwrapMock.mock.calls.filter((args) => String(args[0]).includes('album')).length;
        expect(albumsAfterFirst).toBe(1);

        await act(async () => {
            hook!.play({ ...track, id: 2, title: 't2' } as unknown as QobuzTrack);
            await flush();
        });
        const albumsAfterSecond = unwrapMock.mock.calls.filter((args) => String(args[0]).includes('album')).length;

        expect(albumsAfterSecond).toBe(1);
        expect(hook!.state.queue?.tracks.map((t) => t.track.id)).toEqual([1, 2]);
        cleanup();
    });

    it('parses synced lyrics for the current track', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ plainLyrics: 'a', syncedLyrics: '[00:01.00] one\n[00:02.00] two' })
                } as unknown as Response)
            )
        );

        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });

        expect(hook!.syncedLyrics).toEqual([
            { time: 1, line: 'one' },
            { time: 2, line: 'two' }
        ]);
        cleanup();
    });

    it('leaves lyrics null when lrclib has nothing', async () => {
        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });

        expect(hook!.syncedLyrics).toBeNull();
        expect(hook!.state.playing).toBe(true);
        cleanup();
    });

    it('publishes mediaSession metadata when the browser supports it', async () => {
        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });

        expect(navigator.mediaSession.metadata).toBeTruthy();
        expect(navigator.mediaSession.metadata?.title).toBe('t1');
        cleanup();
    });

    it('degrades to a single-track queue when the album fetch fails', async () => {
        const failures = vi.fn().mockImplementation((path: string) =>
            path.includes('album') ? Promise.reject(new Error('album down')) : Promise.resolve({ url: 'https://cdn.example.com/one' })
        );
        const client = await import('@/lib/api/client');
        const restore = vi.spyOn(client, 'getApiClient').mockReturnValue({
            unwrap: failures,
            routes: { album: '/api/get-album', download: '/api/download-music' }
        } as unknown as ReturnType<typeof client.getApiClient>);

        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });

        expect(hook!.state.queue?.tracks.map((t) => t.track.id)).toEqual([1]);
        expect(audio().src).toContain('cdn.example.com');
        expect(hook!.state.playing).toBe(true);
        restore.mockRestore();
        cleanup();
    });

    it('toasts and stops at the queue end when the stream URL cannot be fetched', async () => {
        const failures = vi.fn().mockImplementation((path: string) =>
            path.includes('album')
                ? Promise.resolve({ id: '10', tracks: { items: [track, { ...track, id: 2, title: 't2' }] } })
                : Promise.reject(new Error('stream down'))
        );
        const client = await import('@/lib/api/client');
        const restoreClient = vi.spyOn(client, 'getApiClient').mockReturnValue({
            unwrap: failures,
            routes: { album: '/api/get-album', download: '/api/download-music' }
        } as unknown as ReturnType<typeof client.getApiClient>);

        toastErrors.length = 0;

        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });

        expect(toastErrors.length).toBeGreaterThan(0);
        expect(hook!.state.playing).toBe(false);
        expect(hook!.state.queue?.current).toBe(1);
        restoreClient.mockRestore();
        cleanup();
    });

    it('survives a provider with no navigator.mediaSession', async () => {
        const original = Object.getOwnPropertyDescriptor(navigator, 'mediaSession');
        Object.defineProperty(navigator, 'mediaSession', { value: undefined, configurable: true });

        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });

        // The suite stubs HTMLMediaElement.play (jsdom implements none of it),
        // so `playing` reflects the provider's own state machine rather than
        // real playback. What this pins is that a browser without mediaSession
        // does not break the play path.
        expect(audio().src).toContain('cdn.example.com');
        expect(hook!.state.queue?.current).toBe(0);
        expect(hook!.state.playing).toBe(true);

        if (original) Object.defineProperty(navigator, 'mediaSession', original);
        else delete (navigator as { mediaSession?: unknown }).mediaSession;
        cleanup();
    });

    it('throws when usePlayer is used outside the provider', () => {
        const expectation = () =>
            render(
                <>
                    <Probe />
                </>
            );
        expect(expectation).toThrow('usePlayer must be used within a PlayerProvider');
        cleanup();
    });

    it('abandons a slow stream lookup when the track changes underneath it', async () => {
        // Two tracks, but the first one's URL resolves slowly. Switching tracks
        // while that lookup is in flight must not let the stale response win —
        // otherwise the element plays track 2's audio against track 1's title.
        let releaseFirst!: (url: string) => void;
        const slowFirst = new Promise<{ url: string }>((resolve) => {
            releaseFirst = (url: string) => resolve({ url });
        });

        const client = await import('@/lib/api/client');
        const restoreClient = vi.spyOn(client, 'getApiClient').mockReturnValue({
            unwrap: vi.fn().mockImplementation((path: string, options?: { params?: Record<string, unknown> }) =>
                path.includes('album')
                    ? Promise.resolve({ id: '10', tracks: { items: [track, { ...track, id: 2, title: 't2' }] } })
                    : options?.params?.track_id === 1
                      ? slowFirst
                      : Promise.resolve({ url: 'https://cdn.example.com/stream?id=2' })
            ),
            routes: { album: '/api/get-album', download: '/api/download-music' }
        } as unknown as ReturnType<typeof client.getApiClient>);

        render(
            <PlayerProvider>
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });

        // Track 1 is still resolving; the user skips to track 2.
        await act(async () => {
            hook!.skipForward();
            await flush();
        });

        // The stale response for track 1 lands after the switch.
        await act(async () => {
            releaseFirst('https://cdn.example.com/stream?id=1');
            await flush();
        });

        // Mutation-tested: without the abort guard this fails. Removing
        // `abortRef.current?.abort()` or the post-await `signal.aborted` check
        // each let the stale URL overwrite the element.
        expect(audio().src).toContain('id=2');
        expect(hook!.state.queue?.current).toBe(1);

        restoreClient.mockRestore();
        cleanup();
    });
});

describe('PlayerBar', () => {
    it('renders nothing before the first play', () => {
        render(
            <PlayerProvider>
                <PlayerBar />
            </PlayerProvider>
        );

        expect(screen.queryByText('t1')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
        cleanup();
    });

    it('shows the current track and transport controls once a queue exists', async () => {
        render(
            <PlayerProvider>
                <PlayerBar />
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });

        expect(screen.getByText('t1')).toBeTruthy();
        expect(screen.getByText('Artist One')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
        expect(screen.getByRole('img', { name: 't1' }).getAttribute('src')).toBe('s');
        cleanup();
    });

    it('reflects pause state and reports it back through toggle', async () => {
        render(
            <PlayerProvider>
                <PlayerBar />
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });

        const toggle = screen.getByRole('button', { name: 'Pause' });
        await act(async () => {
            fireEvent.click(toggle);
            await flush();
        });

        // Mutation-tested: a bar reading a cached copy of `playing` would keep
        // showing Pause here, so the label is the observable contract.
        expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
        expect(hook!.state.playing).toBe(false);
        cleanup();
    });

    it('skips to the next track from the bar', async () => {
        render(
            <PlayerProvider>
                <PlayerBar />
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
            await flush();
        });

        expect(hook!.state.queue?.current).toBe(1);
        expect(screen.getByText('t2')).toBeTruthy();
        cleanup();
    });

    it('stops the controls from bubbling into the expand target', async () => {
        render(
            <PlayerProvider>
                <PlayerBar />
                <Probe />
            </PlayerProvider>
        );

        await act(async () => {
            hook!.play(track);
            await flush();
        });

        const next = screen.getByRole('button', { name: 'Next' });
        const expanded = () => document.querySelector('[data-testid="player-sheet"]');

        expect(expanded()).toBeNull();

        await act(async () => {
            fireEvent.click(next);
            await flush();
        });

        // Mutation-tested: without stopPropagation the skip also opens the
        // sheet, so a tap on a control would navigate the user away.
        expect(expanded()).toBeNull();
        cleanup();
    });
});
