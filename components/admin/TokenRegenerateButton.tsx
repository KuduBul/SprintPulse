'use client';

import { useState, useCallback } from 'react';

interface TokenRegenerateButtonProps {
  pollId: string;
  onRegenerate: (newToken: string) => void;
}

/**
 * Button that regenerates the poll's access token after user confirmation.
 * Calls POST /api/polls/[id]/regenerate-token and invokes onRegenerate with the new token.
 */
export function TokenRegenerateButton({ pollId, onRegenerate }: TokenRegenerateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegenerate = useCallback(async () => {
    const confirmed = window.confirm(
      'Are you sure you want to regenerate the poll link? The current link and QR code will stop working immediately.'
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/polls/${pollId}/regenerate-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const body = await response.json();
        setError(body.error?.message || 'Failed to regenerate link.');
        setLoading(false);
        return;
      }

      const data = await response.json();
      onRegenerate(data.accessToken);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [pollId, onRegenerate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <button
        onClick={handleRegenerate}
        disabled={loading}
        aria-label="Regenerate poll access link"
        style={{
          padding: 'var(--space-2) var(--space-4)',
          backgroundColor: loading ? 'var(--color-warning-400)' : 'var(--color-warning-600)',
          color: 'var(--color-text-inverse)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-semibold)',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Regenerating...' : 'Regenerate Link'}
      </button>
      {error && (
        <p
          role="alert"
          style={{
            color: 'var(--color-error-600)',
            fontSize: 'var(--font-size-sm)',
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
