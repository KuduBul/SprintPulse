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
import { RetroBoardQuerySchema } from '@/lib/validators/schemas';
import { prisma } from '@/lib/db/client';

// Force dynamic rendering — these routes hit the database on every request.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/retro/[boardId] — Fetch the board view.
 *
 * Returns the full board with anonymity applied per the viewer's role.
 * The boardId is the RetroBoard.id; the service looks up by pollId so we
 * resolve it here before delegating.
 *
 * Query params:
 *   role             "facilitator" | "participant" (default: "participant")
 *   participantToken  required when role is "participant" to identify card/vote ownership
 *
 * Any role may call this endpoint; auth is still enforced so the poll is not
 * publicly readable without a valid session (participant join flow happens via
 * the token route, which is separate).
 *
 * Returns 404 when RETRO_ENABLED is false so the feature is invisible in
 * production (Requirement 1.2).
 */
export const GET = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { boardId } = context.params!;

    // Resolve the boardId → pollId since getBoard takes the poll's id.
    const retroBoard = await prisma.retroBoard.findUnique({ where: { id: boardId } });
    if (!retroBoard) {
      return notFoundError('Retro board not found');
    }

    const url = new URL(request.url);
    const queryRaw = {
      role: url.searchParams.get('role') ?? 'participant',
      participantToken: url.searchParams.get('participantToken') ?? undefined,
    };

    const parseResult = RetroBoardQuerySchema.safeParse(queryRaw);
    if (!parseResult.success) {
      return validationError(formatZodError(parseResult.error));
    }

    const viewer = parseResult.data;
    const board = await retroService.getBoard(retroBoard.pollId, viewer);
    return NextResponse.json(board);
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    return internalError();
  }
});

/**
 * PATCH /api/retro/[boardId] — Update board-level settings (facilitator only).
 *
 * Body: { votesPerUser?: number }  (integer 1–20)
 *
 * Returns the updated board record. Returns 404 when RETRO_ENABLED is false,
 * 400 VALIDATION_ERROR for invalid values, and 404 when the board is not found.
 */
export const PATCH = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { boardId } = context.params!;
    const body = await request.json();

    const updated = await retroService.updateBoardSettings(boardId, {
      votesPerUser: body?.votesPerUser,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
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
