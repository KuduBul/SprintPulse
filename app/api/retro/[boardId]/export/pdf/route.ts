import { NextResponse } from 'next/server';
import { retroService } from '@/lib/services/retroService';
import { isRetroEnabled } from '@/lib/featureFlags';
import { withAuth } from '@/middleware/authGuard';
import { notFoundError, internalError } from '@/lib/api/errors';

// Force dynamic rendering — these routes hit the database on every request.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/retro/[boardId]/export/pdf — Generate and download a styled PDF report.
 *
 * Facilitator-only (authenticated via withAuth).
 *
 * Query params:
 *   format  "pdf" (default) | "json"
 *
 * When format=pdf:
 *   Returns the PDF buffer with Content-Type: application/pdf and
 *   Content-Disposition: attachment headers for download.
 *
 * When format=json:
 *   Delegates to the existing exportBoard method for JSON output.
 *
 * Returns 404 when RETRO_ENABLED is false (feature invisible).
 * Returns 500 EXPORT_FAILED on generation errors.
 *
 * Requirements: 8.1, 8.7, 8.8
 */
export const GET = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { boardId } = context.params!;
    const url = new URL(request.url);
    const format = url.searchParams.get('format') ?? 'pdf';

    if (format === 'json') {
      // Delegate to the existing JSON export
      const result = await retroService.exportBoard(boardId, 'json');
      return new NextResponse(result.content, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="retro-export-${boardId}.json"`,
        },
      });
    }

    // Default: PDF export
    const pdfBuffer = await retroService.exportBoardPdf(boardId);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="retro-export-${boardId}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    if (err.code === 'EXPORT_FAILED') {
      return NextResponse.json(
        { error: { code: 'EXPORT_FAILED', message: err.message } },
        { status: 500 }
      );
    }
    return internalError();
  }
});
