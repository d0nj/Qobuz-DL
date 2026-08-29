import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/**
 * Pinning the motion contract, not the aesthetics.
 *
 * The value in these assertions is temporal: two of the three behaviours below
 * were broken in ways that no screenshot shows — a transition declared without
 * a duration, and a reduced-motion rule that lost to a more specific selector.
 */
describe('motion contract', () => {
    const css = read('app/globals.css');

    it('gives the progress fill a real duration', () => {
        // `transition-all` with no duration animates nothing: the bar jumped
        // between update ticks while appearing to declare a transition.
        expect(css).toMatch(/--progress-fill-duration:\s*420ms/);
    });

    it('zeroes the fill under reduced motion at every specificity level', () => {
        // `[data-resetting]` outranks `:root`, so a reduced-motion rule
        // targeting only `:root` left resets animating for those users.
        const reduced = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?--progress-fill-duration:\s*0ms/);
        expect(reduced).not.toBeNull();
        expect(reduced![0]).toContain('[data-resetting]');
    });

    it('keeps the two authored CSS animations guarded', () => {
        for (const name of ['plate-hang', 'wordmark-in']) {
            expect(css).toMatch(new RegExp(`@keyframes ${name}`));
        }
        const guards = css.match(/@media \(prefers-reduced-motion: reduce\)/g) ?? [];
        expect(guards.length).toBeGreaterThanOrEqual(3);
    });

    it('mounts MotionConfig so JS-driven motion inherits the OS preference', () => {
        // Every motion/react component animated unconditionally before this.
        expect(read('components/motion-provider.tsx')).toContain("reducedMotion='user'");
        expect(read('app/layout.tsx')).toContain('<MotionProvider>');
    });

    it('uses a decelerating curve rather than a bounce', () => {
        const provider = read('components/motion-provider.tsx');
        expect(provider).toContain('0.16, 1, 0.3, 1');
    });
});

describe('completion beat', () => {
    const types = read('lib/status-bar/types.ts');

    it('flags completion on the status bar', () => {
        expect(types).toMatch(/complete\?:\s*boolean/);
    });

    it('sets the flag when a download finishes', () => {
        const job = read('lib/download-job.tsx');
        expect(job).toMatch(/progress:\s*100,\s*complete:\s*true/);
    });

    it('clears the flag when the next job starts', () => {
        expect(read('lib/status-bar/jobs.tsx')).toContain('complete: false');
    });

    it('holds the finished bar before it retreats', () => {
        // Without the hold the bar vanishes at the instant it fills, so the
        // one moment worth authoring reads as a glitch.
        const context = read('lib/status-bar/context.tsx');
        expect(context).toMatch(/COMPLETION_HOLD_MS\s*=\s*\d+/);
        expect(context).toContain('clearTimeout');
    });

    it('cancels a pending retreat when a new job is enqueued', () => {
        const context = read('lib/status-bar/context.tsx');
        expect(context).toMatch(/snapshot\.size\s*>\s*0\)\s*\{[\s\S]*?clearTimeout/);
    });
});
