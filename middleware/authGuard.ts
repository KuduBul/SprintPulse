import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Route handler type for authenticated Next.js App Router handlers.
 * Receives the original Request and a context object containing the
 * authenticated user's ID and optional route params.
 */
export type AuthenticatedHandler = (
  request: Request,
  context: { userId: string; params?: any }
) => Promise<Response>;

/**
 * Higher-order function that wraps a route handler with Supabase Auth validation.
 *
 * Validates the session by calling `supabase.auth.getUser()` via the server client.
 * Returns 401 Unauthorized if no valid user session exists.
 * Passes the authenticated `userId` to the handler if the session is valid.
 *
 * @param handler - The route handler to protect
 * @returns A wrapped route handler that enforces Supabase Auth authentication
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: Request, context?: any): Promise<Response> => {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    return handler(request, { userId: user.id, ...context });
  };
}
