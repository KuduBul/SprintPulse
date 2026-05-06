'use client';

import { useState, useEffect, useRef } from 'react';

export interface RateLimitBannerProps {
  /** Whether the rate limit is currently active */
  isRateLimited: boolean;
  /** When the rate limit resets (timestamp in ms), or duration in seconds to count down */
  retryAfterSeconds?: number;
  /** Called when the countdown finishes */
  onCountdownComplete?: () => void;
}

/**
 * Rate limit feedback banner (429 response).
 * Displays "Too many requests" with a countdown timer.
 */
export function RateLimitBanner({
  isRateLimited,
  retryAfterSeconds = 60,
  onCountdownComplete,
}: RateLimitBannerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(retryAfterSeconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isRateLimited) {
      setSecondsRemaining(retryAfterSeconds);
      return;
    }

    setSecondsRemaining(retryAfterSeconds);

    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onCountdownComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRateLimited, retryAfterSeconds, onCountdownComplete]);

  if (!isRateLimited) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: 'var(--color-warning-600)',
        color: 'var(--color-text-inverse)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        fontSize: 'var(--font-size-sm)',
        fontWeight: 'var(--font-weight-medium)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 'var(--font-size-base)' }}>
        ⏳
      </span>
      <span>Too many requests.</span>
      {secondsRemaining > 0 && (
        <span>
          Please wait{' '}
          <strong aria-live="polite" aria-atomic="true">
            {secondsRemaining}s
          </strong>{' '}
          before trying again.
        </span>
      )}
    </div>
  );
}
