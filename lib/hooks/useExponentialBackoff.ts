'use client';

import { useState, useCallback, useRef } from 'react';

export interface ExponentialBackoffConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  factor: number;
}

const DEFAULT_CONFIG: ExponentialBackoffConfig = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  factor: 2,
};

export interface ExponentialBackoffState {
  attempt: number;
  nextDelayMs: number;
  isRetrying: boolean;
}

/**
 * Hook providing exponential backoff logic for failed requests.
 * Initial delay: 1s, max: 30s, factor: 2.
 */
export function useExponentialBackoff(config: Partial<ExponentialBackoffConfig> = {}) {
  const { initialDelayMs, maxDelayMs, factor } = { ...DEFAULT_CONFIG, ...config };

  const [state, setState] = useState<ExponentialBackoffState>({
    attempt: 0,
    nextDelayMs: initialDelayMs,
    isRetrying: false,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getNextDelay = useCallback(
    (attempt: number): number => {
      const delay = initialDelayMs * Math.pow(factor, attempt);
      return Math.min(delay, maxDelayMs);
    },
    [initialDelayMs, maxDelayMs, factor]
  );

  const scheduleRetry = useCallback(
    (retryFn: () => Promise<boolean>): void => {
      const delay = getNextDelay(state.attempt);

      setState((prev) => ({
        ...prev,
        isRetrying: true,
        nextDelayMs: delay,
      }));

      timeoutRef.current = setTimeout(async () => {
        const success = await retryFn();
        if (success) {
          setState({ attempt: 0, nextDelayMs: initialDelayMs, isRetrying: false });
        } else {
          setState((prev) => ({
            attempt: prev.attempt + 1,
            nextDelayMs: getNextDelay(prev.attempt + 1),
            isRetrying: false,
          }));
        }
      }, delay);
    },
    [state.attempt, getNextDelay, initialDelayMs]
  );

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setState({ attempt: 0, nextDelayMs: initialDelayMs, isRetrying: false });
  }, [initialDelayMs]);

  const recordFailure = useCallback(() => {
    setState((prev) => ({
      attempt: prev.attempt + 1,
      nextDelayMs: getNextDelay(prev.attempt + 1),
      isRetrying: false,
    }));
  }, [getNextDelay]);

  const recordSuccess = useCallback(() => {
    setState({ attempt: 0, nextDelayMs: initialDelayMs, isRetrying: false });
  }, [initialDelayMs]);

  return {
    ...state,
    scheduleRetry,
    reset,
    recordFailure,
    recordSuccess,
    getNextDelay,
  };
}

/**
 * Pure utility function for computing exponential backoff delay.
 * Useful outside of React components.
 */
export function computeBackoffDelay(
  attempt: number,
  config: Partial<ExponentialBackoffConfig> = {}
): number {
  const { initialDelayMs, maxDelayMs, factor } = { ...DEFAULT_CONFIG, ...config };
  const delay = initialDelayMs * Math.pow(factor, attempt);
  return Math.min(delay, maxDelayMs);
}
