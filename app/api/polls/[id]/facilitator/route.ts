import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/middleware/adminAuth';
import { pollService, facilitatorService } from '@/lib/services';
import { FacilitatorStateSchema } from '@/lib/validators/schemas';
import { validationError, notFoundError, internalError, formatZodError } from '@/lib/api/errors';

/**
 * GET /api/polls/[id]/facilitator — Get the current facilitator state for a poll (admin auth required).
 */
export const GET = withAdminAuth(async (request: Request, context: { params: { id: string } }) => {
  try {
    const { id } = context.params;
    const poll = await pollService.getPoll(id);

    if (!poll) {
      return notFoundError('Poll not found');
    }

    const state = await facilitatorService.getState(id);
    return NextResponse.json(state);
  } catch (error) {
    return internalError();
  }
});

/**
 * PATCH /api/polls/[id]/facilitator — Apply a partial facilitator state update (admin auth required).
 * Body: { votingOpen?: boolean, liveResults?: boolean, anonymise?: boolean, revealStage?: 'HIDDEN' | 'COUNTS' | 'DETAILS' }
 */
export const PATCH = withAdminAuth(async (request: Request, context: { params: { id: string } }) => {
  try {
    const { id } = context.params;
    const body = await request.json();
    const result = FacilitatorStateSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const poll = await pollService.getPoll(id);
    if (!poll) {
      return notFoundError('Poll not found');
    }

    const updatedState = await facilitatorService.updateState(id, result.data);
    return NextResponse.json(updatedState);
  } catch (error) {
    return internalError();
  }
});
