import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withAdminAuth } from '@/middleware/adminAuth';

describe('middleware/adminAuth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ADMIN_SECRET = 'test-admin-secret';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createRequest(headers: Record<string, string> = {}): Request {
    return new Request('http://localhost/api/polls', {
      method: 'GET',
      headers,
    });
  }

  const mockHandler = vi.fn(async () => {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  beforeEach(() => {
    mockHandler.mockClear();
  });

  it('returns 401 when x-admin-token header is missing', async () => {
    const protectedHandler = withAdminAuth(mockHandler);
    const request = createRequest();

    const response = await protectedHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Invalid or missing admin token');
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('returns 401 when x-admin-token header is invalid', async () => {
    const protectedHandler = withAdminAuth(mockHandler);
    const request = createRequest({ 'x-admin-token': 'wrong-token' });

    const response = await protectedHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Invalid or missing admin token');
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('returns 401 when x-admin-token is empty string', async () => {
    const protectedHandler = withAdminAuth(mockHandler);
    const request = createRequest({ 'x-admin-token': '' });

    const response = await protectedHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('calls the handler when x-admin-token is valid', async () => {
    const protectedHandler = withAdminAuth(mockHandler);
    const request = createRequest({ 'x-admin-token': 'test-admin-secret' });

    const response = await protectedHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockHandler).toHaveBeenCalledOnce();
    expect(mockHandler).toHaveBeenCalledWith(request, undefined);
  });

  it('passes context through to the handler', async () => {
    const protectedHandler = withAdminAuth(mockHandler);
    const request = createRequest({ 'x-admin-token': 'test-admin-secret' });
    const context = { params: { id: '123' } };

    await protectedHandler(request, context);

    expect(mockHandler).toHaveBeenCalledWith(request, context);
  });

  it('returns 401 when ADMIN_SECRET env var is not set', async () => {
    delete process.env.ADMIN_SECRET;

    const protectedHandler = withAdminAuth(mockHandler);
    const request = createRequest({ 'x-admin-token': 'any-token' });

    const response = await protectedHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('error response matches the expected API error format', async () => {
    const protectedHandler = withAdminAuth(mockHandler);
    const request = createRequest();

    const response = await protectedHandler(request);
    const body = await response.json();

    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
    expect(typeof body.error.code).toBe('string');
    expect(typeof body.error.message).toBe('string');
  });
});
