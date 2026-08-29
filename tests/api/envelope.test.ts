import { fail, getRequestCountry, normalizeError, ok, parseParams, numericParam, qobuzOptions } from '@/lib/api/envelope';
import { z } from 'zod';

describe('ok', () => {
    it('wraps data in a success envelope at status 200', async () => {
        const response = ok({ url: 'https://example.test/track' });
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ success: true, data: { url: 'https://example.test/track' } });
    });

    it('honours an explicit status', () => {
        expect(ok('created', 201).status).toBe(201);
    });

    it('sets a JSON content type', () => {
        expect(ok({}).headers.get('content-type')).toContain('application/json');
    });
});

describe('fail', () => {
    it('defaults to 400 and wraps the error', async () => {
        const response = fail('bad request');
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ success: false, error: 'bad request' });
    });

    it('accepts an explicit status', () => {
        expect(fail('boom', 500).status).toBe(500);
    });
});

describe('normalizeError', () => {
    it('unwraps Errors to their message', () => {
        expect(normalizeError(new Error('nope'))).toBe('nope');
    });

    it('passes through plain values', () => {
        expect(normalizeError('plain')).toBe('plain');
    });

    it('substitutes a fallback for nullish values', () => {
        expect(normalizeError(undefined)).toBe('An unknown error occurred.');
        expect(normalizeError(null)).toBe('An unknown error occurred.');
    });

    it('flattens ZodErrors into path/message pairs', () => {
        const result = z.object({ q: z.string().min(1) }).safeParse({ q: '' });
        expect(result.success).toBe(false);
        const normalized = normalizeError(result.error!) as { path: string; message: string }[];
        expect(normalized).toEqual([{ path: 'q', message: expect.any(String) }]);
    });

    it('does not leak raw Zod internals', () => {
        // The old handlers returned `error.errors` verbatim, exposing internal
        // structures clients had no use for.
        const result = z.object({ track_size: z.number() }).safeParse({ track_size: '1000' });
        const normalized = JSON.stringify(normalizeError(result.error!));
        expect(normalized).not.toContain('ZodError');
        expect(normalized).not.toContain('invalid_type');
    });
});

describe('parseParams', () => {
    const schema = z.object({ album_id: z.string().min(1) });

    it('reads params off a Request URL', () => {
        const request = new Request('http://localhost/api/get-album?album_id=abc123');
        expect(parseParams(request, schema)).toEqual({ album_id: 'abc123' });
    });

    it('throws a ZodError when validation fails', () => {
        const request = new Request('http://localhost/api/get-album');
        expect(() => parseParams(request, schema)).toThrow(z.ZodError);
    });
});

describe('numericParam', () => {
    const schema = z.object({ track_size: numericParam(z.number().positive().default(1000)) });

    it('accepts the string a query param arrives as', () => {
        // The get-releases bug: a bare z.number() rejected "1000".
        expect(schema.parse({ track_size: '500' }).track_size).toBe(500);
    });

    it('applies the default when the param is omitted', () => {
        // Plain z.preprocess(parseInt, ...) turns undefined into NaN and fails,
        // so an omitted track_size 400'd instead of defaulting to 1000.
        expect(schema.parse({}).track_size).toBe(1000);
    });

    it('applies the default for an empty string', () => {
        expect(schema.parse({ track_size: '' }).track_size).toBe(1000);
    });

    it('accepts 0 when the inner schema allows it', () => {
        const zeroAllowed = z.object({ offset: numericParam(z.number().min(0).default(0)) });
        expect(zeroAllowed.parse({ offset: '0' }).offset).toBe(0);
    });

    it('passes non-numeric strings through so they fail with a readable message', () => {
        const result = schema.safeParse({ track_size: 'abc' });
        expect(result.success).toBe(false);
        expect(JSON.stringify(normalizeError(result.error!))).toContain('Expected number');
    });

    it('still enforces the inner constraints', () => {
        expect(schema.safeParse({ track_size: '0' }).success).toBe(false);
        expect(schema.safeParse({ track_size: '-5' }).success).toBe(false);
    });

    it('accepts real numbers too', () => {
        expect(schema.parse({ track_size: 500 }).track_size).toBe(500);
    });
});

describe('getRequestCountry', () => {
    it('returns the Token-Country header', () => {
        const request = new Request('http://localhost/api/get-music?q=x', { headers: { 'Token-Country': 'FR' } });
        expect(getRequestCountry(request)).toBe('FR');
    });

    it('returns undefined when unset', () => {
        expect(getRequestCountry(new Request('http://localhost/api/get-music?q=x'))).toBeUndefined();
    });
});

describe('qobuzOptions', () => {
    it('omits country when unset so the server picks a random token', () => {
        expect(qobuzOptions(undefined)).toEqual({});
    });

    it('passes country through when set', () => {
        expect(qobuzOptions('US')).toEqual({ country: 'US' });
    });
});
