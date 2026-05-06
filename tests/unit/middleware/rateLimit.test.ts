import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withRateLimit, clearRateLimitStore } from '@/middleware/rateLimit';

describe('middleware/rateLimit', () => {
  beforeEach(() => {
    clearRateLimitStore();
    vi.restoreAllMocks();
  });

  function createRequest(
    ip?: string,
    headers: Record<string, string> = {}
  ): Request {
    const allHeaders: Record<string, string> = { ...headers };
    if (ip) {
      allHeaders['x-forwarded-for'] = ip;
    }
    return new Request('http://localhost/api/polls/123/respond', {
      method: 'POST',
      headers: allHeaders,
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

  describe('IP extraction', () => {
    it('extracts IP from x-forwarded-for header', async () => {
      const rateLimited = withRateLimit(mockHandler, {
        windowMs: 60_000,
        maxRequests: 1,
      });
      const request = createRequest('192.168.1.1');

      await rateLimited(request);

      expect(mockHandler).toHaveBeenCalledOnce();
    });

    it('extracts first IP from comma-separated x-forwarded-for', async () => {
      const rateLimited = withRateLimit(mockHandler, {
        windowMs: 60_000,
        maxRequests: 1,
      });
      const request = createRequest(undefined, {
        'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3',
      });

      // First request from 10.0.0.1 should pass
      await rateLimited(request);
      expect(mockHandler).toHaveBeenCalledOnce();

      // Second request from 10.0.0.1 should be rate limited
      mockHandler.mockClear();
      const request2 = createRequest(undefined, {
        'x-forwarded-for': '10.0.0.1, 10.0.0.2',
      });
      const response = await rateLimited(request2);
      expect(response.status).toBe(429);
    });

    it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
      const rateLimited = withRateLimit(mockHandler, {
        windowMs: 60_000,
        maxRequests: 1,
      });
      const request = createRequest(undefined, { 'x-real-ip': '172.16.0.1' });

      await rateLimited(request);
      expect(mockHandler).toHaveBeenCalledOnce();

      // Second request from same IP should be limited
      mockHandler.mockClear();
      const request2 = createRequest(undefined, { 'x-real-ip': '172.16.0.1' });
      const response = await rateLimited(request2);
      expect(response.status).toBe(429);
    });

    it('uses "unknown" when no IP headers are present', async () => {
      const rateLimited = withRateLimit(mockHandler, {
        windowMs: 60_000,
        maxRequests: 1,
      });
      const request = new Request('http://localhost/api/polls', {
        method: 'GET',
      });

      await rateLimited(request);
      expect(mockHandler).toHaveBeenCalledOnce();
    });
  });

  describe('rate limiting behaviour', () => {
    it('allows requests under the limit', async () => {
      const rateLimited = withRateLimit(mockHandler, {
        windowMs: 60_000,
        maxRequests: 5,
      });

      for (let i = 0; i < 5; i++) {
        const request = createRequest('192.168.1.1');
        const response = await rateLimited(request);
        expect(response.status).toBe(200);
      }

      expect(mockHandler).toHaveBeenCalledTimes(5);
    });

    it('returns 429 when limit is exceeded', async () => {
      const rateLimited = withRateLimit(mockHandler, {
        windowMs: 60_000,
        maxRequests: 3,
      });

      // Make 3 allowed requests
      for (let i = 0; i < 3; i++) {
        const request = createRequest('192.168.1.1');
        await rateLimited(request);
      }

      // 4th request should be rate limited
      const request = createRequest('192.168.1.1');
      const response = await rateLimited(request);
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.error.code).toBe('RATE_LIMITED');
      expect(body.error.message).toBe(
        'Too many requests, please try again later'
      );
    });

    it('does not call the handler when rate limited', async () => {
      const rateLimited = withRateLimit(mockHandler, {
        windowMs: 60_000,
        maxRequests: 1,
      });

      const request1 = createRequest('192.168.1.1');
      await rateLimited(request1);
      expect(mockHandler).toHaveBeenCalledOnce();

      mockHandler.mockClear();
      const request2 = createRequest('192.168.1.1');
      await rateLimited(request2);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('tracks different IPs independently', async () => {
      const rateLimited = withRateLimit(mockHandler, {
        windowMs: 60_000,
        maxRequests: 2,
      });

      // IP A makes 2 requests (at limit)
      for (let i = 0; i < 2; i++) {
        await rateLimited(createRequest('10.0.0.1'));
      }

      // IP B should still be allowed
      const response = await rateLimited(createRequest('10.0.0.2'));
      expect(response.status).toBe(200);

      // IP A should be rate limited
      const blockedResponse = await rateLimited(createRequest('10.0.0.1'));
      expect(blockedResponse.status).toBe(429);
    });

    it('resets after the time window expires (sliding window)', async () => {
      const now = Date.now();
      let currentTime = now;
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

      const rateLimited = withRateLimit(mockHandler, {
        windowMs: 60_000,
        maxRequests: 2,
      });

      // Make 2 requests at time 0
      await rateLimited(createRequest('192.168.1.1'));
      await rateLimited(createRequest('192.168.1.1'));

      // Should be rate limited at time 0
      const blockedResponse = await rateLimited(createRequest('192.168.1.1'));
      expect(blockedResponse.status).toBe(429);

      // Advance time past the window
      currentTime = now + 60_001;

      // Should be allowed again
      mockHandler.mockClear();
      const response = await rateLimited(createRequest('192.168.1.1'));
      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalledOnce();
    });
  });

  describe('default configuration', () => {
    it('uses default of 60 requests per minute when no config provided', async () => {
      const rateLimited = withRateLimit(mockHandler);

      // Make 60 requests — all should pass
      for (let i = 0; i < 60; i++) {
        const response = await rateLimited(createRequest('192.168.1.1'));
        expect(response.status).toBe(200);
      }

      // 61st request should be rate limited
      const response = await rateLimited(createRequest('192.168.1.1'));
      expect(response.status).toBe(429);
    });
  });

  describe('handler passthrough', () => {
    it('passes request and context to the handler', async () => {
      const rateLimited = withRateLimit(mockHandler, {
        windowMs: 60_000,
        maxRequests: 10,
      });
      const request = createRequest('192.168.1.1');
      const context = { params: { id: 'poll-123' } };

      await rateLimited(request, context);

      expect(mockHandler).toHaveBeenCalledWith(request, context);
    });

    it('returns the handler response when not rate limited', async () => {
      const customHandler = vi.fn(async () => {
        return new Response(JSON.stringify({ data: 'poll-data' }), {
          status: 200,
        });
      });
      const rateLimited = withRateLimit(customHandler, {
        windowMs: 60_000,
        maxRequests: 10,
      });

      const response = await rateLimited(createRequest('192.168.1.1'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toBe('poll-data');
    });
  });

  describe('error response format', () => {
    it('returns the expected API error format when rate limited', async () => {
      const rateLimited = withRateLimit(mockHandler, {
        windowMs: 60_000,
        maxRequests: 0,
      });

      const response = await rateLimited(createRequest('192.168.1.1'));
      const body = await response.json();

      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
      expect(typeof body.error.code).toBe('string');
      expect(typeof body.error.message).toBe('string');
      expect(body.error.code).toBe('RATE_LIMITED');
    });
  });
});
