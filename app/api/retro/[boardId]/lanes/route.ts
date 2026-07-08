import { NextResponse } from 'next/server';
import { retroService } from '@/lib/services/retroService';
import { isRetroEnabled } from '@/lib/featureFlags';
import { withAuth } from '@/middleware/authGuard';
import {
  notFoundError,
  internalError,
  validationError,
} from '@/lib/api/errors';

// Force dynamic rendering — these routes hit the database on every request.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/retro/[boardId]/lanes — Add a new lane to the board.
 *
 * Body: { title: string, icon?: string, color?: string }
 *
 * Facilitator-only (authenticated via withAuth).
 * Returns 201 with the created lane on success.
 * Returns 400 LANE_LIMIT_EXCEEDED if the board already has 8 lanes.
 * Returns 404 when RETRO_ENABLED is false (feature invisible).
 *
 * Requirements: 6.1, 6.2
 */
export const POST = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { boardId } = context.params!;
    const body = await request.json();

    // Basic validation — title is required
    if (!body.title || typeof body.title !== 'string') {
      return validationError([{ path: ['title'], message: 'Title is required' }]);
    }

    const lane = await retroService.addLane(boardId, {
      title: body.title,
      icon: body.icon,
      color: body.color,
    });

    return NextResponse.json(lane, { status: 201 });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    if (err.code === 'LANE_LIMIT_EXCEEDED') {
      return NextResponse.json(
        { error: { code: 'LANE_LIMIT_EXCEEDED', message: err.message } },
        { status: 400 }
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

/**
 * PATCH /api/retro/[boardId]/lanes — Reorder lanes on the board.
 *
 * Body: { laneIds: string[] }
 *
 * Facilitator-only (authenticated via withAuth).
 * Returns 204 on success.
 * Returns 400 for validation errors (incomplete lane set, unknown IDs).
 * Returns 404 when RETRO_ENABLED is false (feature invisible).
 *
 * Requirements: 6.6
 */
export const PATCH = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { boardId } = context.params!;
    const body = await request.json();

    // Basic validation — laneIds array is required
    if (!body.laneIds || !Array.isArray(body.laneIds)) {
      return validationError([{ path: ['laneIds'], message: 'laneIds must be an array of lane IDs' }]);
    }

    await retroService.reorderLanes(boardId, { laneIds: body.laneIds });
    return new NextResponse(null, { status: 204 });
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
