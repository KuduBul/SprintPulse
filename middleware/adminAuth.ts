import { NextResponse } from 'next/server';

/**
 * Route handler type for Next.js App Router.
 * Handlers receive a Request and optional context (e.g. route params)
 * and return a Promise<Response>.
 */
type RouteHandler = (request: Request, context?: any) => Promise<Response>;

/**
 * Higher-order function that wraps a route handler with admin token validation.
 *
 * Validates the `x-admin-token` header against the `ADMIN_SECRET` environment variable.
 * Returns 401 Unauthorized if the token is missing or invalid.
 *
 * @param handler - The route handler to protect
 * @returns A wrapped route handler that enforces admin authentication
 */
export function withAdminAuth(handler: RouteHandler): RouteHandler {
  return async (request: Request, context?: any): Promise<Response> => {
    const token = request.headers.get('x-admin-token');
    const secret = process.env.ADMIN_SECRET;

    if (!secret) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Server misconfiguration: admin secret not set',
          },
        },
        { status: 401 }
      );
    }

    if (!token || token !== secret) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or missing admin token',
          },
        },
        { status: 401 }
      );
    }

    return handler(request, context);
  };
}
