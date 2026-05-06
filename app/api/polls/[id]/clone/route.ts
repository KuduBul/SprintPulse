import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/middleware/adminAuth';
import { pollService } from '@/lib/services';
import { notFoundError, internalError } from '@/lib/api/errors';

/**
 * POST /api/polls/[id]/clone — Clone a poll (admin auth required).
 * Creates a duplicate poll with "(Copy)" suffix, duplicates questions, zero responses.
 */
export const POST = withAdminAuth(async (request: Request, context: { params: { id: string } }) => {
  try {
    const { id } = context.params;
    const existing = await pollService.getPoll(id);

    if (!existing) {
      return notFoundError('Poll not found');
    }

    const cloned = await pollService.clonePoll(id);
    return NextResponse.json(cloned, { status: 201 });
  } catch (error) {
    return internalError();
  }
});
