import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/middleware/adminAuth';
import { questionService, pollService } from '@/lib/services';
import { UpdateQuestionSchema } from '@/lib/validators/schemas';
import { validationError, notFoundError, internalError, formatZodError } from '@/lib/api/errors';

/**
 * PATCH /api/polls/[id]/questions/[qId] — Update a question (admin auth required).
 * Body: { text?: string, options?: string[], allowCustom?: boolean, position?: object|null, displayOrder?: number }
 */
export const PATCH = withAdminAuth(async (request: Request, context: { params: { id: string; qId: string } }) => {
  try {
    const { id, qId } = context.params;

    // Verify the parent poll exists
    const poll = await pollService.getPoll(id);
    if (!poll) {
      return notFoundError('Poll not found');
    }

    const body = await request.json();
    const result = UpdateQuestionSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const question = await questionService.updateQuestion(qId, result.data);
    return NextResponse.json(question);
  } catch (error) {
    return internalError();
  }
});

/**
 * DELETE /api/polls/[id]/questions/[qId] — Delete a question (admin auth required).
 */
export const DELETE = withAdminAuth(async (request: Request, context: { params: { id: string; qId: string } }) => {
  try {
    const { id, qId } = context.params;

    // Verify the parent poll exists
    const poll = await pollService.getPoll(id);
    if (!poll) {
      return notFoundError('Poll not found');
    }

    await questionService.deleteQuestion(qId);
    return NextResponse.json({ message: 'Question deleted' });
  } catch (error) {
    return internalError();
  }
});
