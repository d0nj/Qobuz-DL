'use client';

import React, { useEffect, useState } from 'react';

/**
 * A minimal storage interface — the seam at which persistence varies.
 *
 * Two adapters exist and both are real:
 *  - `localStorage` in the browser
 *  - an in-memory fake in tests, and a no-op during SSR
 *
 * Because there are two, this seam earns its keep.
 */
export type StorageAdapter = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
};

export type PersistedConfigModule<T> = {
    parse: (raw: unknown) => T | null;
    serialize: (value: T) => string;
    defaultValue: T;
    storageKey: string;
    storage?: StorageAdapter | null;
};

/**
 * Resolve the storage adapter, or `null` when persistence is unavailable.
 *
 * Must never throw: this runs during render on the very first paint, and
 * throwing here would break SSR and private-browsing modes outright.
 */
export function getStorage(): StorageAdapter | null {
    if (typeof window === 'undefined') return null;
    try {
        const storage = window.localStorage;
        // Safari in private mode exposes localStorage but throws on write.
        const probe = '__qobuz_dl_probe__';
        storage.setItem(probe, '1');
        storage.removeItem(probe);
        return {
            getItem: (key) => {
                try {
                    return storage.getItem(key);
                } catch {
                    return null;
                }
            },
            setItem: (key, value) => {
                try {
                    storage.setItem(key, value);
                } catch {
                    // Quota exceeded or blocked: drop the write, keep running.
                }
            },
            removeItem: (key) => {
                try {
                    storage.removeItem(key);
                } catch {
                    /* ignore */
                }
            }
        };
    } catch {
        return null;
    }
}

/**
 * Read a persisted value, falling back to the default.
 *
 * The default is returned for: absent keys, malformed JSON, and values that
 * fail the validator. All three mean the same thing to a caller: we have no
 * usable stored config, so use the defaults.
 */
export function readPersisted<T>(config: PersistedConfigModule<T>): T {
    const storage = config.storage === undefined ? getStorage() : config.storage;
    if (!storage) return config.defaultValue;

    let raw: string | null;
    try {
        raw = storage.getItem(config.storageKey);
    } catch {
        return config.defaultValue;
    }
    if (raw === null || raw === undefined) return config.defaultValue;

    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(raw);
    } catch {
        return config.defaultValue;
    }

    return config.parse(parsedJson) ?? config.defaultValue;
}

export function writePersisted<T>(config: PersistedConfigModule<T>, value: T): void {
    const storage = config.storage === undefined ? getStorage() : config.storage;
    if (!storage) return;
    try {
        storage.setItem(config.storageKey, config.serialize(value));
    } catch {
        /* quota or blocked: ignore */
    }
}

/**
 * Deep module: persisted config.
 *
 * The interface is small — a value, a setter, a reset — and behind it lives
 * the whole read/validate/write/migrate rhythm. Callers no longer re-implement
 * "read localStorage once on mount, then write on every change", which is the
 * duplicated dance this replaces (and which raced with itself: the post-mount
 * read effect landed after the write effect had already persisted defaults).
 */
export function usePersistedConfig<T>(config: PersistedConfigModule<T>) {
    // Read synchronously in the initializer. This is what removes the race:
    // there is no window in which the default can be written over stored data.
    const [value, setValue] = useState<T>(() => readPersisted(config));

    // Re-read if the identity of the module changes (e.g. storage becomes
    // available after hydration), and keep other tabs in sync.
    useEffect(() => {
        const storage = config.storage === undefined ? getStorage() : config.storage;
        if (!storage) return;

        // Align with persisted state after mount: covers hydration and the
        // case where another tab changed the value while we were mounted.
        setValue((current) => {
            const persisted = readPersisted(config);
            return persisted === config.defaultValue && current !== config.defaultValue ? current : persisted;
        });

        if (typeof window === 'undefined') return;
        const onStorage = (event: StorageEvent) => {
            if (event.storageArea !== window.localStorage) return;
            if (event.key !== null && event.key !== config.storageKey) return;
            setValue(readPersisted(config));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [config.storageKey]);

    useEffect(() => {
        writePersisted(config, value);
    }, [config, value]);

    const reset = React.useCallback(() => setValue(config.defaultValue), [config]);

    return { value, setValue, reset } as const;
}
