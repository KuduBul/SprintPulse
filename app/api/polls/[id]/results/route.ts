import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/middleware/adminAuth';
import { pollService, responseService } from '@/lib/services';
import { notFoundError, internalError } from '@/lib/api/errors';

/**
 * GET /api/polls/[id]/results — Get full results for a poll (admin auth required).
 * Query params:
 *   - includeTest=true: include only test responses (for test tab)
 * Admin always sees full details, non-anonymised.
 */
export const GET = withAdminAuth(async (request: Request, context: { params: { id: string } }) => {
  try {
    const { id } = context.params;
    const poll = await pollService.getPoll(id);

    if (!poll) {
      return notFoundError('Poll not found');
    }

    const url = new URL(request.url);
    const includeTest = url.searchParams.get('includeTest') === 'true';

    const results = await responseService.getResults(id, {
      includeTest,
      revealStage: 'DETAILS',
      anonymise: false,
    });

    return NextResponse.json(results);
  } catch (error) {
    return internalError();
  }
});
