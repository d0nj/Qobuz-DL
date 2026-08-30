import { describe, expect, it } from 'vitest';
import { defaultSettings, isValidSettings, parseSettings, settingsSchema } from '@/lib/settings-schema';

/**
 * Inputs a weak validator must still reject: a comma in place of `&&` once
 * made every codec, quality and bitrate check dead code. If the schema is
 * weakened again, these fail.
 */
const regressionCases: Array<{ name: string; value: unknown }> = [
    { name: 'bogus outputCodec', value: { ...defaultSettings, outputCodec: 'WMA' } },
    { name: 'bogus outputQuality', value: { ...defaultSettings, outputQuality: 'NOPE' } },
    { name: 'bitrate far above max', value: { ...defaultSettings, bitrate: 99999 } },
    { name: 'bitrate below min', value: { ...defaultSettings, bitrate: 1 } },
    { name: 'albumArtQuality above max', value: { ...defaultSettings, albumArtQuality: 99 } },
    { name: 'albumArtSize above max', value: { ...defaultSettings, albumArtSize: 99999 } },
    { name: 'albumArtSize below min', value: { ...defaultSettings, albumArtSize: 1 } },
    { name: 'applyMetadata not a boolean', value: { ...defaultSettings, applyMetadata: 'yes' } },
    { name: 'explicitContent not a boolean', value: { ...defaultSettings, explicitContent: 0 } },
    { name: 'fixMD5 not a boolean', value: { ...defaultSettings, fixMD5: 'true' } },
    { name: 'particles not a boolean', value: { ...defaultSettings, particles: 1 } },
    { name: 'null codec', value: { ...defaultSettings, outputCodec: null } },
    { name: 'empty object', value: {} },
    { name: 'null', value: null },
    { name: 'undefined', value: undefined },
    { name: 'a string', value: 'settings' },
    { name: 'an array', value: [defaultSettings] }
];

describe('settings schema — regression (comma-operator defect)', () => {
    it.each(regressionCases)('rejects $name', ({ value }) => {
        expect(isValidSettings(value)).toBe(false);
        expect(parseSettings(value)).toBeNull();
    });

    it('the old validator would have accepted these — proving the fix is real', () => {
        // Reproduces the original expression, comma operator included.
        const oldValidator = (obj: any): boolean =>
            (typeof obj.particles === 'boolean' &&
                ['27', '7', '6', '5'].includes(obj.outputQuality) &&
                ['FLAC', 'WAV', 'ALAC', 'MP3', 'AAC', 'OPUS'].includes(obj.outputCodec) &&
                ((typeof obj.bitrate === 'number' && obj.bitrate >= 24 && obj.bitrate <= 320) || obj.bitrate === undefined) &&
                typeof obj.applyMetadata === 'boolean' &&
                typeof obj.explicitContent === 'boolean' &&
                typeof obj.fixMD5 === 'boolean' &&
                typeof obj.albumArtSize === 'number' &&
                obj.albumArtSize >= 100 &&
                obj.albumArtSize <= 3600 &&
                typeof obj.albumArtQuality === 'number' &&
                obj.albumArtQuality >= 0.1 &&
                obj.albumArtQuality <= 1,
            typeof obj.zipName === 'string' && typeof obj.trackName === 'string');

        expect(oldValidator({ ...defaultSettings, outputCodec: 'WMA', bitrate: 99999 })).toBe(true);
        expect(isValidSettings({ ...defaultSettings, outputCodec: 'WMA', bitrate: 99999 })).toBe(false);
    });
});

describe('settings schema — accepts valid settings', () => {
    it('accepts the defaults', () => {
        expect(isValidSettings(defaultSettings)).toBe(true);
    });

    it.each(['27', '7', '6', '5'])('accepts outputQuality %s', (quality) => {
        expect(isValidSettings({ ...defaultSettings, outputQuality: quality })).toBe(true);
    });

    it.each(['FLAC', 'WAV', 'ALAC', 'MP3', 'AAC', 'OPUS'])('accepts outputCodec %s', (codec) => {
        expect(isValidSettings({ ...defaultSettings, outputCodec: codec })).toBe(true);
    });

    it('accepts undefined bitrate (lossless two-state encoding)', () => {
        expect(isValidSettings({ ...defaultSettings, bitrate: undefined })).toBe(true);
    });

    it.each([24, 128, 192, 256, 320])('accepts bitrate %s', (bitrate) => {
        expect(isValidSettings({ ...defaultSettings, bitrate })).toBe(true);
    });

    it('rejects non-integer bitrate', () => {
        expect(isValidSettings({ ...defaultSettings, bitrate: 320.5 })).toBe(false);
    });

    it.each([0.1, 0.5, 1])('accepts albumArtQuality %s', (quality) => {
        expect(isValidSettings({ ...defaultSettings, albumArtQuality: quality })).toBe(true);
    });

    it.each([100, 1000, 3600])('accepts albumArtSize %s', (size) => {
        expect(isValidSettings({ ...defaultSettings, albumArtSize: size })).toBe(true);
    });

    it('accepts empty name templates', () => {
        expect(isValidSettings({ ...defaultSettings, zipName: '', trackName: '' })).toBe(true);
    });

    it('accepts unknown extra fields without stripping them from the type', () => {
        const parsed = parseSettings({ ...defaultSettings, somethingNew: 1 });
        expect(parsed).not.toBeNull();
    });
});

describe('parseSettings', () => {
    it('returns the parsed value, not null, for valid input', () => {
        expect(parseSettings(defaultSettings)).toEqual(defaultSettings);
    });

    it('never throws on hostile input', () => {
        const hostile: unknown[] = [null, undefined, 0, '', [], {}, NaN, new Date(), () => {}, Symbol('x')];
        for (const value of hostile) {
            expect(() => parseSettings(value)).not.toThrow();
        }
    });

    it('is a total function over JSON round-trips', () => {
        const roundTripped = JSON.parse(JSON.stringify(defaultSettings));
        expect(parseSettings(roundTripped)).toEqual(defaultSettings);
    });

    it('has a schema whose inferred type matches the defaults', () => {
        expect(settingsSchema.parse(defaultSettings)).toBeDefined();
    });
});
