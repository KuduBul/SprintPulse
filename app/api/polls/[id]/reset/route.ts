import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { pollService, responseService } from '@/lib/services';
import { notFoundError, internalError } from '@/lib/api/errors';

/**
 * POST /api/polls/[id]/reset — Reset responses for a poll (auth required, ownership enforced).
 * Query param: ?testOnly=true to clear only test-flagged responses.
 * Without testOnly, deletes all responses associated with the poll.
 */
export const POST = withAuth(async (request: Request, context: { userId: string; params?: { id: string } }) => {
  try {
    const { id } = context.params!;
    const existing = await pollService.getPoll(id, context.userId);

    if (!existing) {
      return notFoundError('Poll not found');
    }

    const url = new URL(request.url);
    const testOnly = url.searchParams.get('testOnly') === 'true';

    if (testOnly) {
      await responseService.clearTestResponses(id);
      return NextResponse.json({ message: 'Test responses cleared' });
    }

    await pollService.resetResponses(id, context.userId);
    return NextResponse.json({ message: 'Responses reset' });
  } catch (error) {
    return internalError();
  }
});
