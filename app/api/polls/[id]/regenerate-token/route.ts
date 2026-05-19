import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { tokenService } from '@/lib/services';
import { notFoundError, internalError } from '@/lib/api/errors';

/**
 * POST /api/polls/[id]/regenerate-token — Regenerate the access token for a poll.
 * Requires authentication. Facilitator must own the poll.
 * Returns new accessToken and the full poll URL.
 * Returns 404 if poll not found or doesn't belong to user.
 */
export const POST = withAuth(async (_request: Request, context: { userId: string; params?: { id: string } }) => {
  try {
    const { id } = context.params!;

    const result = await tokenService.regenerateToken(id, context.userId);

    if (!result) {
      return notFoundError('Poll not found');
    }

    return NextResponse.json(
      {
        accessToken: result.accessToken,
        pollUrl: tokenService.buildPollUrl(result.accessToken),
      },
      { status: 200 }
    );
  } catch (error) {
    return internalError();
  }
});
