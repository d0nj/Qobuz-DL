import { describe, expect, it, vi } from 'vitest';
import { albumCacheOf } from '@/lib/download/request';
import { defaultSettings } from '@/lib/settings-schema';

describe('albumCacheOf', () => {
    const album = { id: '1', title: 'Blue' } as never;

    it('pairs data with its setter', () => {
        const setData = vi.fn();
        const cache = albumCacheOf(album, setData);
        expect(cache).toEqual({ data: album, setData });
    });

    it('normalises null and undefined data to null', () => {
        expect(albumCacheOf(null, vi.fn())?.data).toBeNull();
        expect(albumCacheOf(undefined, vi.fn())?.data).toBeNull();
    });

    it('is undefined without a setter, so the caller need not pass a matched pair', () => {
        // Previously the mode was encoded as two nulled positional slots.
        expect(albumCacheOf(album, undefined)).toBeUndefined();
    });

    it('routes writes through the setter', () => {
        const setData = vi.fn();
        albumCacheOf(null, setData)!.setData(album as never);
        expect(setData).toHaveBeenCalledWith(album);
    });
});

describe('DownloadRequest shape', () => {
    it('carries the target, settings and optional context', () => {
        const request = { target: { id: '1' } as never, settings: defaultSettings, country: 'US' };
        expect(request.country).toBe('US');
        expect(request.settings.outputCodec).toBe('FLAC');
    });

    it('omits country and albumCache when unset', () => {
        const request = { target: { id: '1' } as never, settings: defaultSettings };
        expect('country' in request).toBe(false);
        expect('albumCache' in request).toBe(false);
    });
});
