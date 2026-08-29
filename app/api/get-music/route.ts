import { search } from '@/lib/qobuz-dl-server';
import { getRequestCountry, numericParam, parseParams, qobuzOptions, withEnvelope } from '@/lib/api/envelope';
import { z } from 'zod';

const searchParamsSchema = z.object({
    q: z.string().min(1, 'Query is required'),
    offset: numericParam(z.number().max(1000, 'Offset must be less than 1000').min(0, 'Offset must be 0 or greater').default(0))
});

const SEARCH_LIMIT = 10;

export const GET = withEnvelope(async (request: Request) => {
    const { q, offset } = parseParams(request, searchParamsSchema);
    return search(q, SEARCH_LIMIT, offset, qobuzOptions(getRequestCountry(request)));
});
