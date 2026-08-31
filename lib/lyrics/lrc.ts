export type SyncedLyric = { time: number; line: string };

/**
 * An LRC body is `[mm:ss.xx] text` lines, optionally with several stamps per
 * line. Anything else — metadata tags like `[ar:...]`, blank lines — carries
 * no timing and is dropped.
 */
const STAMP = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function parseLrc(text: string): SyncedLyric[] {
    const entries: SyncedLyric[] = [];
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        const stamps: number[] = [];
        let match: RegExpExecArray | null;
        STAMP.lastIndex = 0;
        while ((match = STAMP.exec(line)) !== null) {
            const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
            stamps.push(Number(match[1]) * 60 + Number(match[2]) + fraction);
        }
        if (stamps.length === 0) continue;
        const words = line.replace(STAMP, '').trim();
        if (!words) continue;
        for (const time of stamps) entries.push({ time, line: words });
    }
    return entries.sort((a, b) => a.time - b.time);
}
