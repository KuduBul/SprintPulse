import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { pollService } from '@/lib/services';
import { notFoundError, internalError } from '@/lib/api/errors';

/**
 * POST /api/polls/[id]/clone — Clone a poll (auth required, ownership enforced).
 * Creates a duplicate poll with "(Copy)" suffix, duplicates questions, zero responses.
 */
export const POST = withAuth(async (_request: Request, context: { userId: string; params?: { id: string } }) => {
  try {
    const { id } = context.params!;
    const cloned = await pollService.clonePoll(id, context.userId);

    if (!cloned) {
      return notFoundError('Poll not found');
    }

    return NextResponse.json(cloned, { status: 201 });
  } catch (error) {
    return internalError();
  }
});
