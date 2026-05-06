import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectionResilience } from '@/lib/hooks/useConnectionResilience';

describe('useConnectionResilience', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with connected state', () => {
    const { result } = renderHook(() => useConnectionResilience());

    expect(result.current.isDisconnected).toBe(false);
    expect(result.current.isRateLimited).toBe(false);
    expect(result.current.isRetrying).toBe(false);
    expect(result.current.retryAttempt).toBe(0);
  });

  describe('connection error handling', () => {
    it('sets disconnected state on connection error', () => {
      const { result } = renderHook(() => useConnectionResilience());

      act(() => {
        result.current.handleConnectionError();
      });

      expect(result.current.isDisconnected).toBe(true);
    });

    it('resets state on connection success', () => {
      const { result } = renderHook(() => useConnectionResilience());

      act(() => {
        result.current.handleConnectionError();
      });
      expect(result.current.isDisconnected).toBe(true);

      act(() => {
        result.current.handleConnectionSuccess();
      });
      expect(result.current.isDisconnected).toBe(false);
      expect(result.current.retryAttempt).toBe(0);
    });
  });

  describe('exponential backoff', () => {
    it('computes initial delay of 1s', () => {
      const { result } = renderHook(() => useConnectionResilience());

      act(() => {
        result.current.handleConnectionError();
      });

      expect(result.current.nextRetryMs).toBe(1000);
    });

    it('increases delay on retry failure', async () => {
      const { result } = renderHook(() => useConnectionResilience());

      act(() => {
        result.current.handleConnectionError();
      });

      // First retry fails
      await act(async () => {
        await result.current.retry(async () => false);
      });

      expect(result.current.retryAttempt).toBe(1);
      expect(result.current.nextRetryMs).toBe(2000);

      // Second retry fails
      await act(async () => {
        await result.current.retry(async () => false);
      });

      expect(result.current.retryAttempt).toBe(2);
      expect(result.current.nextRetryMs).toBe(4000);
    });

    it('caps delay at 30s', async () => {
      const { result } = renderHook(() => useConnectionResilience());

      act(() => {
        result.current.handleConnectionError();
      });

      // Simulate many failures
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          await result.current.retry(async () => false);
        });
      }

      expect(result.current.nextRetryMs).toBe(30000);
    });

    it('resets on successful retry', async () => {
      const { result } = renderHook(() => useConnectionResilience());

      act(() => {
        result.current.handleConnectionError();
      });

      // Fail a few times
      await act(async () => {
        await result.current.retry(async () => false);
      });
      await act(async () => {
        await result.current.retry(async () => false);
      });

      expect(result.current.retryAttempt).toBe(2);

      // Succeed
      await act(async () => {
        await result.current.retry(async () => true);
      });

      expect(result.current.isDisconnected).toBe(false);
      expect(result.current.retryAttempt).toBe(0);
      expect(result.current.nextRetryMs).toBe(1000);
    });
  });

  describe('rate limiting', () => {
    it('sets rate limited state', () => {
      const { result } = renderHook(() => useConnectionResilience());

      act(() => {
        result.current.handleRateLimited(30);
      });

      expect(result.current.isRateLimited).toBe(true);
      expect(result.current.rateLimitSecondsRemaining).toBe(30);
    });

    it('counts down rate limit seconds', () => {
      const { result } = renderHook(() => useConnectionResilience());

      act(() => {
        result.current.handleRateLimited(5);
      });

      expect(result.current.rateLimitSecondsRemaining).toBe(5);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.rateLimitSecondsRemaining).toBe(3);
    });

    it('clears rate limit when countdown reaches zero', () => {
      const { result } = renderHook(() => useConnectionResilience());

      act(() => {
        result.current.handleRateLimited(3);
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.isRateLimited).toBe(false);
      expect(result.current.rateLimitSecondsRemaining).toBe(0);
    });

    it('can manually clear rate limit', () => {
      const { result } = renderHook(() => useConnectionResilience());

      act(() => {
        result.current.handleRateLimited(60);
      });

      expect(result.current.isRateLimited).toBe(true);

      act(() => {
        result.current.clearRateLimit();
      });

      expect(result.current.isRateLimited).toBe(false);
    });
  });

  describe('processResponse', () => {
    it('handles network error (status 0)', () => {
      const { result } = renderHook(() => useConnectionResilience());

      let handled: boolean;
      act(() => {
        handled = result.current.processResponse(0, 'NETWORK_ERROR');
      });

      expect(handled!).toBe(true);
      expect(result.current.isDisconnected).toBe(true);
    });

    it('handles rate limit (status 429)', () => {
      const { result } = renderHook(() => useConnectionResilience());

      let handled: boolean;
      act(() => {
        handled = result.current.processResponse(429, 'RATE_LIMITED');
      });

      expect(handled!).toBe(true);
      expect(result.current.isRateLimited).toBe(true);
    });

    it('clears disconnection on successful response', () => {
      const { result } = renderHook(() => useConnectionResilience());

      act(() => {
        result.current.handleConnectionError();
      });
      expect(result.current.isDisconnected).toBe(true);

      act(() => {
        result.current.processResponse(200);
      });

      expect(result.current.isDisconnected).toBe(false);
    });

    it('returns false for non-error responses', () => {
      const { result } = renderHook(() => useConnectionResilience());

      let handled: boolean;
      act(() => {
        handled = result.current.processResponse(200);
      });

      expect(handled!).toBe(false);
    });

    it('returns false for 4xx errors that are not rate limits', () => {
      const { result } = renderHook(() => useConnectionResilience());

      let handled: boolean;
      act(() => {
        handled = result.current.processResponse(400, 'VALIDATION_ERROR');
      });

      expect(handled!).toBe(false);
    });
  });

  describe('custom backoff config', () => {
    it('respects custom initial delay', () => {
      const { result } = renderHook(() =>
        useConnectionResilience({ initialDelayMs: 500 })
      );

      act(() => {
        result.current.handleConnectionError();
      });

      expect(result.current.nextRetryMs).toBe(500);
    });

    it('respects custom max delay', async () => {
      const { result } = renderHook(() =>
        useConnectionResilience({ maxDelayMs: 5000 })
      );

      act(() => {
        result.current.handleConnectionError();
      });

      // Fail many times
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          await result.current.retry(async () => false);
        });
      }

      expect(result.current.nextRetryMs).toBe(5000);
    });
  });
});
