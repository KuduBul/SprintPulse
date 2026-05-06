import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/middleware/adminAuth';
import { questionService, pollService } from '@/lib/services';
import { CreateQuestionSchema } from '@/lib/validators/schemas';
import { validationError, notFoundError, internalError, formatZodError } from '@/lib/api/errors';

/**
 * GET /api/polls/[id]/questions — List all questions for a poll (admin auth required).
 */
export const GET = withAdminAuth(async (request: Request, context: { params: { id: string } }) => {
  try {
    const { id } = context.params;
    const poll = await pollService.getPublicPoll(id);

    if (!poll) {
      return notFoundError('Poll not found');
    }

    return NextResponse.json(poll.questions);
  } catch (error) {
    return internalError();
  }
});

/**
 * POST /api/polls/[id]/questions — Create a new question for a poll (admin auth required).
 * Body: { text: string, options: string[], allowCustom?: boolean, position?: object|null, displayOrder: number }
 */
export const POST = withAdminAuth(async (request: Request, context: { params: { id: string } }) => {
  try {
    const { id } = context.params;

    // Verify the parent poll exists
    const poll = await pollService.getPoll(id);
    if (!poll) {
      return notFoundError('Poll not found');
    }

    const body = await request.json();
    const result = CreateQuestionSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const question = await questionService.createQuestion(id, result.data);
    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    return internalError();
  }
});
