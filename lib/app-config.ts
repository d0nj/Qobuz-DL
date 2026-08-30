/**
 * Application branding, resolved once.
 *
 * `NEXT_PUBLIC_APPLICATION_NAME` is optional, and it is unset on fresh clones
 * and deploys whose env vars have not been added yet. Resolve it here so the
 * rest of the app uses plain values with no non-null assertions and a missing
 * variable degrades to a default instead of failing the build.
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
