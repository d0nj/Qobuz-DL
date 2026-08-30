/**
 * Query-string encoding for `/api/*` calls.
 *
 * `URLSearchParams` is required, not interpolation: `?q=${query}` corrupts any
 * query containing `&`, `#`, `+` or non-ASCII characters — `tom & jerry`
 * arrives as `q=tom ` with a stray `jerry` parameter.
 *
 * Deliberately free of React and Next imports so both the client transport and
 * the tests can use it.
 */

export type QueryValue = string | number | boolean | null | undefined | (string | number | boolean)[];

export type QueryParams = Record<string, QueryValue>;

/**
 * Serialises params, omitting null/undefined (and blank strings when asked).
 *
 * Omitting `undefined` matters for the country picker: an unset country must
 * disappear from the query entirely rather than be sent as `Token-Country=undefined`,
 * which the server would otherwise treat as a literal country name.
 */
export function buildQueryString(params: QueryParams = {}, options: { skipEmptyStrings?: boolean } = {}): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) continue;
        if (Array.isArray(value)) {
            for (const entry of value) {
                if (entry === null || entry === undefined) continue;
                search.append(key, String(entry));
            }
            continue;
        }
        if (options.skipEmptyStrings && value === '') continue;
        search.append(key, String(value));
    }
    return search.toString();
}

/** Joins a base path with encoded query params. */
export function buildUrl(path: string, params: QueryParams = {}, options?: { skipEmptyStrings?: boolean }): string {
    const query = buildQueryString(params, options);
    return query ? `${path}?${query}` : path;
}
