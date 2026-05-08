import { NextResponse } from 'next/server';
import { pollService } from '@/lib/services';
import { internalError } from '@/lib/api/errors';

/**
 * GET /api/polls/public — List all non-deleted polls (no auth required).
 * Returns minimal public-facing data for participants.
 */
export async function GET() {
  try {
    const polls = await pollService.listPublicPolls();

    // Return only public-facing fields
    const publicPolls = polls.map((poll: any) => ({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      votingOpen: poll.facilitatorState?.votingOpen ?? false,
    }));

    return NextResponse.json(publicPolls);
  } catch (error) {
    return internalError();
  }
}
