import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/**
 * The background setting was write-only: `settings.particles` was set by the
 * form and read by nothing, so picking "Solid Color" changed nothing on screen.
 */
describe('background setting', () => {
    it('renders the grain from a component that reads the setting', () => {
        const grain = read('components/grain-field.tsx');
        expect(grain).toContain('useSettings');
        expect(grain).toMatch(/settings\.particles/);
    });

    it('renders nothing when the user picks Solid Color', () => {
        // The old markup put the div in layout.tsx unconditionally.
        expect(read('components/grain-field.tsx')).toContain('return null');
        expect(read('app/layout.tsx')).not.toContain("className='grain-field'");
    });

    it('mounts the grain inside SettingsProvider so it can read the setting', () => {
        const layout = read('app/layout.tsx');
        const settingsAt = layout.indexOf('<SettingsProvider>');
        const grainAt = layout.indexOf('<GrainField />');
        expect(settingsAt).toBeGreaterThan(-1);
        expect(grainAt).toBeGreaterThan(settingsAt);
    });

    it('waits for mount so hydration does not flash grain at Solid Color users', () => {
        // Settings live in localStorage, invisible to the server. Rendering on
        // the server and removing on hydration would flash.
        const grain = read('components/grain-field.tsx');
        expect(grain).toContain('mounted');
        expect(grain).toContain('useEffect');
    });

    it('keeps the default as grain, matching the design contract', () => {
        expect(read('lib/settings-schema.ts')).toMatch(/particles:\s*true/);
    });
});
