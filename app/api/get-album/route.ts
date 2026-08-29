import { getAlbumInfo } from '@/lib/qobuz-dl-server';
import { getRequestCountry, parseParams, qobuzOptions, requiredId, withEnvelope } from '@/lib/api/envelope';
import { z } from 'zod';

const albumInfoParamsSchema = z.object({
    album_id: requiredId()
});

export const GET = withEnvelope(async (request: Request) => {
    const { album_id } = parseParams(request, albumInfoParamsSchema);
    return getAlbumInfo(album_id, qobuzOptions(getRequestCountry(request)));
});
