import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { pollService, responseService } from '@/lib/services';
import { notFoundError, internalError } from '@/lib/api/errors';

/**
 * GET /api/polls/[id]/results — Get full results for a poll (auth required, ownership enforced).
 * Query params:
 *   - includeTest=true: include test responses alongside real responses
 *   - testOnly=true: return ONLY test responses (for Test Responses tab)
 * Admin always sees full details, non-anonymised.
 */
export const GET = withAuth(async (request: Request, context: { userId: string; params?: { id: string } }) => {
  try {
    const { id } = context.params!;
    const poll = await pollService.getPoll(id, context.userId);

    if (!poll) {
      return notFoundError('Poll not found');
    }

    const url = new URL(request.url);
    const includeTest = url.searchParams.get('includeTest') === 'true';
    const testOnly = url.searchParams.get('testOnly') === 'true';

    const results = await responseService.getResults(id, {
      includeTest,
      testOnly,
      revealStage: 'DETAILS',
      anonymise: false,
    });

    return NextResponse.json(results);
  } catch (error) {
    return internalError();
  }
});
