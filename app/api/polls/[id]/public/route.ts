import { NextResponse } from 'next/server';
import { pollService } from '@/lib/services';
import { notFoundError, internalError } from '@/lib/api/errors';

/**
 * GET /api/polls/[id]/public — Get public poll data for participants.
 * No admin auth required. Respects soft-delete (returns 404 for deleted polls).
 */
export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    const { id } = context.params;
    const poll = await pollService.getPublicPoll(id);

    if (!poll) {
      return notFoundError('Poll not found');
    }

    return NextResponse.json(poll);
  } catch (error) {
    return internalError();
  }
}
