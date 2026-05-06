import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/middleware/adminAuth';
import { pollService } from '@/lib/services';
import { CreatePollSchema } from '@/lib/validators/schemas';
import { validationError, internalError, formatZodError } from '@/lib/api/errors';

/**
 * GET /api/polls — List all non-deleted polls (admin auth required).
 */
export const GET = withAdminAuth(async () => {
  try {
    const polls = await pollService.listPolls();
    return NextResponse.json(polls);
  } catch (error) {
    return internalError();
  }
});

/**
 * POST /api/polls — Create a new poll (admin auth required).
 * Body: { title: string, description?: string }
 */
export const POST = withAdminAuth(async (request: Request) => {
  try {
    const body = await request.json();
    const result = CreatePollSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const poll = await pollService.createPoll(result.data);
    return NextResponse.json(poll, { status: 201 });
  } catch (error) {
    return internalError();
  }
});
