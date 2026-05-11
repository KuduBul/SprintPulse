import { NextResponse } from 'next/server';
import { teamService } from '@/lib/services';
import { ValidatePinSchema } from '@/lib/validators/schemas';
import { validationError, notFoundError, internalError, formatZodError } from '@/lib/api/errors';

/**
 * POST /api/teams/validate-pin — Validate a team PIN (no auth required).
 * Body: { pin: string }
 * Returns: { teamId: string, teamName: string } on success, 404 on failure.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = ValidatePinSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const team = await teamService.validatePin(result.data.pin);

    if (!team) {
      return notFoundError('PIN not recognized');
    }

    return NextResponse.json(team);
  } catch (error) {
    return internalError();
  }
}
