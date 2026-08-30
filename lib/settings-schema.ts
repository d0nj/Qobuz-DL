import { z } from 'zod';

/**
 * The TypeScript type is derived from this schema, so the type and the runtime
 * validator cannot drift — which is what went wrong with the hand-rolled
 * `isValidSettings` this replaced.
 */

export const outputQualityValues = ['27', '7', '6', '5'] as const;
export const outputCodecValues = ['FLAC', 'WAV', 'ALAC', 'MP3', 'AAC', 'OPUS'] as const;

export const settingsSchema = z.object({
    particles: z.boolean(),
    outputQuality: z.enum(outputQualityValues),
    outputCodec: z.enum(outputCodecValues),

    /**
     * `undefined` for lossless codecs, a number for lossy ones.
     *
     * This two-state encoding is deliberate and load-bearing: `applyMetadata`
     * and the FFmpeg arg builder branch on it, and `download-job` uses it in
     * the "can we skip re-encoding?" decision. It is therefore part of the
     * interface, not an oversight — do not "fix" it into a plain number.
     */
    bitrate: z.union([z.number().int().min(24).max(320), z.undefined()]),

    applyMetadata: z.boolean(),
    fixMD5: z.boolean(),
    explicitContent: z.boolean(),

    /**
     * Fetch lyrics from LRCLIB into the file's tags. Off by default: one
     * request per track against a third-party service.
     *
     * `.default(...)` is required, not stylistic — settings already persisted
     * predate this key, and a strict `z.boolean()` would reject them, fail
     * `parseSettings`, and reset every returning user's configuration.
     */
    fetchLyrics: z.boolean().default(false),

    /** Prefer time-synced LRC lyrics when LRCLIB has them. */
    preferSyncedLyrics: z.boolean().default(true),
    albumArtSize: z.number().int().min(100).max(3600),
    albumArtQuality: z.number().min(0.1).max(1),
    zipName: z.string(),
    trackName: z.string()
});

export type SettingsProps = z.infer<typeof settingsSchema>;

export const nameVariables: string[] = ['artists', 'name', 'year', 'duration'];

export const defaultSettings: SettingsProps = {
    particles: true,
    outputQuality: '27',
    outputCodec: 'FLAC',
    bitrate: 320,
    applyMetadata: true,
    fixMD5: false,
    explicitContent: true,
    fetchLyrics: false,
    preferSyncedLyrics: true,
    albumArtSize: 3600,
    albumArtQuality: 1,
    zipName: '{artists} - {name}',
    trackName: '{artists} - {name}'
};

/**
 * Never throws: unparseable persisted data must degrade to defaults rather than
 * crash the app on first paint.
 */
export function parseSettings(value: unknown): SettingsProps | null {
    const result = settingsSchema.safeParse(value);
    return result.success ? result.data : null;
}

export function isValidSettings(value: unknown): value is SettingsProps {
    return settingsSchema.safeParse(value).success;
}
