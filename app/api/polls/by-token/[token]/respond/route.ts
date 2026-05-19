import { NextResponse } from 'next/server';
import { withRateLimit } from '@/middleware/rateLimit';
import { responseService } from '@/lib/services';
import { AccessTokenParamSchema, SubmitResponsesSchema } from '@/lib/validators/schemas';
import {
  validationError,
  notFoundError,
  tokenExpiredError,
  votingClosedError,
  conflictError,
  internalError,
  formatZodError,
} from '@/lib/api/errors';
import { prisma } from '@/lib/db/client';

/**
 * POST /api/polls/by-token/[token]/respond — Submit responses via token-based access.
 * Rate limited. No authentication required.
 * Validates token first, then accepts response submission.
 * Returns 404 if token not found, 410 if expired or voting closed,
 * 409 for duplicate submissions, 400 for validation errors.
 */
export const POST = withRateLimit(async (request: Request, context?: any) => {
  try {
    const { token } = context.params;

    // Validate token format
    const tokenResult = AccessTokenParamSchema.safeParse({ token });
    if (!tokenResult.success) {
      return validationError(formatZodError(tokenResult.error));
    }

    // Check if the token exists but is expired (to distinguish 404 vs 410)
    const poll = await prisma.poll.findUnique({
      where: { accessToken: token },
    });

    if (!poll || poll.isDeleted) {
      return notFoundError('Poll not found or link is invalid');
    }

    if (poll.tokenExpiresAt && new Date() > poll.tokenExpiresAt) {
      return tokenExpiredError();
    }

    // Parse and validate request body
    const body = await request.json();
    const result = SubmitResponsesSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    // Submit responses using the poll ID from the validated token
    await responseService.submitResponses(poll.id, result.data);

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
