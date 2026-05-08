import { NextResponse } from 'next/server';
import { pollService, responseService, facilitatorService } from '@/lib/services';
import { notFoundError, internalError } from '@/lib/api/errors';

/**
 * GET /api/polls/[id]/results/public — Get public results for a poll.
 * Respects the current facilitator state (reveal stage and anonymisation).
 * No admin auth required.
 */
export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    const { id } = context.params;
    const poll = await pollService.getPublicPoll(id);

    if (!poll) {
      return notFoundError('Poll not found');
    }

    const state = await facilitatorService.getState(id);

    const results = await responseService.getResults(id, {
      includeTest: false,
      revealStage: state.revealStage,
      anonymise: state.anonymise,
    });

    return NextResponse.json(results);
  } catch (error) {
    return internalError();
  }
}
