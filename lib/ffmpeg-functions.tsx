import axios from 'axios';
import { getFullResImageUrl } from './qobuz-dl';
import { SettingsProps } from './settings-schema';
import { buildMetadataText, buildTranscodeArgs, codecMap, isSourceUsableAsIs, jobFileNames } from './transcode';
import { resizeImage } from './utils';

/**
 * The port every transcode goes through.
 *
 * Two adapters satisfy it in production: ffmpeg.wasm, and the FLAC worker used
 * by `fixMD5Hash`. A third — a recording fake — satisfies it in tests. Two
 * real adapters means this seam earns its keep rather than speculating.
 */
export type FFmpegType = {
    FS: (action: string, filename: string, fileData?: Uint8Array) => Promise<any>;
    run: (...args: string[]) => Promise<any>;
    isLoaded: () => boolean;
    load: ({ signal }: { signal: AbortSignal }) => Promise<any>;
};

declare const FFmpeg: { createFFmpeg: any; fetchFile: any };

export type ProgressReporter = (description: string, progress?: number) => void;

export type TranscodeOptions = {
    ffmpeg: FFmpegType | null;
    settings: SettingsProps;
    track: Parameters<typeof buildMetadataText>[0];
    albumArt?: ArrayBuffer | false;
    upc?: string;
    report?: ProgressReporter;
};

const toBytes = (data: ArrayBuffer | Uint8Array): Uint8Array =>
    data instanceof Uint8Array ? data : new Uint8Array(data);

async function fetchAlbumArt(track: TranscodeOptions['track'], settings: SettingsProps): Promise<ArrayBuffer | false> {
    const url = await resizeImage(getFullResImageUrl(track as any), settings.albumArtSize, settings.albumArtQuality);
    if (!url) return false;
    return (await axios.get(url, { responseType: 'arraybuffer' })).data;
}

/**
 * Transcode one track and write its tags.
 *
 * Returns bytes rather than a Blob. The previous version returned a Blob from
 * `fixMD5Hash` but was consumed as raw bytes at one call site and as
 * `await (await …).arrayBuffer()` at another, which only typechecked because
 * the alias passed as any.
 */
export async function transcodeTrack(
    buffer: ArrayBuffer | Uint8Array,
    { ffmpeg, settings, track, albumArt, upc, report }: TranscodeOptions
): Promise<Uint8Array> {
    const skipReencode = isSourceUsableAsIs(settings);
    if (skipReencode && !settings.applyMetadata) return toBytes(buffer);

    if (!ffmpeg) throw new Error('FFmpeg is not available. Reload the page and try again.');

    const extension = codecMap[settings.outputCodec].extension;
    const inputExtension = settings.outputQuality === '5' ? 'mp3' : 'flac';
    const names = jobFileNames(
        `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        inputExtension,
        extension
    );

    let working = toBytes(buffer);

    if (!skipReencode) {
        report?.('Re-encoding track...');
        working = await runTranscode(ffmpeg, settings, working, names.input, names.reencoded);
    }

    if (!settings.applyMetadata || settings.outputCodec === 'WAV') return working;

    report?.('Applying metadata...');
    working = await writeMetadata(ffmpeg, settings, track, working, names, extension, upc);

    if (settings.outputCodec === 'OPUS' || albumArt === false) return working;

    const art = albumArt ?? (await fetchAlbumArt(track, settings));
    if (!art) return working;

    return attachArtwork(ffmpeg, working, art, names);
}

async function runTranscode(
    ffmpeg: FFmpegType,
    settings: SettingsProps,
    input: Uint8Array,
    inputName: string,
    outputName: string
): Promise<Uint8Array> {
    const args = buildTranscodeArgs(settings, inputName.replace(/\.[^.]+$/, ''), outputName.replace(/\.[^.]+$/, ''));
    await ffmpeg.FS('writeFile', inputName, input);
    await ffmpeg.run(...args);
    const output = await ffmpeg.FS('readFile', outputName);
    await ffmpeg.FS('unlink', inputName);
    await ffmpeg.FS('unlink', outputName);
    return output;
}

async function writeMetadata(
    ffmpeg: FFmpegType,
    settings: SettingsProps,
    track: TranscodeOptions['track'],
    input: Uint8Array,
    names: ReturnType<typeof jobFileNames>,
    extension: string,
    upc?: string
): Promise<Uint8Array> {
    const metadata = buildMetadataText(track, upc);
    await ffmpeg.FS('writeFile', names.tagged, input);
    await ffmpeg.FS('writeFile', names.metadata, new TextEncoder().encode(metadata));
    await ffmpeg.run('-i', names.tagged, '-i', names.metadata, '-map_metadata', '1', '-codec', 'copy', names.output);
    const output = await ffmpeg.FS('readFile', names.output);
    await ffmpeg.FS('unlink', names.tagged);
    await ffmpeg.FS('unlink', names.metadata);
    await ffmpeg.FS('unlink', names.output);
    return output;
}

async function attachArtwork(
    ffmpeg: FFmpegType,
    input: Uint8Array,
    art: ArrayBuffer,
    names: ReturnType<typeof jobFileNames>
): Promise<Uint8Array> {
    await ffmpeg.FS('writeFile', names.tagged, input);
    await ffmpeg.FS('writeFile', names.art, toBytes(art));
    await ffmpeg.run(
        '-i',
        names.tagged,
        '-i',
        names.art,
        '-c',
        'copy',
        '-map',
        '0',
        '-map',
        '1',
        '-disposition:v:0',
        'attached_pic',
        names.output
    );
    const output = await ffmpeg.FS('readFile', names.output);
    await ffmpeg.FS('unlink', names.tagged);
    await ffmpeg.FS('unlink', names.art);
    await ffmpeg.FS('unlink', names.output);
    return output;
}

/**
 * Recompute a FLAC file's STREAMINFO MD5.
 *
 * The FLAC encoder writes the pre-encode checksum, which is wrong for the file
 * once tags are attached. This runs the same encode again through a worker so
 * the checksum matches the final bytes.
 */
export async function fixMD5Hash(trackBuffer: ArrayBuffer | Uint8Array, report?: ProgressReporter): Promise<ArrayBuffer> {
    report?.('Fixing MD5 hash...', 0);

    const blob: Blob = await new Promise((resolve, reject) => {
        const worker = new Worker('flac/EmsWorkerProxy.js');
        worker.onerror = reject;
        worker.onmessage = (event: MessageEvent) => {
            const { reply, values } = event.data ?? {};
            if (reply === 'progress') {
                if (values?.[1]) report?.('Fixing MD5 hash...', Math.floor((values[0] / values[1]) * 100));
                return;
            }
            if (reply === 'done') {
                worker.terminate();
                const first = Object.values(values ?? {})[0] as { blob?: Blob } | undefined;
                if (first?.blob) resolve(first.blob);
                else reject(new Error('FLAC encoder returned no output.'));
            }
        };
        worker.postMessage({
            command: 'encode',
            args: ['input.flac', '-o', 'output.flac'],
            outData: { 'output.flac': { MIME: 'audio/flac' } },
            fileData: { 'input.flac': new Uint8Array(trackBuffer as ArrayBuffer) }
        });
    });

    return blob.arrayBuffer();
}

export function createFFmpeg(): FFmpegType | null {
    if (typeof FFmpeg === 'undefined') return null;
    return FFmpeg.createFFmpeg({ log: false }) as FFmpegType;
}

export async function loadFFmpeg(ffmpeg: FFmpegType | null, signal: AbortSignal): Promise<FFmpegType | null> {
    if (!ffmpeg) return null;
    if (!ffmpeg.isLoaded()) await ffmpeg.load({ signal });
    return ffmpeg;
}
