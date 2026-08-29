import { describe, expect, it } from 'vitest';
import { buildMetadataText, buildTranscodeArgs, codecMap, isSourceUsableAsIs, jobFileNames, needsEncoder } from '@/lib/transcode';
import { defaultSettings, type SettingsProps } from '@/lib/settings-schema';

const settings = (overrides: Partial<SettingsProps>): SettingsProps => ({ ...defaultSettings, ...overrides });

/**
 * What the caller used to decide, before the module owned the answer.
 * Kept here so the regression asserts the old behaviour is genuinely gone.
 */
const oldCallerLoadsFFmpeg = (s: SettingsProps): boolean =>
    s.applyMetadata || !((s.outputQuality === '27' && s.outputCodec === 'FLAC') || (s.bitrate === 320 && s.outputCodec === 'MP3'));

describe('needsEncoder', () => {
    it('does not load an encoder for a lossless source already requested as FLAC', () => {
        // The bug: the caller only recognised quality 27, so 6 and 7 downloaded
        // ~30MB of ffmpeg.wasm and then declined to use it.
        for (const quality of ['27', '7', '6'] as const) {
            expect(needsEncoder(settings({ outputQuality: quality, outputCodec: 'FLAC', applyMetadata: false }))).toBe(false);
        }
    });

    it.each(['27', '7', '6'] as const)('is the regression guard for quality %s', (quality) => {
        const s = settings({ outputQuality: quality, outputCodec: 'FLAC', applyMetadata: false });
        expect(oldCallerLoadsFFmpeg(s)).toBe(quality !== '27' ? true : false);
        expect(needsEncoder(s)).toBe(false);
    });

    it('loads an encoder when metadata is requested', () => {
        expect(needsEncoder(settings({ outputQuality: '27', outputCodec: 'FLAC', applyMetadata: true }))).toBe(true);
    });

    it('loads an encoder when the target codec differs from the source', () => {
        for (const codec of ['MP3', 'AAC', 'ALAC', 'OPUS', 'WAV'] as const) {
            expect(needsEncoder(settings({ outputQuality: '27', outputCodec: codec, applyMetadata: false }))).toBe(true);
        }
    });

    it('treats quality 5 as lossy even when FLAC is requested', () => {
        expect(needsEncoder(settings({ outputQuality: '5', outputCodec: 'FLAC', applyMetadata: false }))).toBe(true);
    });

    it('agrees with isSourceUsableAsIs on every combination', () => {
        for (const outputQuality of ['27', '7', '6', '5'] as const)
            for (const outputCodec of ['FLAC', 'WAV', 'ALAC', 'MP3', 'AAC', 'OPUS'] as const)
                for (const applyMetadata of [true, false]) {
                    const s = settings({ outputQuality, outputCodec, applyMetadata });
                    expect(needsEncoder(s)).toBe(!isSourceUsableAsIs(s) || applyMetadata);
                }
    });
});

describe('buildTranscodeArgs', () => {
    it('never emits an empty-string argument', () => {
        for (const outputCodec of ['FLAC', 'WAV', 'ALAC', 'MP3', 'AAC', 'OPUS'] as const)
            for (const bitrate of [undefined, 128, 320]) {
                const args = buildTranscodeArgs(settings({ outputCodec, bitrate }), 'in', 'out');
                expect(args.filter((a) => a === '')).toEqual([]);
                expect(args.every((a) => a.length > 0)).toBe(true);
            }
    });

    it('omits -b:a when bitrate is unset', () => {
        const args = buildTranscodeArgs(settings({ outputCodec: 'MP3', bitrate: undefined }), 'in', 'out');
        expect(args).not.toContain('-b:a');
    });

    it('emits -b:a with the bitrate when set', () => {
        const args = buildTranscodeArgs(settings({ outputCodec: 'MP3', bitrate: 320 }), 'in', 'out');
        expect(args).toContain('-b:a');
        expect(args[args.indexOf('-b:a') + 1]).toBe('320k');
    });

    it('adds -vbr on for OPUS only', () => {
        expect(buildTranscodeArgs(settings({ outputCodec: 'OPUS' }), 'in', 'out')).toContain('-vbr');
        expect(buildTranscodeArgs(settings({ outputCodec: 'MP3' }), 'in', 'out')).not.toContain('-vbr');
    });

    it.each(['FLAC', 'WAV', 'ALAC', 'MP3', 'AAC', 'OPUS'] as const)('uses the mapped codec and extension for %s', (codec) => {
        const args = buildTranscodeArgs(settings({ outputCodec: codec }), 'in', 'out');
        expect(args).toContain(codecMap[codec].codec);
        expect(args.at(-1)).toBe(`out.${codecMap[codec].extension}`);
    });

    it('reads the input as mp3 only for the lossy tier', () => {
        expect(buildTranscodeArgs(settings({ outputQuality: '5' }), 'in', 'out')[1]).toBe('in.mp3');
        expect(buildTranscodeArgs(settings({ outputQuality: '27' }), 'in', 'out')[1]).toBe('in.flac');
    });
});

describe('buildMetadataText', () => {
    const track = {
        isrc: 'GBAYE0001234',
        copyright: '2024 Some Label',
        album: {
            title: 'Blue',
            version: null,
            artists: [{ id: 1, name: 'Joni Mitchell', roles: ['main'] }],
            genre: { name: 'Folk', id: 1, path: [], color: '' },
            label: { name: 'Reprise', id: 2, albums_count: 1 },
            release_date_original: '1971-06-25',
            image: { small: '', thumbnail: '', large: '', back: null }
        },
        track_number: 3,
        title: 'A Case of You',
        version: null,
        performer: { id: 1, name: 'Joni Mitchell' }
    } as any;

    it('writes the FFMETADATA1 header first', () => {
        expect(buildMetadataText(track).startsWith(';FFMETADATA1')).toBe(true);
    });

    it('includes the core tags', () => {
        const text = buildMetadataText(track);
        expect(text).toContain('title=A Case of You');
        expect(text).toContain('artist=Joni Mitchell');
        expect(text).toContain('album=Blue');
        expect(text).toContain('genre=Folk');
        expect(text).toContain('label=Reprise');
        expect(text).toContain('copyright=2024 Some Label');
        expect(text).toContain('track=3');
        expect(text).toContain('year=1971');
    });

    it('omits isrc when null and includes it when present', () => {
        expect(buildMetadataText(track)).toContain('isrc=GBAYE0001234');
        expect(buildMetadataText({ ...track, isrc: null })).not.toContain('isrc=');
    });

    it('omits barcode without a upc and includes it when given', () => {
        expect(buildMetadataText(track)).not.toContain('barcode=');
        expect(buildMetadataText(track, '012345678912')).toContain('barcode=012345678912');
    });

    it('falls back to Various Artists when there are no artists or performer', () => {
        const bare = {
            ...track,
            album: { ...track.album, artists: [] },
            performer: undefined
        } as any;
        expect(buildMetadataText(bare)).toContain('artist=Various Artists');
        expect(buildMetadataText(bare)).toContain('album_artist=Various Artists');
    });

    it('uses the performer when the album has no artists array', () => {
        const text = buildMetadataText({ ...track, album: { ...track.album, artists: undefined } } as any);
        expect(text).toContain('artist=Joni Mitchell');
    });

    it('tolerates missing optional fields', () => {
        const sparse = {
            title: 'X',
            version: null,
            copyright: null,
            isrc: null,
            album: { title: 'Y', version: null, artists: [], genre: undefined, label: undefined, release_date_original: undefined }
        } as any;
        expect(() => buildMetadataText(sparse)).not.toThrow();
        const text = buildMetadataText(sparse);
        expect(text).toContain('title=X');
        expect(text).toContain('genre=');
    });
});

describe('jobFileNames', () => {
    it('produces distinct names per job', () => {
        const a = jobFileNames('a', 'flac', 'mp3');
        const b = jobFileNames('b', 'flac', 'mp3');
        for (const key of Object.keys(a) as Array<keyof typeof a>) {
            expect(a[key]).not.toBe(b[key]);
        }
    });

    it('carries the requested extensions', () => {
        const names = jobFileNames('x', 'flac', 'mp3');
        expect(names.input.endsWith('.flac')).toBe(true);
        expect(names.output.endsWith('.mp3')).toBe(true);
    });
});
