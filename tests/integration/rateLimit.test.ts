import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRateLimit, clearRateLimitStore } from '@/middleware/rateLimit';

describe('Integration: Rate Limiting Behaviour', () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it('allows requests within the rate limit', async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const rateLimitedHandler = withRateLimit(handler, { windowMs: 60_000, maxRequests: 5 });

    const request = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '192.168.1.1' },
    });

    // Make 5 requests — all should pass
    for (let i = 0; i < 5; i++) {
      const response = await rateLimitedHandler(request);
      expect(response.status).toBe(200);
    }

    expect(handler).toHaveBeenCalledTimes(5);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const rateLimitedHandler = withRateLimit(handler, { windowMs: 60_000, maxRequests: 3 });

    const request = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });

    // Make 3 requests — all should pass
    for (let i = 0; i < 3; i++) {
      await rateLimitedHandler(request);
    }

    // 4th request should be rate limited
    const response = await rateLimitedHandler(request);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.message).toBe('Too many requests, please try again later');
  });

  it('rate limits are per-IP (different IPs have separate limits)', async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const rateLimitedHandler = withRateLimit(handler, { windowMs: 60_000, maxRequests: 2 });

    const requestIp1 = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '1.1.1.1' },
    });
    const requestIp2 = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '2.2.2.2' },
    });

    // Exhaust limit for IP 1
    await rateLimitedHandler(requestIp1);
    await rateLimitedHandler(requestIp1);
    const blockedResponse = await rateLimitedHandler(requestIp1);
    expect(blockedResponse.status).toBe(429);

    // IP 2 should still be allowed
    const allowedResponse = await rateLimitedHandler(requestIp2);
    expect(allowedResponse.status).toBe(200);
  });

  it('uses x-real-ip header when x-forwarded-for is not present', async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const rateLimitedHandler = withRateLimit(handler, { windowMs: 60_000, maxRequests: 1 });

    const request = new Request('http://localhost/api/test', {
      headers: { 'x-real-ip': '3.3.3.3' },
    });

    const response1 = await rateLimitedHandler(request);
    expect(response1.status).toBe(200);

    const response2 = await rateLimitedHandler(request);
    expect(response2.status).toBe(429);
  });

  it('defaults to 60 requests per minute when no config provided', async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const rateLimitedHandler = withRateLimit(handler);

    const request = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '4.4.4.4' },
    });

    // Make 60 requests — all should pass
    for (let i = 0; i < 60; i++) {
      const response = await rateLimitedHandler(request);
      expect(response.status).toBe(200);
    }

    // 61st request should be rate limited
    const response = await rateLimitedHandler(request);
    expect(response.status).toBe(429);
  });

  it('passes context through to the handler', async () => {
    const handler = vi.fn().mockImplementation((_req, ctx) => {
      return new Response(JSON.stringify({ pollId: ctx?.params?.id }), { status: 200 });
    });
    const rateLimitedHandler = withRateLimit(handler);

    const request = new Request('http://localhost/api/polls/poll-1/respond', {
      headers: { 'x-forwarded-for': '5.5.5.5' },
    });

    const response = await rateLimitedHandler(request, { params: { id: 'poll-1' } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pollId).toBe('poll-1');
  });
});
