import { NextResponse } from 'next/server';
import { pollService } from '@/lib/services';
import { internalError } from '@/lib/api/errors';
import { prisma } from '@/lib/db/client';

// Force dynamic rendering — this route hits the database and must never be
// statically evaluated at build time.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/polls/public — List non-deleted polls (no auth required).
 * Accepts optional `teamId` query parameter.
 * If teamId provided: returns polls matching that team PLUS polls with teamId=null.
 * If no teamId: returns all non-deleted polls.
 *
 * For retro polls, the session is considered "open" when the board phase is
 * "gather" or "vote" (not "closed"). For pulse polls, it uses facilitatorState.votingOpen.
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

    // For retro polls, look up board phase to determine open/closed status
    const retroPollIds = polls
      .filter((p: any) => p.type === 'retro')
      .map((p: any) => p.id);

    const retroBoards = retroPollIds.length > 0
      ? await prisma.retroBoard.findMany({
          where: { pollId: { in: retroPollIds } },
          select: { pollId: true, phase: true },
        })
      : [];

    const retroPhaseMap = new Map(
      retroBoards.map((b) => [b.pollId, b.phase])
    );

    // Return only public-facing fields
    const publicPolls = polls.map((poll: any) => {
      const isRetro = poll.type === 'retro';
      let votingOpen: boolean;

      if (isRetro) {
        // Retro session is "open" when phase is gather or vote
        const phase = retroPhaseMap.get(poll.id) ?? 'closed';
        votingOpen = phase === 'gather' || phase === 'vote';
      } else {
        votingOpen = poll.facilitatorState?.votingOpen ?? false;
      }

      return {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        teamId: poll.teamId ?? null,
        type: poll.type ?? 'pulse',
        votingOpen,
      };
    });

    return NextResponse.json(publicPolls);
  } catch (error) {
    return internalError();
  }
}
