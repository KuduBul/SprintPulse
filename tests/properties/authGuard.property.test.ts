import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { withAuth, type AuthenticatedHandler } from '../../middleware/authGuard';

/**
 * Feature: multi-tenant-facilitator-auth, Property 1: Unauthenticated requests are rejected
 *
 * For any HTTP request to a protected API route that does not carry a valid
 * Supabase Auth session cookie, the `withAuth` middleware SHALL return a
 * 401 Unauthorized response and never invoke the inner route handler.
 *
 * Validates: Requirements 3.3, 4.2, 4.3
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '../../lib/supabase/server';

const mockedCreateClient = vi.mocked(createClient);

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates random HTTP methods commonly used in API routes.
 */
const arbHttpMethod = fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE');

/**
 * Generates random URL paths for API routes.
 */
const arbUrlPath = fc.stringOf(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '/', '-', '_'
  ),
  { minLength: 1, maxLength: 50 }
);

/**
 * Generates random error messages that Supabase auth might return.
 */
const arbErrorMessage = fc.string({ minLength: 1, maxLength: 200 });

/**
 * Generates random error objects simulating various Supabase auth failures.
 */
const arbAuthError = fc.record({
  message: arbErrorMessage,
  status: fc.constantFrom(400, 401, 403, 422, 500),
});

/**
 * Generates random "unauthenticated" getUser responses — either null user
 * with no error, null user with an error, or undefined user.
 */
const arbUnauthenticatedResponse = fc.oneof(
  // No user, no error (missing session)
  fc.constant({ data: { user: null }, error: null }),
  // No user, with error (expired/malformed token)
  arbAuthError.map((error) => ({ data: { user: null }, error })),
  // Undefined user, no error
  fc.constant({ data: { user: undefined }, error: null }),
  // Error present even with user-like data (error takes precedence)
  fc.record({
    data: fc.record({ user: fc.constant(null) }),
    error: arbAuthError,
  })
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Feature: multi-tenant-facilitator-auth, Property 1: Unauthenticated requests are rejected', () => {
  let innerHandlerCalled: boolean;
  let mockHandler: AuthenticatedHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    innerHandlerCalled = false;
    mockHandler = vi.fn(async (_request: Request, _context: { userId: string; params?: any }) => {
      innerHandlerCalled = true;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as unknown as AuthenticatedHandler;
  });

  /**
   * **Validates: Requirements 3.3, 4.2, 4.3**
   *
   * For any random request (any method, any URL path) without a valid session,
   * withAuth SHALL always return 401 Unauthorized.
   */
  it('always returns 401 for any request without a valid session', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbHttpMethod,
        arbUrlPath,
        arbUnauthenticatedResponse,
        async (method, urlPath, authResponse) => {
          mockedCreateClient.mockResolvedValue({
            auth: {
              getUser: vi.fn().mockResolvedValue(authResponse),
            },
          } as any);

          const request = new Request(`http://localhost:3000/api/${urlPath}`, { method });
          const protectedHandler = withAuth(mockHandler);
          const response = await protectedHandler(request);

          expect(response.status).toBe(401);
          const body = await response.json();
          expect(body.error.code).toBe('UNAUTHORIZED');
          expect(body.error.message).toBe('Authentication required');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.3, 4.2, 4.3**
   *
   * For any random request without a valid session, the inner route handler
   * SHALL never be invoked.
   */
  it('never invokes the inner handler when session is invalid', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbHttpMethod,
        arbUrlPath,
        arbUnauthenticatedResponse,
        async (method, urlPath, authResponse) => {
          innerHandlerCalled = false;
          const spyHandler = vi.fn(async () => {
            innerHandlerCalled = true;
            return new Response('OK', { status: 200 });
          }) as unknown as AuthenticatedHandler;

          mockedCreateClient.mockResolvedValue({
            auth: {
              getUser: vi.fn().mockResolvedValue(authResponse),
            },
          } as any);

          const request = new Request(`http://localhost:3000/api/${urlPath}`, { method });
          const protectedHandler = withAuth(spyHandler);
          await protectedHandler(request);

          expect(spyHandler).not.toHaveBeenCalled();
          expect(innerHandlerCalled).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.2, 4.3**
   *
   * For any random user ID and display name passed as request context (params),
   * if the session is invalid, withAuth SHALL still return 401 and never
   * forward the context to the handler.
   */
  it('rejects requests with route params when session is invalid', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 100 }),
        arbUnauthenticatedResponse,
        async (pollId, displayName, authResponse) => {
          const spyHandler = vi.fn(async () => {
            return new Response('OK', { status: 200 });
          }) as unknown as AuthenticatedHandler;

          mockedCreateClient.mockResolvedValue({
            auth: {
              getUser: vi.fn().mockResolvedValue(authResponse),
            },
          } as any);

          const request = new Request(`http://localhost:3000/api/polls/${pollId}`, {
            method: 'GET',
          });
          const routeContext = { params: { id: pollId, name: displayName } };
          const protectedHandler = withAuth(spyHandler);
          const response = await protectedHandler(request, routeContext);

          expect(response.status).toBe(401);
          expect(spyHandler).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ─── Property 2 Tests ────────────────────────────────────────────────────────

/**
 * Feature: multi-tenant-facilitator-auth, Property 2: Authenticated requests receive correct user identity
 *
 * For any HTTP request to a protected API route that carries a valid Supabase Auth
 * session, the `withAuth` middleware SHALL extract the user ID from the session and
 * pass it to the route handler, such that the handler's `userId` parameter equals
 * the authenticated user's `auth.users.id`.
 *
 * Validates: Requirements 4.4
 */

describe('Feature: multi-tenant-facilitator-auth, Property 2: Authenticated requests receive correct user identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 4.4**
   *
   * For any random UUID returned by getUser, the handler always receives
   * that exact UUID as the userId parameter.
   */
  it('always passes the exact authenticated user ID to the handler', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        arbHttpMethod,
        arbUrlPath,
        async (userId, method, urlPath) => {
          // Mock getUser to return a valid user with the generated UUID
          mockedCreateClient.mockResolvedValue({
            auth: {
              getUser: vi.fn().mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
              }),
            },
          } as any);

          let receivedUserId: string | undefined;
          const captureHandler: AuthenticatedHandler = async (
            _request: Request,
            context: { userId: string; params?: any }
          ) => {
            receivedUserId = context.userId;
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
          };

          const request = new Request(`http://localhost:3000/api/${urlPath}`, { method });
          const protectedHandler = withAuth(captureHandler);
          const response = await protectedHandler(request);

          // Handler should be invoked (not rejected)
          expect(response.status).toBe(200);
          // The userId passed to the handler must exactly equal the UUID from getUser
          expect(receivedUserId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.4**
   *
   * For any random UUID, the handler receives the userId even when route
   * context params are provided — the userId is never overwritten by params.
   */
  it('preserves user identity when route params are present', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        async (userId, paramId) => {
          mockedCreateClient.mockResolvedValue({
            auth: {
              getUser: vi.fn().mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
              }),
            },
          } as any);

          let receivedUserId: string | undefined;
          const captureHandler: AuthenticatedHandler = async (
            _request: Request,
            context: { userId: string; params?: any }
          ) => {
            receivedUserId = context.userId;
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
          };

          const request = new Request(`http://localhost:3000/api/polls/${paramId}`, {
            method: 'GET',
          });
          const routeContext = { params: { id: paramId } };
          const protectedHandler = withAuth(captureHandler);
          const response = await protectedHandler(request, routeContext);

          expect(response.status).toBe(200);
          expect(receivedUserId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
