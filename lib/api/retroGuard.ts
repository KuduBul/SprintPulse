import { NextResponse } from 'next/server';
import { notFoundError, type ApiError } from '@/lib/api/errors';
import { isRetroEnabled } from '@/lib/featureFlags';

/**
 * Server-side guard for all retro API routes.
 *
 * When the `NEXT_PUBLIC_RETRO_ENABLED` flag is off (the default, and always the
 * case in production), retro routes must respond *as if they do not exist* —
 * HTTP 404, NOT 403. A 403 would reveal the feature's existence; a 404 keeps it
 * invisible (Requirement 1.2, design "Error Handling").
 *
 * Usage — short-circuit at the top of a retro route handler:
 *
 * ```ts
 * export async function GET(request: Request) {
 *   const blocked = retroFlagGuard();
 *   if (blocked) return blocked; // 404 when the flag is off
 *   // ...normal retro logic when enabled...
 * }
 * ```
 *
 * @returns A 404 {@link NextResponse} when retro is disabled, otherwise `null`
 *          to signal the caller may proceed.
 */
export function retroFlagGuard(): NextResponse<ApiError> | null {
  if (!isRetroEnabled()) {
    // Use the shared notFoundError helper so the body shape matches every
    // other 404 in the API surface — indistinguishable from a real missing
    // route.
    return notFoundError('Resource not found');
  }
  return null;
}

/**
 * Higher-order wrapper that gates an entire route handler behind the retro flag.
 *
 * Composes around any handler (including one already wrapped by `withAuth`),
 * returning 404 before the handler runs whenever retro is disabled.
 *
 * ```ts
 * export const POST = withRetroFlag(
 *   withAuth(async (request, context) => { ... })
 * );
 * ```
 *
 * @param handler - The route handler to protect.
 * @returns A wrapped handler that 404s when the flag is off.
 */
export function withRetroFlag<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response> | Response
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs): Promise<Response> => {
    const blocked = retroFlagGuard();
    if (blocked) return blocked;
    return handler(...args);
  };
}
