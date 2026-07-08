import { NextResponse } from 'next/server';
import { retroService } from '@/lib/services/retroService';
import { isRetroEnabled } from '@/lib/featureFlags';
import { withAuth } from '@/middleware/authGuard';
import {
  notFoundError,
  internalError,
  validationError,
  formatZodError,
} from '@/lib/api/errors';
import { RetroVoteSchema } from '@/lib/validators/schemas';

// Force dynamic rendering.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/retro/[boardId]/votes — Cast a vote on a card (vote phase only).
 *
 * Body: { cardId, voterToken }
 *
 * Phase guard: only permitted while board.phase === "vote" (HTTP 409 WRONG_PHASE).
 * Vote cap: rejects with HTTP 409 VOTE_CAP_EXCEEDED when the voter exceeds votesPerUser.
 * Uniqueness: a duplicate vote on the same card is treated as a no-op (idempotent).
 *
 * Returns 404 when RETRO_ENABLED is false (Requirement 1.2).
 */
export const POST = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { boardId } = context.params!;
    const body = await request.json();
    const result = RetroVoteSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const { cardId, voterToken } = result.data;
    await retroService.castVote(boardId, cardId, voterToken);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    if (err.code === 'WRONG_PHASE') {
      return NextResponse.json(
        { error: { code: 'WRONG_PHASE', message: err.message } },
        { status: 409 }
      );
    }
    if (err.code === 'VOTE_CAP_EXCEEDED') {
      return NextResponse.json(
        { error: { code: 'VOTE_CAP_EXCEEDED', message: err.message } },
        { status: 409 }
      );
    }
    return internalError();
  }
});

/**
 * DELETE /api/retro/[boardId]/votes — Remove a vote from a card (vote phase only).
 *
 * Body: { cardId, voterToken }
 *
 * Phase guard: only permitted while board.phase === "vote" (HTTP 409 WRONG_PHASE).
 * Removing an absent vote is a no-op (idempotent).
 *
 * Returns 404 when RETRO_ENABLED is false (Requirement 1.2).
 */
export const DELETE = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { boardId } = context.params!;
    const body = await request.json();
    const result = RetroVoteSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const { cardId, voterToken } = result.data;
    await retroService.removeVote(boardId, cardId, voterToken);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    if (err.code === 'WRONG_PHASE') {
      return NextResponse.json(
        { error: { code: 'WRONG_PHASE', message: err.message } },
        { status: 409 }
      );
    }
    return internalError();
  }
});
