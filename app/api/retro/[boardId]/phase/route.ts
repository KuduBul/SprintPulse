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
import { RetroPhaseSchema } from '@/lib/validators/schemas';

// Force dynamic rendering.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/retro/[boardId]/phase — Advance the board's phase (facilitator only).
 *
 * Body: { phase: "gather" | "vote" | "closed" }
 *
 * The facilitator (authenticated via withAuth) is the only caller allowed to
 * transition phases. The service enforces that the board can only advance
 * forward (gather → vote → closed), rejecting backward transitions with
 * INVALID_PHASE_TRANSITION.
 *
 * Returns 404 when RETRO_ENABLED is false (Requirement 1.2).
 * Returns 409 WRONG_PHASE / INVALID_PHASE_TRANSITION for invalid transitions.
 */
export const POST = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { boardId } = context.params!;
    const body = await request.json();
    const result = RetroPhaseSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const { phase } = result.data;
    const updated = await retroService.setPhase(boardId, phase);
    return NextResponse.json(updated);
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    if (err.code === 'INVALID_PHASE_TRANSITION') {
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
    return internalError();
  }
});
