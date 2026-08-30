import { escapeMetadataValue } from './lyrics/lrclib';
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
 * Single source of truth for "do we need an encoder?".
 *
 * This decision used to be duplicated in three places, and the caller's copy
 * disagreed: it tested `outputQuality === '27'` while this tests `!== '5'`. At
 * FLAC quality 6 or 7 with metadata off, that loaded a ~30MB ffmpeg.wasm blob
 * which was then never used.
 *
 * The tier, not the top tier, is what matters: any lossless source requested as
 * FLAC is already correct, whichever lossless tier it came from.
 */
export function isSourceUsableAsIs(settings: SettingsProps): boolean {
    return settings.outputQuality !== LOSSY_QUALITY && settings.outputCodec === 'FLAC';
}

export function needsEncoder(settings: SettingsProps): boolean {
    return !isSourceUsableAsIs(settings) || settings.applyMetadata;
}

/**
 * Filtered array rather than `cond ? arg : ''`, which passed literal empty
 * strings to ffmpeg whenever bitrate was unset — i.e. every lossless encode.
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
 * Optional fields are appended conditionally, so a missing ISRC never produces
 * a blank `isrc=` line.
 *
 * Lyrics are escaped: a raw newline ends the entry, so unescaped lyrics truncate
 * at the first line. Verified against ffmpeg 7.1 — see `escapeMetadataValue`.
 */
export function buildMetadataText(track: QobuzTrack, upc?: string, lyrics?: { plain: string; synced?: string | null } | null): string {
    const album = getAlbum(track);
    if (!album) return [';FFMETADATA1', `title=${formatTitle(track)}`].join('\n');

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

    // `lyrics` is the unsynchronised text. `synced-lyrics` carries LRC
    // timestamps and is what Apple Music, Poweramp and foobar2000 read for
    // karaoke-style display; it is written only when LRCLIB has it.
    if (lyrics?.plain) lines.push(`lyrics=${escapeMetadataValue(lyrics.plain)}`);
    if (lyrics?.synced) lines.push(`synced-lyrics=${escapeMetadataValue(lyrics.synced)}`);

    return lines.join('\n');
}

/** Unique per job: metadata is written into one shared ffmpeg filesystem. */
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
