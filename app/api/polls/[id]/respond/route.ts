import { NextResponse } from 'next/server';
import { withRateLimit } from '@/middleware/rateLimit';
import { responseService } from '@/lib/services';
import { SubmitResponsesSchema } from '@/lib/validators/schemas';
import {
  validationError,
  votingClosedError,
  conflictError,
  internalError,
  formatZodError,
} from '@/lib/api/errors';

/**
 * POST /api/polls/[id]/respond — Submit responses to a poll.
 * Rate limited. No admin auth required.
 * Returns 410 VOTING_CLOSED if voting is closed at submission time.
 * Returns 409 CONFLICT for duplicate session token submissions.
 */
export const POST = withRateLimit(async (request: Request, context?: any) => {
  try {
    const { id } = context.params;
    const body = await request.json();
    const result = SubmitResponsesSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    await responseService.submitResponses(id, result.data);

    return NextResponse.json({ message: 'Responses submitted' }, { status: 200 });
  } catch (error: any) {
    if (error?.code === 'VOTING_CLOSED') {
      return votingClosedError();
    }
    if (error?.code === 'CONFLICT') {
      return conflictError();
    }
    if (error?.code === 'VALIDATION_ERROR') {
      return validationError(error.message);
    }
    return internalError();
  }
});
