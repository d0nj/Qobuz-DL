import { getArtistReleases } from '@/lib/qobuz-dl-server';
import { getRequestCountry, numericParam, parseParams, qobuzOptions, requiredId, withEnvelope } from '@/lib/api/envelope';
import { z } from 'zod';

const releasesParamsSchema = z.object({
    artist_id: requiredId(),
    release_type: z.enum(['album', 'live', 'compilation', 'epSingle', 'download']).default('album'),
    track_size: numericParam(z.number().positive().default(1000)),
    offset: numericParam(z.number().min(0, 'Offset must be 0 or greater').default(0)),
    limit: numericParam(z.number().positive().default(10))
});

// `track_size` was a bare `z.number()`, so the string "1000" arriving from the
// query string failed validation and every paginated artist fetch 400'd.
export const GET = withEnvelope(async (request: Request) => {
    const { artist_id, release_type, track_size, offset, limit } = parseParams(request, releasesParamsSchema);
    return getArtistReleases(artist_id, release_type, limit, offset, track_size, qobuzOptions(getRequestCountry(request)));
});
