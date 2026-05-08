import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { profileService } from '@/lib/services';
import { internalError, validationError } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/profile — Get the current user's profile (auth required).
 * Returns display name and email.
 */
export const GET = withAuth(async (_request: Request, context: { userId: string }) => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const profile = await profileService.getProfile(context.userId);

    return NextResponse.json({
      email: user?.email ?? null,
      displayName: profile?.displayName ?? user?.user_metadata?.display_name ?? 'Facilitator',
    });
  } catch (error) {
    return internalError();
  }
});

/**
 * PUT /api/profile — Update the current user's display name (auth required).
 * Body: { displayName: string }
 */
export const PUT = withAuth(async (request: Request, context: { userId: string }) => {
  try {
    const body = await request.json();
    const { displayName } = body;

    if (!displayName || typeof displayName !== 'string') {
      return validationError([{ path: ['displayName'], message: 'Display name is required' }]);
    }

    const trimmed = displayName.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      return validationError([{ path: ['displayName'], message: 'Display name must be between 1 and 100 characters' }]);
    }

    const profile = await profileService.updateProfile(context.userId, trimmed);

    if (!profile) {
      // Profile doesn't exist yet, create it
      const created = await profileService.createProfile(context.userId, trimmed);
      return NextResponse.json({
        displayName: created.displayName,
      });
    }

    return NextResponse.json({
      displayName: profile.displayName,
    });
  } catch (error) {
    return internalError();
  }
});
