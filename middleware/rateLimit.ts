import { NextResponse } from 'next/server';

/**
 * Route handler type for Next.js App Router.
 */
type RouteHandler = (request: Request, context?: any) => Promise<Response>;

/**
 * Configuration for the sliding window rate limiter.
 */
export interface RateLimitConfig {
  /** Time window in milliseconds (default: 60_000 = 1 minute) */
  windowMs: number;
  /** Maximum requests allowed within the window (default: 60) */
  maxRequests: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 60,
};

/**
 * In-memory store of request timestamps keyed by IP address.
 * Each IP maps to an array of timestamps (ms) representing recent requests.
 */
const requestStore = new Map<string, number[]>();

/**
 * Extracts the client IP address from request headers.
 * Checks x-forwarded-for, x-real-ip, and falls back to 'unknown'.
 */
function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; take the first one
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}

/**
 * Higher-order function that wraps a route handler with sliding window rate limiting.
 *
 * Uses an in-memory store keyed by client IP. On each request, timestamps older
 * than the window are pruned, and if the remaining count exceeds maxRequests,
 * a 429 response is returned.
 *
 * @param handler - The route handler to protect
 * @param config - Optional rate limit configuration
 * @returns A wrapped route handler that enforces rate limiting
 */
export function withRateLimit(
  handler: RouteHandler,
  config?: Partial<RateLimitConfig>
): RouteHandler {
  const { windowMs, maxRequests } = { ...DEFAULT_CONFIG, ...config };

  return async (request: Request, context?: any): Promise<Response> => {
    const ip = getClientIp(request);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing timestamps for this IP, or initialize empty array
    const timestamps = requestStore.get(ip) || [];

    // Remove timestamps outside the current window (sliding window)
    const recentTimestamps = timestamps.filter((ts) => ts > windowStart);

    // Check if rate limit is exceeded
    if (recentTimestamps.length >= maxRequests) {
      requestStore.set(ip, recentTimestamps);
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests, please try again later',
          },
        },
        { status: 429 }
      );
    }

    // Add current request timestamp and update store
    recentTimestamps.push(now);
    requestStore.set(ip, recentTimestamps);

    return handler(request, context);
  };
}

/**
 * Clears the in-memory rate limit store.
 * Exposed for testing purposes.
 */
export function clearRateLimitStore(): void {
  requestStore.clear();
}
