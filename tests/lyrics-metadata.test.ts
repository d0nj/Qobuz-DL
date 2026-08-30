import { describe, expect, it } from 'vitest';
import { buildMetadataText } from '@/lib/transcode';
import { defaultSettings, parseSettings, settingsSchema } from '@/lib/settings-schema';

const track = {
    id: 1,
    title: 'Creep',
    duration: 239,
    track_number: 2,
    isrc: 'GBAYE9300156',
    album: {
        title: 'Pablo Honey',
        release_date_original: '1993-02-22',
        genre: { name: 'Alternative' },
        label: { name: 'Parlophone' },
        artist: { name: 'Radiohead' },
        artists: [{ name: 'Radiohead' }],
        image: { large: 'x' }
    },
    performer: { name: 'Radiohead' }
} as any;

describe('lyrics in metadata', () => {
    it('omits lyrics tags when none were found', () => {
        const text = buildMetadataText(track, undefined, null);
        expect(text).not.toContain('lyrics=');
        expect(text).not.toContain('synced-lyrics=');
    });

    it('writes escaped plain lyrics', () => {
        const text = buildMetadataText(track, undefined, { plain: 'one\ntwo', synced: null });
        expect(text).toContain('lyrics=one\\\ntwo');
        expect(text).not.toContain('synced-lyrics=');
    });

    it('writes synced lyrics alongside plain when present', () => {
        const text = buildMetadataText(track, undefined, { plain: 'one', synced: '[00:19.16] one' });
        expect(text).toContain('lyrics=one');
        expect(text).toContain('synced-lyrics=[00:19.16] one');
    });

    it('escapes characters that would break the FFMETADATA1 parser', () => {
        const text = buildMetadataText(track, undefined, { plain: 'a=b;c#d' });
        expect(text).toContain('a\\=b\\;c\\#d');
    });
});

/**
 * Settings persisted before this feature existed do not carry the lyrics keys.
 * A strict schema would reject them and silently reset every returning user's
 * configuration, so the new fields must default rather than be required.
 */
describe('settings migration', () => {
    it('accepts a legacy settings object missing the lyrics keys', () => {
        const legacy = { ...defaultSettings } as Record<string, unknown>;
        delete legacy.fetchLyrics;
        delete legacy.preferSyncedLyrics;

        const parsed = parseSettings(legacy);
        expect(parsed).not.toBeNull();
        expect(parsed!.fetchLyrics).toBe(false);
        expect(parsed!.preferSyncedLyrics).toBe(true);
    });

    it('keeps the rest of a legacy object intact', () => {
        const legacy = { ...defaultSettings, zipName: 'custom {name}' } as Record<string, unknown>;
        delete legacy.fetchLyrics;
        delete legacy.preferSyncedLyrics;

        const parsed = parseSettings(legacy);
        expect(parsed!.zipName).toBe('custom {name}');
        expect(parsed!.outputCodec).toBe(defaultSettings.outputCodec);
    });

    it('defaults lyrics off, keeping the feature opt-in', () => {
        expect(settingsSchema.parse({ ...defaultSettings }).fetchLyrics).toBe(false);
    });
});
