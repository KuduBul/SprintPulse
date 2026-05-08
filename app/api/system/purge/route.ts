import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { retentionService } from '@/lib/services';
import { internalError } from '@/lib/api/errors';

/**
 * POST /api/system/purge — Purge old data (auth required).
 * Purges old responses, audit logs, and soft-deleted polls based on retention thresholds.
 */
export const POST = withAuth(async () => {
  try {
    const result = await retentionService.purge();
    return NextResponse.json(result);
  } catch (error) {
    return internalError();
  }
});
