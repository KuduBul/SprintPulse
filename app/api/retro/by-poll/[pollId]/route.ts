import { NextResponse } from 'next/server';
import { retroService } from '@/lib/services/retroService';
import { isRetroEnabled } from '@/lib/featureFlags';
import { notFoundError, internalError } from '@/lib/api/errors';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/retro/by-poll/[pollId] — Fetch retro board by poll ID (for participants).
 *
 * No auth required — participants access via poll token flow.
 * Returns the board view with anonymity applied per the viewer's role.
 *
 * Query params:
 *   role             "facilitator" | "participant" (default: "participant")
 *   participantToken  required when role is "participant"
 */
export async function GET(request: Request, context: any) {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { pollId } = await context.params;

    // Find the retro board for this poll
    const retroBoard = await prisma.retroBoard.findUnique({ where: { pollId } });
    if (!retroBoard) {
      return notFoundError('Retro board not found for this poll');
    }

    const url = new URL(request.url);
    const role = (url.searchParams.get('role') ?? 'participant') as 'facilitator' | 'participant';
    const participantToken = url.searchParams.get('participantToken') ?? undefined;

    const board = await retroService.getBoard(pollId, { role, participantToken });
    return NextResponse.json(board, {
      headers: {
        // Prevent browser/CDN caching so participants always get the current
        // phase. Without this, polling can keep serving a stale cached
        // response and the participant stays stuck on an old phase.
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    return internalError();
  }
}
