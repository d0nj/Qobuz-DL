import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * The single wire format shared by every `/api/*` route.
 *
 * Every route answers with exactly this envelope, so the client module has one
 * place to unwrap and one place to raise. `success` is the discriminant.
 */
export type SuccessEnvelope<TData> = {
    success: true;
    data: TData;
};

export type FailureEnvelope = {
    success: false;
    error: unknown;
};

export type ApiEnvelope<TData> = SuccessEnvelope<TData> | FailureEnvelope;

/** Status used when a route fails before it can classify the failure itself. */
export const DEFAULT_ERROR_STATUS = 400;

/**
 * Normalises anything thrown into something JSON-serialisable.
 *
 * Zod failures carry their issues on `error.errors`/`error.issues`; the previous
 * per-route handlers stringified `error.errors` verbatim, which put unresolved
 * internal paths in the response body. Flattened issues are stable and safe.
 */
export function normalizeError(error: unknown): unknown {
    if (error instanceof z.ZodError) return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    if (error instanceof Error) return error.message;
    return error ?? 'An unknown error occurred.';
}

export function ok<TData>(data: TData, status: number = 200): NextResponse<ApiEnvelope<TData>> {
    return NextResponse.json({ success: true, data } satisfies SuccessEnvelope<TData>, { status });
}

export function fail(error: unknown, status: number = DEFAULT_ERROR_STATUS): NextResponse<ApiEnvelope<never>> {
    return NextResponse.json({ success: false, error: normalizeError(error) } satisfies FailureEnvelope, { status });
}

/**
 * Reads the search params off a request and validates them.
 *
 * `URLSearchParams` values are always strings, so numeric fields must go through
 * `z.preprocess` — a bare `z.number()` can never accept `"1000"`. Routes that
 * forgot this rejected every request carrying that param.
 */
export function parseParams<TSchema extends z.ZodTypeAny>(request: Request, schema: TSchema): z.infer<TSchema> {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    return schema.parse(params);
}

/**
 * Wraps a route handler so any thrown error becomes a well-formed failure
 * envelope instead of an unhandled rejection.
 */
export function withEnvelope<TArgs extends unknown[], TData>(handler: (...args: TArgs) => Promise<TData>) {
    return async (...args: TArgs): Promise<NextResponse<ApiEnvelope<TData>>> => {
        try {
            return ok(await handler(...args));
        } catch (error) {
            return fail(error);
        }
    };
}

/** Reads the country chosen by the country picker. Absent when unset. */
export function getRequestCountry(request: Request): string | undefined {
    return request.headers.get('Token-Country') ?? undefined;
}

/**
 * The option bag our server-side Qobuz helpers take, plus a narrowed `country`.
 *
 * Defined here rather than imported from `@/lib/qobuz-dl` because that module is
 * shared with the browser bundle; types are erased at build time but the import
 * edge is not, and this seam is meant to keep the server surface explicit.
 */
export type QobuzServerOptions = { country?: string };

export function qobuzOptions(country: string | undefined): QobuzServerOptions {
    return country ? { country } : {};
}

/**
 * Adapts a numeric schema to the string a query param arrives as.
 *
 * Both halves matter. A bare `z.number()` rejects `"1000"`, which is why
 * `track_size` used to fail every request that passed it. And
 * `z.preprocess(parseInt, schema.default(n))` silently breaks defaults: the
 * preprocessor turns an absent param into `NaN` before zod can apply
 * `.default()`, so omitting the param returns 400 instead of the default.
 */
export function numericParam<TSchema extends z.ZodTypeAny>(schema: TSchema) {
    return z.preprocess((raw) => {
        if (raw === undefined || raw === null || raw === '') return undefined;
        const parsed = Number(raw);
        return Number.isNaN(parsed) ? raw : parsed;
    }, schema);
}

/**
 * A required string ID whose message actually reaches the client.
 *
 * `z.string().min(1, 'ID is required')` only yields that message for an empty
 * string; a missing key reports zod's generic "Required" instead. Passing
 * `required_error` as well covers both cases.
 */
export function requiredId(message: string = 'ID is required') {
    return z.string({ required_error: message }).min(1, message);
}
