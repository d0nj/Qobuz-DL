import { z } from 'zod';

/**
 * Settings schema.
 *
 * This is the single declaration of what a valid Settings object is. The
 * TypeScript type is derived from it (see below), so the type and the runtime
 * validator cannot drift apart — which is exactly what went wrong with the
 * hand-rolled `isValidSettings` this replaced.
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
    albumArtSize: 3600,
    albumArtQuality: 1,
    zipName: '{artists} - {name}',
    trackName: '{artists} - {name}'
};

/**
 * Validate an unknown value as Settings.
 *
 * Returns the parsed (and coerced) settings on success, or `null` on failure.
 * Never throws: callers use this to decide whether persisted data is usable,
 * and unparseable persisted data must degrade to defaults rather than crash
 * the app on first paint.
 */
export function parseSettings(value: unknown): SettingsProps | null {
    const result = settingsSchema.safeParse(value);
    return result.success ? result.data : null;
}

export function isValidSettings(value: unknown): value is SettingsProps {
    return settingsSchema.safeParse(value).success;
}
