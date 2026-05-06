import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/middleware/adminAuth';
import { pollService, responseService } from '@/lib/services';
import { notFoundError, internalError } from '@/lib/api/errors';

/**
 * POST /api/polls/[id]/reset — Reset responses for a poll (admin auth required).
 * Query param: ?testOnly=true to clear only test-flagged responses.
 * Without testOnly, deletes all responses associated with the poll.
 */
export const POST = withAdminAuth(async (request: Request, context: { params: { id: string } }) => {
  try {
    const { id } = context.params;
    const existing = await pollService.getPoll(id);

    if (!existing) {
      return notFoundError('Poll not found');
    }

    const url = new URL(request.url);
    const testOnly = url.searchParams.get('testOnly') === 'true';

    if (testOnly) {
      await responseService.clearTestResponses(id);
      return NextResponse.json({ message: 'Test responses cleared' });
    }

    await pollService.resetResponses(id);
    return NextResponse.json({ message: 'Responses reset' });
  } catch (error) {
    return internalError();
  }
});
