import { NextResponse } from 'next/server';
import { pollService } from '@/lib/services';
import { internalError } from '@/lib/api/errors';

/**
 * GET /api/polls/public — List non-deleted polls (no auth required).
 * Accepts optional `teamId` query parameter.
 * If teamId provided: returns polls matching that team PLUS polls with teamId=null.
 * If no teamId: returns all non-deleted polls.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    let polls;
    if (teamId) {
      polls = await pollService.listPublicPollsByTeam(teamId);
    } else {
      polls = await pollService.listPublicPolls();
    }

    // Return only public-facing fields
    const publicPolls = polls.map((poll: any) => ({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      teamId: poll.teamId ?? null,
      votingOpen: poll.facilitatorState?.votingOpen ?? false,
    }));

    return NextResponse.json(publicPolls);
  } catch (error) {
    return internalError();
  }
}
