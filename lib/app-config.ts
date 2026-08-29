/**
 * Application branding, resolved once.
 *
 * `NEXT_PUBLIC_APPLICATION_NAME` is optional, but every one of its call sites
 * previously used `!` and called `.toLowerCase()` on it directly. With the
 * variable unset — a fresh clone, a Vercel project before its env vars are
 * added, a Docker build without `--build-arg` — that threw
 * `Cannot read properties of undefined (reading 'toLowerCase')` and failed the
 * production build during static generation.
 *
 * Resolving it here means the rest of the app can use plain values without
 * non-null assertions, and a missing variable degrades to a sane default
 * instead of taking the build down.
 */
export const DEFAULT_APPLICATION_NAME = 'Qobuz-DL';

function resolveApplicationName(): string {
    const raw = process.env.NEXT_PUBLIC_APPLICATION_NAME;
    if (typeof raw !== 'string') return DEFAULT_APPLICATION_NAME;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : DEFAULT_APPLICATION_NAME;
}

export const APPLICATION_NAME = resolveApplicationName();

/** True when branding is the upstream default, which unlocks the Qobuz wordmark. */
export const IS_DEFAULT_APPLICATION_NAME = APPLICATION_NAME.toLowerCase() === 'qobuz-dl';
