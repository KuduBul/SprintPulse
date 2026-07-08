import { NextResponse } from 'next/server';
import { retroService } from '@/lib/services/retroService';
import { isRetroEnabled } from '@/lib/featureFlags';
import { withAuth } from '@/middleware/authGuard';
import { notFoundError, internalError } from '@/lib/api/errors';

// Force dynamic rendering — these routes hit the database on every request.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/retro/[boardId]/export — Export the retro board data.
 *
 * Produces a structured export of lanes, cards, vote counts, and author names.
 * Supports JSON (default) and CSV formats via the `format` query parameter.
 *
 * Query params:
 *   format  "json" (default) | "csv"
 *
 * Returns 404 when RETRO_ENABLED is false so the feature is invisible in
 * production (Requirement 1.2).
 *
 * Requirements: 10.1, 10.2
 */
export const GET = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { boardId } = context.params!;

    const url = new URL(request.url);
    const formatParam = url.searchParams.get('format') ?? 'json';

    // Validate format parameter
    if (formatParam !== 'json' && formatParam !== 'csv') {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid format parameter. Must be "json" or "csv".',
          },
        },
        { status: 400 }
      );
    }

    const result = await retroService.exportBoard(boardId, formatParam);

    if (result.format === 'csv') {
      return new NextResponse(result.content, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="retro-export-${boardId}.csv"`,
        },
      });
    }

    // JSON format
    return new NextResponse(result.content, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="retro-export-${boardId}.json"`,
      },
    });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    return internalError();
  }
});
