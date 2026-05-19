import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { withAuth } from '../../middleware/authGuard';

/**
 * Feature: shoprite-x-polling-app
 * Property 28: Admin auth rejects invalid tokens
 * Property 29: Admin auth accepts valid tokens
 *
 * Validates: Requirements 10.1, 10.2, 10.3
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock the Supabase server client
vi.mock('../../lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '../../lib/supabase/server';

const mockedCreateClient = vi.mocked(createClient);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates a minimal Request object for testing.
 */
function createMockRequest(url = 'http://localhost:3000/api/polls'): Request {
  return new Request(url, { method: 'GET' });
}

/**
 * A dummy handler that returns 200 with a success message.
 * Used to verify that the middleware passes through to the handler.
 */
const successHandler = async (_request: Request, context: { userId: string; params?: any }) => {
  return new Response(JSON.stringify({ success: true, userId: context.userId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// ─── Property 28: Admin auth rejects invalid tokens ──────────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 28: Admin auth rejects invalid tokens
 *
 * For any request to an admin API route where the authentication is missing or
 * invalid (no valid user session), the system SHALL respond with 401 Unauthorized.
 *
 * **Validates: Requirements 10.1, 10.3**
 */
describe('Property 28: Admin auth rejects invalid tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 10.1, 10.3**
   * For any request where getUser returns an error, the middleware SHALL
   * respond with 401 Unauthorized.
   */
  it('rejects requests when Supabase auth returns an error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (errorMessage) => {
          mockedCreateClient.mockResolvedValue({
            auth: {
              getUser: vi.fn().mockResolvedValue({
                data: { user: null },
                error: { message: errorMessage },
              }),
            },
          } as any);

          const protectedHandler = withAuth(successHandler);
          const request = createMockRequest();
          const response = await protectedHandler(request);

          expect(response.status).toBe(401);
          const body = await response.json();
          expect(body.error.code).toBe('UNAUTHORIZED');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 10.1, 10.3**
   * For any request where getUser returns null user (no session), the middleware
   * SHALL respond with 401 Unauthorized.
   */
  it('rejects requests when no user session exists (user is null)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 200 }),
        async (urlPath) => {
          mockedCreateClient.mockResolvedValue({
            auth: {
              getUser: vi.fn().mockResolvedValue({
                data: { user: null },
                error: null,
              }),
            },
          } as any);

          const protectedHandler = withAuth(successHandler);
          const request = createMockRequest(`http://localhost:3000/api/${urlPath}`);
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
   * **Validates: Requirements 10.1, 10.3**
   * For any request where getUser returns both an error and null user,
   * the middleware SHALL respond with 401 Unauthorized.
   */
  it('rejects requests when both error and null user are returned', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          message: fc.string({ minLength: 1, maxLength: 100 }),
          status: fc.constantFrom(400, 401, 403, 500),
        }),
        async (errorObj) => {
          mockedCreateClient.mockResolvedValue({
            auth: {
              getUser: vi.fn().mockResolvedValue({
                data: { user: null },
                error: errorObj,
              }),
            },
          } as any);

          const protectedHandler = withAuth(successHandler);
          const request = createMockRequest();
          const response = await protectedHandler(request);

          expect(response.status).toBe(401);
          const body = await response.json();
          expect(body.error.code).toBe('UNAUTHORIZED');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 10.1, 10.3**
   * For any request where getUser returns undefined user, the middleware
   * SHALL respond with 401 Unauthorized.
   */
  it('rejects requests when user is undefined', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(undefined),
        async () => {
          mockedCreateClient.mockResolvedValue({
            auth: {
              getUser: vi.fn().mockResolvedValue({
                data: { user: undefined },
                error: null,
              }),
            },
          } as any);

          const protectedHandler = withAuth(successHandler);
          const request = createMockRequest();
          const response = await protectedHandler(request);

          expect(response.status).toBe(401);
          const body = await response.json();
          expect(body.error.code).toBe('UNAUTHORIZED');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 29: Admin auth accepts valid tokens ────────────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 29: Admin auth accepts valid tokens
 *
 * For any request to an admin API route where the authentication is valid
 * (valid user session exists), the system SHALL not respond with 401.
 *
 * **Validates: Requirements 10.2**
 */
describe('Property 29: Admin auth accepts valid tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 10.2**
   * For any request with a valid user session (any valid UUID user ID),
   * the middleware SHALL pass through to the handler and NOT respond with 401.
   */
  it('allows requests when a valid user session exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (userId) => {
          mockedCreateClient.mockResolvedValue({
            auth: {
              getUser: vi.fn().mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
              }),
            },
          } as any);

          const protectedHandler = withAuth(successHandler);
          const request = createMockRequest();
          const response = await protectedHandler(request);

          expect(response.status).not.toBe(401);
          expect(response.status).toBe(200);
          const body = await response.json();
          expect(body.success).toBe(true);
          expect(body.userId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 10.2**
   * For any valid user session, the middleware SHALL pass the userId to the handler.
   */
  it('passes the authenticated userId to the handler', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (userId, email) => {
          mockedCreateClient.mockResolvedValue({
            auth: {
              getUser: vi.fn().mockResolvedValue({
                data: { user: { id: userId, email } },
                error: null,
              }),
            },
          } as any);

          let capturedUserId: string | undefined;
          const capturingHandler = async (_request: Request, context: { userId: string }) => {
            capturedUserId = context.userId;
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
          };

          const protectedHandler = withAuth(capturingHandler);
          const request = createMockRequest();
          await protectedHandler(request);

          expect(capturedUserId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 10.2**
   * For any valid user session with additional user metadata, the middleware
   * SHALL still allow the request through without 401.
   */
  it('accepts valid sessions regardless of user metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.string({ minLength: 0, maxLength: 50 }),
        async (userId, email, displayName) => {
          mockedCreateClient.mockResolvedValue({
            auth: {
              getUser: vi.fn().mockResolvedValue({
                data: {
                  user: {
                    id: userId,
                    email,
                    user_metadata: { display_name: displayName },
                  },
                },
                error: null,
              }),
            },
          } as any);

          const protectedHandler = withAuth(successHandler);
          const request = createMockRequest();
          const response = await protectedHandler(request);

          expect(response.status).not.toBe(401);
          expect(response.status).toBe(200);
        }
      ),
      { numRuns: 100 }
    );
  });
});
