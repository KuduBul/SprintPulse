import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { pollService, teamService } from '@/lib/services';
import { retroService } from '@/lib/services/retroService';
import { CreatePollSchema } from '@/lib/validators/schemas';
import { validationError, internalError, notFoundError, formatZodError } from '@/lib/api/errors';
import { isRetroEnabled } from '@/lib/featureFlags';

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
 * POST /api/polls — Create a new poll or retro activity (auth required).
 * Body: { title, description?, teamId?, tokenExpiresAt?, type?, template?, lanes?, votesPerUser? }
 * When type is "retro", the flag must be enabled and a retro board is created alongside the poll.
 */
export const POST = withAuth(async (request: Request, context: { userId: string }) => {
  try {
    const body = await request.json();
    const result = CreatePollSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const { type = 'pulse', template, lanes, votesPerUser, ...pollData } = result.data;

    // Retro activities are feature-flagged — return 404 (not 403) so the feature
    // is invisible in production (Requirement 1.2).
    if (type === 'retro' && !isRetroEnabled()) {
      return notFoundError();
    }

    // Validate template is provided when type is "retro".
    if (type === 'retro' && !template) {
      return validationError([{ path: ['template'], message: 'template is required for retro activities' }]);
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

    // Create the poll shell with the activity type discriminator.
    const poll = await pollService.createPoll(
      { ...pollData, type },
      context.userId
    );

    // For retro activities, create the associated board and lanes.
    if (type === 'retro') {
      const board = await retroService.createBoard(poll.id, {
        template: template!,
        lanes,
        votesPerUser,
        createdBy: context.userId,
      });
      return NextResponse.json({ poll, board }, { status: 201 });
    }

    return NextResponse.json(poll, { status: 201 });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'VALIDATION_ERROR') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: err.message } },
        { status: 400 }
      );
    }
    return internalError();
  }
});
