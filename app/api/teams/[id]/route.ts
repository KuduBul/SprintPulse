import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { teamService } from '@/lib/services';
import { UpdateTeamSchema } from '@/lib/validators/schemas';
import { validationError, notFoundError, internalError, formatZodError } from '@/lib/api/errors';

/**
 * GET /api/teams/[id] — Get a single team by ID (auth required, ownership enforced).
 */
export const GET = withAuth(async (_request: Request, context: { userId: string; params?: { id: string } }) => {
  try {
    const { id } = context.params!;
    const team = await teamService.getTeam(id, context.userId);

    if (!team) {
      return notFoundError('Team not found');
    }

    return NextResponse.json(team);
  } catch (error) {
    return internalError();
  }
});

/**
 * PUT /api/teams/[id] — Rename a team (auth required, ownership enforced).
 * Body: { name: string }
 */
export const PUT = withAuth(async (request: Request, context: { userId: string; params?: { id: string } }) => {
  try {
    const { id } = context.params!;
    const body = await request.json();
    const result = UpdateTeamSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const team = await teamService.updateTeam(id, result.data.name, context.userId);
    if (!team) {
      return notFoundError('Team not found');
    }

    return NextResponse.json(team);
  } catch (error) {
    return internalError();
  }
});

/**
 * DELETE /api/teams/[id] — Soft-delete a team (auth required, ownership enforced).
 */
export const DELETE = withAuth(async (_request: Request, context: { userId: string; params?: { id: string } }) => {
  try {
    const { id } = context.params!;
    const deleted = await teamService.deleteTeam(id, context.userId);

    if (!deleted) {
      return notFoundError('Team not found');
    }

    return NextResponse.json({ message: 'Team deleted' });
  } catch (error) {
    return internalError();
  }
});
