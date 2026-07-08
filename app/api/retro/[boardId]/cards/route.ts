import { NextResponse } from 'next/server';
import { retroService } from '@/lib/services/retroService';
import { isRetroEnabled } from '@/lib/featureFlags';
import { withRateLimit } from '@/middleware/rateLimit';
import {
  notFoundError,
  internalError,
  validationError,
  forbiddenError,
  formatZodError,
} from '@/lib/api/errors';
import { AddRetroCardSchema } from '@/lib/validators/schemas';

// Force dynamic rendering.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/retro/[boardId]/cards — Add a card to a lane (gather phase only).
 *
 * Body: { laneId, authorToken, authorName, text }
 *
 * PARTICIPANT-FACING: participants are not authenticated facilitators — they
 * are identified by the `authorToken` (a per-board UUID from localStorage),
 * mirroring the pulse `/respond` flow. This route is therefore rate-limited
 * rather than auth-gated. Ownership of the card is bound to the authorToken;
 * edit/delete are validated against it in the service.
 *
 * Phase guard: only permitted while board.phase === "gather" — the service
 * enforces this and throws WRONG_PHASE otherwise (mapped to HTTP 409).
 *
 * Returns 404 when RETRO_ENABLED is false (Requirement 1.2).
 * Returns 409 WRONG_PHASE when not in gather phase (Requirement 5.6).
 * Returns 400 for validation errors (empty/over-length text, etc.).
 */
export const POST = withRateLimit(async (request: Request, context: { params?: { boardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { boardId } = context.params!;
    const body = await request.json();
    const result = AddRetroCardSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const card = await retroService.addCard(boardId, result.data);
    return NextResponse.json(card, { status: 201 });
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
    if (err.code === 'VALIDATION_ERROR') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: err.message } },
        { status: 400 }
      );
    }
    if (err.code === 'FORBIDDEN') {
      return forbiddenError(err.message);
    }
    return internalError();
  }
});
