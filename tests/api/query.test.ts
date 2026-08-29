import { buildQueryString, buildUrl } from '@/lib/api/query';

describe('buildQueryString', () => {
    it('encodes characters that would otherwise invent new parameters', () => {
        // The regression this seam exists for: `?q=${query}` sent `tom & jerry` as
        // `q=tom ` plus a stray `jerry` parameter.
        expect(buildQueryString({ q: 'tom & jerry' })).toBe('q=tom+%26+jerry');
    });

    it('encodes reserved characters', () => {
        expect(buildQueryString({ q: 'a#b' })).toBe('q=a%23b');
        expect(buildQueryString({ q: 'a+b' })).toBe('q=a%2Bb');
        expect(buildQueryString({ q: 'a=b' })).toBe('q=a%3Db');
        expect(buildQueryString({ q: 'a?b' })).toBe('q=a%3Fb');
    });

    it('percent-encodes non-ASCII so the server decodes the same string', () => {
        const query = buildQueryString({ q: 'Björk' });
        expect(query).toContain('%');
        // Round-trips to the exact original string.
        expect(new URLSearchParams(query).get('q')).toBe('Björk');
    });

    it('omits null and undefined instead of sending them as text', () => {
        // An unset country must vanish entirely; `Token-Country=undefined` would be
        // read by the server as a literal country name.
        expect(buildQueryString({ q: 'x', country: undefined, other: null })).toBe('q=x');
    });

    it('keeps falsy-but-meaningful values', () => {
        expect(buildQueryString({ offset: 0, flag: false, empty: '' })).toBe('offset=0&flag=false&empty=');
    });

    it('can still skip empty strings when asked', () => {
        expect(buildQueryString({ q: '' }, { skipEmptyStrings: true })).toBe('');
    });

    it('repeats array-valued params', () => {
        expect(buildQueryString({ id: ['a', 'b'] })).toBe('id=a&id=b');
    });

    it('stringifies numbers', () => {
        expect(buildQueryString({ offset: 0, limit: 10 })).toBe('offset=0&limit=10');
    });
});

describe('buildUrl', () => {
    it('appends the encoded query', () => {
        expect(buildUrl('/api/get-music', { q: 'a&b', offset: 0 })).toBe('/api/get-music?q=a%26b&offset=0');
    });

    it('omits the separator when there are no params', () => {
        expect(buildUrl('/api/get-countries')).toBe('/api/get-countries');
        expect(buildUrl('/api/get-countries', { country: undefined })).toBe('/api/get-countries');
    });
});
