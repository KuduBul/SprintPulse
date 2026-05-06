'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ConnectionBannerProps {
  /** Whether the connection is currently lost */
  isDisconnected: boolean;
  /** Callback to retry the connection */
  onRetry: () => void;
  /** Whether a retry is currently in progress */
  isRetrying?: boolean;
  /** Next retry delay in milliseconds (for display) */
  nextRetryMs?: number;
}

/**
 * "Connection lost" banner with retry button.
 * Displays when the client loses connection to the server.
 * Supports exponential backoff display.
 */
export function ConnectionBanner({
  isDisconnected,
  onRetry,
  isRetrying = false,
  nextRetryMs,
}: ConnectionBannerProps) {
  if (!isDisconnected) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: 'var(--color-error-600)',
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
        ⚠
      </span>
      <span>Connection lost. Please check your network.</span>
      {nextRetryMs && !isRetrying && (
        <span style={{ opacity: 0.8, fontSize: 'var(--font-size-xs)' }}>
          (retrying in {Math.ceil(nextRetryMs / 1000)}s)
        </span>
      )}
      <button
        onClick={onRetry}
        disabled={isRetrying}
        aria-busy={isRetrying}
        style={{
          padding: 'var(--space-1) var(--space-3)',
          backgroundColor: 'var(--color-text-inverse)',
          color: 'var(--color-error-700)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-semibold)',
          cursor: isRetrying ? 'not-allowed' : 'pointer',
          opacity: isRetrying ? 0.7 : 1,
        }}
      >
        {isRetrying ? 'Retrying...' : 'Retry now'}
      </button>
    </div>
  );
}
