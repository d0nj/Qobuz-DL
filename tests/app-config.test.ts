import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ENV_KEY = 'NEXT_PUBLIC_APPLICATION_NAME';

/**
 * The resolver reads the env var at module-evaluation time, so each case needs
 * a fresh module instance rather than a fresh import specifier.
 */
async function loadWith(value: string | undefined) {
    if (value === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = value;

    vi.resetModules();
    return await import('@/lib/app-config');
}

beforeEach(() => {
    delete process.env[ENV_KEY];
});

afterEach(() => {
    delete process.env[ENV_KEY];
    vi.resetModules();
});

describe('application name resolution', () => {
    it('falls back to the default when the variable is unset', async () => {
        const mod = await loadWith(undefined);
        expect(mod.APPLICATION_NAME).toBe('Qobuz-DL');
    });

    it('falls back to the default when the variable is empty', async () => {
        const mod = await loadWith('');
        expect(mod.APPLICATION_NAME).toBe('Qobuz-DL');
    });

    it('falls back to the default when the variable is only whitespace', async () => {
        const mod = await loadWith('   ');
        expect(mod.APPLICATION_NAME).toBe('Qobuz-DL');
    });

    it('uses the configured name when set', async () => {
        const mod = await loadWith('My Music');
        expect(mod.APPLICATION_NAME).toBe('My Music');
    });

    it('trims surrounding whitespace', async () => {
        const mod = await loadWith('  Tuned  ');
        expect(mod.APPLICATION_NAME).toBe('Tuned');
    });

    it('is case-insensitive when detecting the default branding', async () => {
        const mod = await loadWith('QOBUZ-DL');
        expect(mod.IS_DEFAULT_APPLICATION_NAME).toBe(true);
    });

    it('reports false for custom branding', async () => {
        const mod = await loadWith('Tuned');
        expect(mod.IS_DEFAULT_APPLICATION_NAME).toBe(false);
    });

    it('exposes a non-empty string in every case', async () => {
        for (const value of [undefined, '', '  ', 'Tuned']) {
            const mod = await loadWith(value);
            expect(typeof mod.APPLICATION_NAME).toBe('string');
            expect(mod.APPLICATION_NAME.length).toBeGreaterThan(0);
        }
    });

    it('never produces a value that breaks .toLowerCase()', async () => {
        // The original build failure: `process.env.X!.toLowerCase()` threw
        // during static generation of /_not-found when the var was unset.
        for (const value of [undefined, '', '  ']) {
            const mod = await loadWith(value);
            expect(() => mod.APPLICATION_NAME.toLowerCase()).not.toThrow();
        }
    });

    it('exports the default name constant', async () => {
        const mod = await loadWith(undefined);
        expect(mod.DEFAULT_APPLICATION_NAME).toBe('Qobuz-DL');
    });
});
