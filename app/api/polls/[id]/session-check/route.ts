import { NextResponse } from 'next/server';
import { responseService } from '@/lib/services';
import { internalError } from '@/lib/api/errors';

/**
 * POST /api/polls/[id]/session-check — Check if a session token has already submitted.
 * No admin auth required. Used by participant page to verify local session is still valid
 * (e.g., after a facilitator resets responses).
 * Body: { sessionToken: string }
 * Returns: { submitted: boolean }
 */
export async function POST(request: Request, context: { params: { id: string } }) {
  try {
    const { id } = context.params;
    const body = await request.json();
    const sessionToken = body?.sessionToken;

    if (!sessionToken || typeof sessionToken !== 'string') {
      return NextResponse.json({ submitted: false });
    }

    const submitted = await responseService.hasSubmitted(id, sessionToken);
    return NextResponse.json({ submitted });
  } catch (error) {
    return internalError();
  }
}
