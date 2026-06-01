import { NextResponse } from 'next/server';
import { pollService } from '@/lib/services';
import { notFoundError, internalError } from '@/lib/api/errors';

// Force dynamic rendering — this route hits the database and must never be
// statically evaluated at build time.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/polls/[id]/public — Get public poll data for participants.
 * No admin auth required. Respects soft-delete (returns 404 for deleted polls).
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const poll = await pollService.getPublicPoll(id);

    if (!poll) {
      return notFoundError('Poll not found');
    }

    return NextResponse.json(poll);
  } catch (error) {
    return internalError();
  }
}
