import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { teamService } from '@/lib/services';
import { CreateTeamSchema } from '@/lib/validators/schemas';
import { validationError, internalError, formatZodError } from '@/lib/api/errors';

/**
 * GET /api/teams — List all non-deleted teams for the authenticated user.
 */
export const GET = withAuth(async (_request: Request, context: { userId: string }) => {
  try {
    const teams = await teamService.listTeams(context.userId);
    return NextResponse.json(teams);
  } catch (error) {
    return internalError();
  }
});

/**
 * POST /api/teams — Create a new team (auth required).
 * Body: { name: string }
 */
export const POST = withAuth(async (request: Request, context: { userId: string }) => {
  try {
    const body = await request.json();
    const result = CreateTeamSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const team = await teamService.createTeam(result.data.name, context.userId);
    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    return internalError();
  }
});
