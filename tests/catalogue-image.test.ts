import { describe, expect, it } from 'vitest';
import { describeCatalogueItem } from '@/lib/qobuz-dl';
import type { QobuzTrack } from '@/lib/qobuz-dl';

const trackWithAlbumArt: QobuzTrack = {
    id: 1,
    title: 'Moth To A Flame',
    maximum_bit_depth: 24,
    maximum_sampling_rate: 192,
    album: {
        id: 2,
        title: 'Paradise Again',
        image: { small: 'https://example.com/s-1.jpg', large: 'https://example.com/l-1.jpg' }
    },
    performer: { name: 'Swedish House Mafia' }
} as unknown as QobuzTrack;

const bareTrack: QobuzTrack = { id: 3, title: 'No Art' } as unknown as QobuzTrack;

describe('describeCatalogueItem thumbnails', () => {
    it('uses the album art for a track', () => {
        const view = describeCatalogueItem(trackWithAlbumArt);
        expect(view.image?.small).toBe('https://example.com/s-1.jpg');
    });

    it('leaves the image undefined when a track has no album', () => {
        const view = describeCatalogueItem(bareTrack);
        expect(view.image).toBeUndefined();
    });
});
