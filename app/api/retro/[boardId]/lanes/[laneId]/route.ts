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
 * PATCH /api/retro/[boardId]/lanes/[laneId] — Update a lane's title, icon, or color.
 *
 * Body: { title?: string, icon?: string | null, color?: string | null }
 *
 * Facilitator-only (authenticated via withAuth).
 * Returns the updated lane on success.
 * Returns 404 when RETRO_ENABLED is false or lane not found.
 *
 * Requirements: 6.3
 */
export const PATCH = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string; laneId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { laneId } = context.params!;
    const body = await request.json();

    const lane = await retroService.updateLane(laneId, {
      title: body.title,
      icon: body.icon,
      color: body.color,
    });

    return NextResponse.json(lane);
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
 * DELETE /api/retro/[boardId]/lanes/[laneId] — Delete a lane and its cards.
 *
 * Facilitator-only (authenticated via withAuth).
 * Returns 204 on success.
 * Returns 400 MIN_LANES_REQUIRED if attempting to delete the last lane.
 * Returns 404 when RETRO_ENABLED is false or lane not found.
 *
 * Requirements: 6.4, 6.5, 6.7
 */
export const DELETE = withAuth(async (_request: Request, context: { userId: string; params?: { boardId: string; laneId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { laneId } = context.params!;
    await retroService.deleteLane(laneId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    if (err.code === 'MIN_LANES_REQUIRED') {
      return NextResponse.json(
        { error: { code: 'MIN_LANES_REQUIRED', message: err.message } },
        { status: 400 }
      );
    }
    return internalError();
  }
});
