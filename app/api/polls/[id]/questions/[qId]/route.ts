import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { questionService, pollService } from '@/lib/services';
import { UpdateQuestionSchema } from '@/lib/validators/schemas';
import { validationError, notFoundError, internalError, formatZodError } from '@/lib/api/errors';

/**
 * PATCH /api/polls/[id]/questions/[qId] — Update a question (auth required, ownership enforced).
 * Body: { text?: string, options?: string[], allowCustom?: boolean, position?: object|null, displayOrder?: number }
 */
export const PATCH = withAuth(async (request: Request, context: { userId: string; params?: { id: string; qId: string } }) => {
  try {
    const { id, qId } = context.params!;

    // Verify the parent poll exists and belongs to user
    const poll = await pollService.getPoll(id, context.userId);
    if (!poll) {
      return notFoundError('Poll not found');
    }

    const body = await request.json();
    const result = UpdateQuestionSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const question = await questionService.updateQuestion(qId, result.data, context.userId);
    return NextResponse.json(question);
  } catch (error) {
    return internalError();
  }
});

/**
 * DELETE /api/polls/[id]/questions/[qId] — Delete a question (auth required, ownership enforced).
 */
export const DELETE = withAuth(async (_request: Request, context: { userId: string; params?: { id: string; qId: string } }) => {
  try {
    const { id, qId } = context.params!;

    // Verify the parent poll exists and belongs to user
    const poll = await pollService.getPoll(id, context.userId);
    if (!poll) {
      return notFoundError('Poll not found');
    }

    await questionService.deleteQuestion(qId, context.userId);
    return NextResponse.json({ message: 'Question deleted' });
  } catch (error) {
    return internalError();
  }
});
