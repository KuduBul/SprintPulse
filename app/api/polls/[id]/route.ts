import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { pollService } from '@/lib/services';
import { UpdatePollSchema } from '@/lib/validators/schemas';
import { validationError, notFoundError, internalError, formatZodError } from '@/lib/api/errors';

/**
 * GET /api/polls/[id] — Get a single poll by ID (auth required, ownership enforced).
 */
export const GET = withAuth(async (_request: Request, context: { userId: string; params?: { id: string } }) => {
  try {
    const { id } = context.params!;
    const poll = await pollService.getPoll(id, context.userId);

    if (!poll) {
      return notFoundError('Poll not found');
    }

    return NextResponse.json(poll);
  } catch (error) {
    return internalError();
  }
});

/**
 * PATCH /api/polls/[id] — Update a poll (auth required, ownership enforced).
 * Body: { title?: string, description?: string, backgroundImageUrl?: string }
 */
export const PATCH = withAuth(async (request: Request, context: { userId: string; params?: { id: string } }) => {
  try {
    const { id } = context.params!;
    const body = await request.json();
    const result = UpdatePollSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const poll = await pollService.updatePoll(id, result.data, context.userId);
    if (!poll) {
      return notFoundError('Poll not found');
    }

    return NextResponse.json(poll);
  } catch (error) {
    return internalError();
  }
});

/**
 * DELETE /api/polls/[id] — Soft-delete a poll (auth required, ownership enforced).
 */
export const DELETE = withAuth(async (_request: Request, context: { userId: string; params?: { id: string } }) => {
  try {
    const { id } = context.params!;
    const deleted = await pollService.deletePoll(id, context.userId);

    if (!deleted) {
      return notFoundError('Poll not found');
    }

    return NextResponse.json({ message: 'Poll deleted' });
  } catch (error) {
    return internalError();
  }
});
