import { NextResponse } from 'next/server';
import { retentionService } from '@/lib/services';
import { internalError } from '@/lib/api/errors';

/**
 * POST /api/system/purge — Triggered by Vercel Cron (daily at 02:00 UTC).
 * Purges old responses, audit logs, and soft-deleted polls based on retention thresholds.
 * No admin auth required — Vercel Cron uses its own authentication mechanism.
 */
export async function POST() {
  try {
    const result = await retentionService.purge();
    return NextResponse.json(result);
  } catch (error) {
    return internalError();
  }
}
