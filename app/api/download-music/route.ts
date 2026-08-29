import { getDownloadURL } from '@/lib/qobuz-dl-server';
import { getRequestCountry, numericParam, parseParams, qobuzOptions, withEnvelope } from '@/lib/api/envelope';
import { z } from 'zod';

const downloadParamsSchema = z.object({
    track_id: numericParam(z.number().min(0, 'ID must be 0 or greater').default(1)),
    quality: z.enum(['27', '7', '6', '5']).default('27')
});

export const GET = withEnvelope(async (request: Request) => {
    const { track_id, quality } = parseParams(request, downloadParamsSchema);
    const url = await getDownloadURL(track_id, quality, qobuzOptions(getRequestCountry(request)));
    return { url };
});
