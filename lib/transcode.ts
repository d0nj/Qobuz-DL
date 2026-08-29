import { formatArtists, formatTitle, getAlbum, QobuzTrack } from './qobuz-dl';
import { SettingsProps } from './settings-schema';

export type OutputCodec = SettingsProps['outputCodec'];
export type OutputQuality = SettingsProps['outputQuality'];

export const codecMap = {
    FLAC: { extension: 'flac', codec: 'flac' },
    WAV: { extension: 'wav', codec: 'pcm_s16le' },
    ALAC: { extension: 'm4a', codec: 'alac' },
    MP3: { extension: 'mp3', codec: 'libmp3lame' },
    AAC: { extension: 'm4a', codec: 'aac' },
    OPUS: { extension: 'opus', codec: 'libopus' }
} as const;

/**
 * Qobuz `format_id` values. 27/7/6 are lossless tiers (FLAC at descending
 * sample rates); 5 is the lossy tier, served as MP3.
 */
const LOSSY_QUALITY: OutputQuality = '5';

/**
 * Whether a downloaded file already matches what the user asked for.
 *
 * This is the single source of truth for "do we need an encoder?" The decision
 * used to live in three places, and the caller's copy disagreed with the
 * callee's: the caller tested `outputQuality === '27'` while the module tested
 * `outputQuality !== '5'`. At FLAC quality 6 or 7 with metadata off, that split
 * made the caller load a ~30MB ffmpeg.wasm blob which the callee then declined
 * to use — 30MB downloaded, nothing done.
 *
 * The tier, not the top tier, is what matters: any lossless source requested
 * as FLAC is already correct, regardless of which lossless tier it came from.
 */
export function isSourceUsableAsIs(settings: SettingsProps): boolean {
    return settings.outputQuality !== LOSSY_QUALITY && settings.outputCodec === 'FLAC';
}

export function needsEncoder(settings: SettingsProps): boolean {
    return !isSourceUsableAsIs(settings) || settings.applyMetadata;
}

/**
 * FFmpeg argv for one transcode.
 *
 * Built as a filtered array because the previous `cond ? arg : ''` form passed
 * literal empty strings to ffmpeg whenever bitrate was unset — which is every
 * lossless encode.
 */
export function buildTranscodeArgs(settings: SettingsProps, inputName: string, outputName: string): string[] {
    const extension = codecMap[settings.outputCodec].extension;
    const inputExtension = settings.outputQuality === LOSSY_QUALITY ? 'mp3' : 'flac';

    return [
        '-i',
        `${inputName}.${inputExtension}`,
        '-c:a',
        codecMap[settings.outputCodec].codec,
        ...(settings.bitrate ? ['-b:a', `${settings.bitrate}k`] : []),
        ...(settings.outputCodec === 'OPUS' ? ['-vbr', 'on'] : []),
        `${outputName}.${extension}`
    ];
}

/**
 * FFMETADATA1 block for one track.
 *
 * Optional fields are appended conditionally rather than written as empty
 * values, so a missing ISRC never produces a blank `isrc=` line.
 */
export function buildMetadataText(track: QobuzTrack, upc?: string): string {
    const album = getAlbum(track);
    const artists = album.artists?.length ? album.artists : track.performer ? [track.performer] : [];
    const artistLine = artists.length > 0 ? formatArtists(track) : 'Various Artists';
    const releaseYear = new Date(album.release_date_original).getFullYear();

    const lines = [
        ';FFMETADATA1',
        `title=${formatTitle(track)}`,
        `artist=${artistLine}`,
        `album_artist=${artists[0]?.name || track.performer?.name || 'Various Artists'}`,
        `album=${formatTitle(album)}`,
        `genre=${album.genre?.name ?? ''}`,
        `date=${album.release_date_original}`,
        `year=${Number.isNaN(releaseYear) ? '' : releaseYear}`,
        `label=${album.label?.name ?? ''}`,
        `copyright=${track.copyright ?? ''}`
    ];

    if (track.isrc) lines.push(`isrc=${track.isrc}`);
    if (upc) lines.push(`barcode=${upc}`);
    if (track.track_number) lines.push(`track=${track.track_number}`);

    return lines.join('\n');
}

/**
 * Unique names per job.
 *
 * applyMetadata writes into one shared ffmpeg filesystem, so two concurrent
 * jobs using fixed filenames would overwrite each other's inputs. The old code
 * was safe only because the download queue serialises — a guarantee declared
 * in a different module.
 */
export function jobFileNames(jobId: string, inputExtension: string, outputExtension: string) {
    return {
        input: `input-${jobId}.${inputExtension}`,
        reencoded: `reencoded-${jobId}.${outputExtension}`,
        tagged: `tagged-${jobId}.${outputExtension}`,
        metadata: `metadata-${jobId}.txt`,
        art: `art-${jobId}.jpg`,
        output: `output-${jobId}.${outputExtension}`
    };
}
