'use client';

import { useState, useCallback, useRef } from 'react';
import { computeBackoffDelay, ExponentialBackoffConfig } from './useExponentialBackoff';

export interface ConnectionResilienceState {
  isDisconnected: boolean;
  isRateLimited: boolean;
  isRetrying: boolean;
  retryAttempt: number;
  nextRetryMs: number;
  rateLimitSecondsRemaining: number;
}

const DEFAULT_BACKOFF_CONFIG: ExponentialBackoffConfig = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  factor: 2,
};

/**
 * Hook that manages connection resilience state including:
 * - Connection lost detection and retry with exponential backoff
 * - Rate limit (429) detection with countdown
 * - Form state preservation on voting closed
 */
export function useConnectionResilience(
  backoffConfig: Partial<ExponentialBackoffConfig> = {}
) {
  const config = { ...DEFAULT_BACKOFF_CONFIG, ...backoffConfig };

  const [state, setState] = useState<ConnectionResilienceState>({
    isDisconnected: false,
    isRateLimited: false,
    isRetrying: false,
    retryAttempt: 0,
    nextRetryMs: config.initialDelayMs,
    rateLimitSecondsRemaining: 0,
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rateLimitIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Call when a network request fails (status 0 or network error).
   */
  const handleConnectionError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isDisconnected: true,
      nextRetryMs: computeBackoffDelay(prev.retryAttempt, config),
    }));
  }, [config]);

  /**
   * Call when a request succeeds — resets connection state.
   */
  const handleConnectionSuccess = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isDisconnected: false,
      isRetrying: false,
      retryAttempt: 0,
      nextRetryMs: config.initialDelayMs,
    }));
  }, [config.initialDelayMs]);

  /**
   * Call when a 429 response is received.
   */
  const handleRateLimited = useCallback((retryAfterSeconds = 60) => {
    setState((prev) => ({
      ...prev,
      isRateLimited: true,
      rateLimitSecondsRemaining: retryAfterSeconds,
    }));

    // Start countdown
    if (rateLimitIntervalRef.current) {
      clearInterval(rateLimitIntervalRef.current);
    }

    rateLimitIntervalRef.current = setInterval(() => {
      setState((prev) => {
        const remaining = prev.rateLimitSecondsRemaining - 1;
        if (remaining <= 0) {
          if (rateLimitIntervalRef.current) {
            clearInterval(rateLimitIntervalRef.current);
            rateLimitIntervalRef.current = null;
          }
          return { ...prev, isRateLimited: false, rateLimitSecondsRemaining: 0 };
        }
        return { ...prev, rateLimitSecondsRemaining: remaining };
      });
    }, 1000);
  }, []);

  /**
   * Manually retry the connection. Calls the provided retry function.
   * On success, resets state. On failure, increments backoff.
   */
  const retry = useCallback(
    async (retryFn: () => Promise<boolean>) => {
      setState((prev) => ({ ...prev, isRetrying: true }));

      const success = await retryFn();

      if (success) {
        handleConnectionSuccess();
      } else {
        setState((prev) => {
          const nextAttempt = prev.retryAttempt + 1;
          return {
            ...prev,
            isRetrying: false,
            retryAttempt: nextAttempt,
            nextRetryMs: computeBackoffDelay(nextAttempt, config),
          };
        });
      }
    },
    [handleConnectionSuccess, config]
  );

  /**
   * Schedule an automatic retry with exponential backoff.
   */
  const scheduleRetry = useCallback(
    (retryFn: () => Promise<boolean>) => {
      const delay = computeBackoffDelay(state.retryAttempt, config);

      retryTimeoutRef.current = setTimeout(() => {
        retry(retryFn);
      }, delay);
    },
    [state.retryAttempt, config, retry]
  );

  /**
   * Clear rate limit state.
   */
  const clearRateLimit = useCallback(() => {
    if (rateLimitIntervalRef.current) {
      clearInterval(rateLimitIntervalRef.current);
      rateLimitIntervalRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isRateLimited: false,
      rateLimitSecondsRemaining: 0,
    }));
  }, []);

  /**
   * Process an API response and update connection state accordingly.
   * Returns true if the response indicates an error that was handled.
   */
  const processResponse = useCallback(
    (status: number, errorCode?: string): boolean => {
      if (status === 0 || errorCode === 'NETWORK_ERROR') {
        handleConnectionError();
        return true;
      }

      if (status === 429 || errorCode === 'RATE_LIMITED') {
        handleRateLimited();
        return true;
      }

      // Successful response — clear disconnection state
      if (status >= 200 && status < 500) {
        if (state.isDisconnected) {
          handleConnectionSuccess();
        }
      }

      return false;
    },
    [handleConnectionError, handleRateLimited, handleConnectionSuccess, state.isDisconnected]
  );

  return {
    ...state,
    handleConnectionError,
    handleConnectionSuccess,
    handleRateLimited,
    retry,
    scheduleRetry,
    clearRateLimit,
    processResponse,
  };
}
