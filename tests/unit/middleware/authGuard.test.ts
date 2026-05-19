import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the server Supabase client
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

import { withAuth, type AuthenticatedHandler } from '@/middleware/authGuard';

describe('middleware/authGuard - withAuth', () => {
  let mockHandler: ReturnType<typeof vi.fn>;
  let mockRequest: Request;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    mockRequest = new Request('http://localhost/api/polls', { method: 'GET' });
  });

  describe('returns 401 when no session', () => {
    it('returns 401 when getUser returns null user and no error', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const wrappedHandler = withAuth(mockHandler as AuthenticatedHandler);
      const response = await wrappedHandler(mockRequest);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Authentication required');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('does not invoke the inner handler when user is null', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const wrappedHandler = withAuth(mockHandler as AuthenticatedHandler);
      await wrappedHandler(mockRequest);

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('returns 401 when getUser returns error', () => {
    it('returns 401 when getUser returns an auth error', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token', status: 401 },
      });

      const wrappedHandler = withAuth(mockHandler as AuthenticatedHandler);
      const response = await wrappedHandler(mockRequest);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Authentication required');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('returns 401 when getUser returns error even with a user object', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'some-user-id' } },
        error: { message: 'Token expired', status: 401 },
      });

      const wrappedHandler = withAuth(mockHandler as AuthenticatedHandler);
      const response = await wrappedHandler(mockRequest);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('passes userId to handler when valid session', () => {
    it('calls the handler with the correct userId from the authenticated user', async () => {
      const testUserId = '550e8400-e29b-41d4-a716-446655440000';
      mockGetUser.mockResolvedValue({
        data: { user: { id: testUserId } },
        error: null,
      });

      const wrappedHandler = withAuth(mockHandler as AuthenticatedHandler);
      await wrappedHandler(mockRequest);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(
        mockRequest,
        expect.objectContaining({ userId: testUserId })
      );
    });

    it('passes through the original request object to the handler', async () => {
      const testUserId = 'abc-123-def';
      mockGetUser.mockResolvedValue({
        data: { user: { id: testUserId } },
        error: null,
      });

      const postRequest = new Request('http://localhost/api/polls', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test Poll' }),
      });

      const wrappedHandler = withAuth(mockHandler as AuthenticatedHandler);
      await wrappedHandler(postRequest);

      expect(mockHandler).toHaveBeenCalledWith(
        postRequest,
        expect.objectContaining({ userId: testUserId })
      );
    });

    it('spreads additional context (params) into the handler context', async () => {
      const testUserId = 'user-id-456';
      mockGetUser.mockResolvedValue({
        data: { user: { id: testUserId } },
        error: null,
      });

      const routeContext = { params: { id: 'poll-123' } };
      const wrappedHandler = withAuth(mockHandler as AuthenticatedHandler);
      await wrappedHandler(mockRequest, routeContext);

      expect(mockHandler).toHaveBeenCalledWith(
        mockRequest,
        expect.objectContaining({
          userId: testUserId,
          params: { id: 'poll-123' },
        })
      );
    });

    it('returns the response from the inner handler on success', async () => {
      const testUserId = 'user-id-789';
      mockGetUser.mockResolvedValue({
        data: { user: { id: testUserId } },
        error: null,
      });

      const expectedResponse = new Response(
        JSON.stringify({ data: 'poll data' }),
        { status: 200 }
      );
      mockHandler.mockResolvedValue(expectedResponse);

      const wrappedHandler = withAuth(mockHandler as AuthenticatedHandler);
      const response = await wrappedHandler(mockRequest);

      expect(response).toBe(expectedResponse);
    });
  });
});
