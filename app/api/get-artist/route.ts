import { getArtist } from '@/lib/qobuz-dl-server';
import { getRequestCountry, parseParams, qobuzOptions, requiredId, withEnvelope } from '@/lib/api/envelope';
import { z } from 'zod';

const artistReleasesParamsSchema = z.object({
    artist_id: requiredId()
});

// Nested under `artist` so `parseArtistData` receives the payload it expects.
export const GET = withEnvelope(async (request: Request) => {
    const { artist_id } = parseParams(request, artistReleasesParamsSchema);
    const artist = await getArtist(artist_id, qobuzOptions(getRequestCountry(request)));
    return { artist };
});
