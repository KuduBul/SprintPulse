import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { questionService, pollService } from '@/lib/services';
import { CreateQuestionSchema } from '@/lib/validators/schemas';
import { validationError, notFoundError, internalError, formatZodError } from '@/lib/api/errors';

/**
 * GET /api/polls/[id]/questions — List all questions for a poll (auth required, ownership enforced).
 */
export const GET = withAuth(async (_request: Request, context: { userId: string; params?: { id: string } }) => {
  try {
    const { id } = context.params!;
    const poll = await pollService.getPoll(id, context.userId);

    if (!poll) {
      return notFoundError('Poll not found');
    }

    // Use getPublicPoll to get questions (it doesn't require userId)
    const publicPoll = await pollService.getPublicPoll(id);
    if (!publicPoll) {
      return notFoundError('Poll not found');
    }

    return NextResponse.json(publicPoll.questions);
  } catch (error) {
    return internalError();
  }
});

/**
 * POST /api/polls/[id]/questions — Create a new question for a poll (auth required, ownership enforced).
 * Body: { text: string, options: string[], allowCustom?: boolean, position?: object|null, displayOrder: number }
 */
export const POST = withAuth(async (request: Request, context: { userId: string; params?: { id: string } }) => {
  try {
    const { id } = context.params!;

    // Verify the parent poll exists and belongs to user
    const poll = await pollService.getPoll(id, context.userId);
    if (!poll) {
      return notFoundError('Poll not found');
    }

    const body = await request.json();
    const result = CreateQuestionSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const question = await questionService.createQuestion(id, result.data, context.userId);
    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    return internalError();
  }
});
