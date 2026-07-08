import { NextResponse } from 'next/server';
import { retroService } from '@/lib/services/retroService';
import { isRetroEnabled } from '@/lib/featureFlags';
import { withAuth } from '@/middleware/authGuard';
import {
  notFoundError,
  internalError,
} from '@/lib/api/errors';

// Force dynamic rendering — these routes hit the database on every request.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * PATCH /api/retro/[boardId]/action-items/[itemId] — Update an action item.
 *
 * Body: { text?: string, owner?: string | null, dueDate?: string | null }
 *
 * Facilitator-only (authenticated via withAuth).
 * Returns the updated action item on success.
 * Returns 400 VALIDATION_ERROR for invalid input (text too long, etc.).
 * Returns 404 when RETRO_ENABLED is false or item not found.
 *
 * Requirements: 7.6
 */
export const PATCH = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string; itemId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { itemId } = context.params!;
    const body = await request.json();

    const actionItem = await retroService.updateActionItem(itemId, {
      text: body.text,
      owner: body.owner,
      dueDate: body.dueDate,
    });

    return NextResponse.json(actionItem);
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

/**
 * DELETE /api/retro/[boardId]/action-items/[itemId] — Delete an action item.
 *
 * Facilitator-only (authenticated via withAuth).
 * Returns 204 on success.
 * Returns 404 when RETRO_ENABLED is false or item not found.
 *
 * Requirements: 7.6
 */
export const DELETE = withAuth(async (_request: Request, context: { userId: string; params?: { boardId: string; itemId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { itemId } = context.params!;
    await retroService.deleteActionItem(itemId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    return internalError();
  }
});
