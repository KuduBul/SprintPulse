import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { pollService, teamService } from '@/lib/services';
import { CreatePollSchema } from '@/lib/validators/schemas';
import { validationError, internalError, formatZodError } from '@/lib/api/errors';

/**
 * GET /api/polls — List all non-deleted polls for the authenticated user.
 */
export const GET = withAuth(async (_request: Request, context: { userId: string }) => {
  try {
    const polls = await pollService.listPolls(context.userId);
    return NextResponse.json(polls);
  } catch (error) {
    return internalError();
  }
});

/**
 * POST /api/polls — Create a new poll (auth required).
 * Body: { title: string, description?: string, teamId: string }
 */
export const POST = withAuth(async (request: Request, context: { userId: string }) => {
  try {
    const body = await request.json();
    const result = CreatePollSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    // Validate team exists and is owned by the user (if teamId provided)
    if (result.data.teamId) {
      const team = await teamService.getTeam(result.data.teamId, context.userId);
      if (!team) {
        return NextResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'Cannot assign to a team you do not own',
            },
          },
          { status: 403 }
        );
      }
    }

    const poll = await pollService.createPoll(result.data, context.userId);
    return NextResponse.json(poll, { status: 201 });
  } catch (error) {
    return internalError();
  }
});
