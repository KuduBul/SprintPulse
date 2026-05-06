import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/middleware/adminAuth';
import { pollService } from '@/lib/services';
import { UpdatePollSchema } from '@/lib/validators/schemas';
import { validationError, notFoundError, internalError, formatZodError } from '@/lib/api/errors';

/**
 * GET /api/polls/[id] — Get a single poll by ID (admin auth required).
 */
export const GET = withAdminAuth(async (request: Request, context: { params: { id: string } }) => {
  try {
    const { id } = context.params;
    const poll = await pollService.getPoll(id);

    if (!poll) {
      return notFoundError('Poll not found');
    }

    return NextResponse.json(poll);
  } catch (error) {
    return internalError();
  }
});

/**
 * PATCH /api/polls/[id] — Update a poll (admin auth required).
 * Body: { title?: string, description?: string, backgroundImageUrl?: string }
 */
export const PATCH = withAdminAuth(async (request: Request, context: { params: { id: string } }) => {
  try {
    const { id } = context.params;
    const body = await request.json();
    const result = UpdatePollSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const existing = await pollService.getPoll(id);
    if (!existing) {
      return notFoundError('Poll not found');
    }

    const poll = await pollService.updatePoll(id, result.data);
    return NextResponse.json(poll);
  } catch (error) {
    return internalError();
  }
});

/**
 * DELETE /api/polls/[id] — Soft-delete a poll (admin auth required).
 */
export const DELETE = withAdminAuth(async (request: Request, context: { params: { id: string } }) => {
  try {
    const { id } = context.params;
    const existing = await pollService.getPoll(id);

    if (!existing) {
      return notFoundError('Poll not found');
    }

    await pollService.deletePoll(id);
    return NextResponse.json({ message: 'Poll deleted' });
  } catch (error) {
    return internalError();
  }
});
