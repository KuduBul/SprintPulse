import { NextResponse } from 'next/server';
import { retroService } from '@/lib/services/retroService';
import { isRetroEnabled } from '@/lib/featureFlags';
import { withAuth } from '@/middleware/authGuard';
import {
  notFoundError,
  internalError,
  validationError,
} from '@/lib/api/errors';
import { prisma } from '@/lib/db/client';

// Force dynamic rendering — these routes hit the database on every request.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/retro/[boardId]/action-items — List action items for a board.
 *
 * Access rules:
 *  - Facilitator (authenticated via withAuth): always allowed
 *  - Participants: only visible during the "closed" phase (Requirement 7.5)
 *
 * Query params:
 *   role  "facilitator" | "participant" (default: "facilitator")
 *
 * Returns 404 when RETRO_ENABLED is false (feature invisible).
 * Returns 409 WRONG_PHASE if a participant requests action items outside closed phase.
 *
 * Requirements: 7.4, 7.5
 */
export const GET = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { boardId } = context.params!;

    // Check if the board exists
    const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
    if (!board) {
      return notFoundError('Retro board not found');
    }

    // Determine role from query parameters
    const url = new URL(request.url);
    const role = url.searchParams.get('role') ?? 'facilitator';

    // Participants can only see action items in the closed phase
    if (role === 'participant' && board.phase !== 'closed') {
      return NextResponse.json(
        { error: { code: 'WRONG_PHASE', message: 'Action items are only visible to participants in the closed phase' } },
        { status: 409 }
      );
    }

    const items = await retroService.getActionItems(boardId);
    return NextResponse.json(items);
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    return internalError();
  }
});

/**
 * POST /api/retro/[boardId]/action-items — Create an action item.
 *
 * Body: { text: string, owner?: string, dueDate?: string }
 *
 * Facilitator-only (authenticated via withAuth).
 * Phase guard: only allowed during "vote" or "closed" phases — the service
 * enforces this and throws WRONG_PHASE otherwise (HTTP 409).
 *
 * Returns 201 with the created action item on success.
 * Returns 409 WRONG_PHASE if board is in gather phase.
 * Returns 400 VALIDATION_ERROR for invalid input.
 * Returns 404 when RETRO_ENABLED is false.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export const POST = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { boardId } = context.params!;
    const body = await request.json();

    // Basic validation — text is required
    if (!body.text || typeof body.text !== 'string') {
      return validationError([{ path: ['text'], message: 'Text is required' }]);
    }

    const actionItem = await retroService.addActionItem(boardId, {
      text: body.text,
      owner: body.owner,
      dueDate: body.dueDate,
    });

    return NextResponse.json(actionItem, { status: 201 });
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
    return internalError();
  }
});
