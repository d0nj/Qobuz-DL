import { describe, expect, it } from 'vitest';
import { readPersisted, writePersisted, type PersistedConfigModule, type StorageAdapter } from '@/lib/persisted-config';

/**
 * An in-memory adapter — the second adapter that makes the storage seam real.
 */
function fakeStorage(initial: Record<string, string> = {}): StorageAdapter & { data: Record<string, string>; writes: number } {
    const data: Record<string, string> = { ...initial };
    return {
        data,
        writes: 0,
        getItem: (key) => (key in data ? data[key] : null),
        setItem: (key, value) => {
            data[key] = String(value);
        },
        removeItem: (key) => {
            delete data[key];
        }
    };
}

type Config = { theme: string; volume: number };

const parseConfig = (raw: unknown): Config | null => {
    if (typeof raw !== 'object' || raw === null) return null;
    const candidate = raw as Partial<Config>;
    if (typeof candidate.theme !== 'string' || typeof candidate.volume !== 'number') return null;
    return { theme: candidate.theme, volume: candidate.volume };
};

const module_ = (storage: StorageAdapter | null): PersistedConfigModule<Config> => ({
    storageKey: 'cfg',
    defaultValue: { theme: 'dark', volume: 50 },
    parse: parseConfig,
    serialize: (value) => JSON.stringify(value),
    storage
});

describe('readPersisted', () => {
    it('returns the default when the key is absent', () => {
        expect(readPersisted(module_(fakeStorage()))).toEqual({ theme: 'dark', volume: 50 });
    });

    it('returns the stored value when it is valid', () => {
        const storage = fakeStorage({ cfg: JSON.stringify({ theme: 'light', volume: 80 }) });
        expect(readPersisted(module_(storage))).toEqual({ theme: 'light', volume: 80 });
    });

    it('falls back to the default when the stored value fails validation', () => {
        // This is the case that matters: a stale or corrupt blob must not
        // reach the app. It degrades to defaults instead of crashing.
        const storage = fakeStorage({ cfg: JSON.stringify({ theme: 'light' }) });
        expect(readPersisted(module_(storage))).toEqual({ theme: 'dark', volume: 50 });
    });

    it('falls back to the default on malformed JSON', () => {
        const storage = fakeStorage({ cfg: '{not json' });
        expect(readPersisted(module_(storage))).toEqual({ theme: 'dark', volume: 50 });
    });

    it('falls back to the default when stored JSON is not an object', () => {
        for (const raw of ['null', '42', '"a string"', '[1,2]']) {
            const storage = fakeStorage({ cfg: raw });
            expect(readPersisted(module_(storage))).toEqual({ theme: 'dark', volume: 50 });
        }
    });

    it('falls back to the default when there is no storage at all (SSR)', () => {
        expect(readPersisted(module_(null))).toEqual({ theme: 'dark', volume: 50 });
    });

    it('survives a storage that throws on read', () => {
        const hostile: StorageAdapter = {
            getItem: () => {
                throw new Error('SecurityError');
            },
            setItem: () => {
                throw new Error('SecurityError');
            },
            removeItem: () => {
                throw new Error('SecurityError');
            }
        };
        expect(() => readPersisted(module_(hostile))).not.toThrow();
        expect(readPersisted(module_(hostile))).toEqual({ theme: 'dark', volume: 50 });
    });
});

describe('writePersisted', () => {
    it('persists a serializable value', () => {
        const storage = fakeStorage();
        writePersisted(module_(storage), { theme: 'light', volume: 10 });
        expect(storage.data.cfg).toBe(JSON.stringify({ theme: 'light', volume: 10 }));
    });

    it('is a no-op when there is no storage (SSR)', () => {
        expect(() => writePersisted(module_(null), { theme: 'light', volume: 10 })).not.toThrow();
    });

    it('swallows write failures (quota / private browsing)', () => {
        const hostile: StorageAdapter = {
            getItem: () => null,
            setItem: () => {
                throw new Error('QuotaExceededError');
            },
            removeItem: () => {}
        };
        expect(() => writePersisted(module_(hostile), { theme: 'light', volume: 10 })).not.toThrow();
    });

    it('round-trips through read', () => {
        const storage = fakeStorage();
        const cfg = module_(storage);
        writePersisted(cfg, { theme: 'light', volume: 77 });
        expect(readPersisted(cfg)).toEqual({ theme: 'light', volume: 77 });
    });
});

describe('the stale-write race this module removes', () => {
    it('never overwrites a stored value with the default on init', () => {
        // Previously: useState(default) ran first, a write effect persisted
        // the default, and only then did a read effect load the stored value.
        // Reading in the initializer means the stored value is what we mount
        // with, so the default can never win that race.
        const storage = fakeStorage({ cfg: JSON.stringify({ theme: 'light', volume: 80 }) });
        const cfg = module_(storage);
        const mounted = readPersisted(cfg);
        writePersisted(cfg, mounted);
        expect(readPersisted(cfg)).toEqual({ theme: 'light', volume: 80 });
    });
});
