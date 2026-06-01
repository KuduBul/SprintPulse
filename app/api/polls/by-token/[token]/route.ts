import { NextResponse } from 'next/server';
import { tokenService } from '@/lib/services';
import { AccessTokenParamSchema } from '@/lib/validators/schemas';
import {
  validationError,
  notFoundError,
  tokenExpiredError,
  internalError,
  formatZodError,
} from '@/lib/api/errors';
import { prisma } from '@/lib/db/client';

// Force dynamic rendering — this route hits the database and must never be
// statically evaluated at build time.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/polls/by-token/[token] — Validate token and return poll data for participants.
 * No authentication required.
 * Returns 404 if token not found or poll deleted, 410 if token expired.
 */
export async function GET(_request: Request, context: any) {
  try {
    const { token } = context.params;

    // Validate token format (min 32 chars, URL-safe characters)
    const parseResult = AccessTokenParamSchema.safeParse({ token });
    if (!parseResult.success) {
      return validationError(formatZodError(parseResult.error));
    }

    // Check if the token exists but is expired (to distinguish 404 vs 410)
    const poll = await prisma.poll.findUnique({
      where: { accessToken: token },
    });

    if (!poll || poll.isDeleted) {
      return notFoundError('Poll not found or link is invalid');
    }

    if (poll.tokenExpiresAt && new Date() > poll.tokenExpiresAt) {
      return tokenExpiredError();
    }

    // Token is valid — get full poll data via tokenService
    const validatedPoll = await tokenService.validateToken(token);

    if (!validatedPoll) {
      return notFoundError('Poll not found or link is invalid');
    }

    return NextResponse.json(validatedPoll, { status: 200 });
  } catch (error) {
    return internalError();
  }
}
