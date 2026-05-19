'use client';

import { useState, useCallback } from 'react';

interface PollUrlDisplayProps {
  url: string;
}

/**
 * Displays the full poll URL in a styled container with a copy-to-clipboard button.
 * Shows brief "Copied!" feedback after successful copy.
 */
export function PollUrlDisplay({ url }: PollUrlDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text for manual copy
    }
  }, [url]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: 'var(--color-bg-tertiary)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <span
        style={{
          flex: 1,
          fontFamily: 'var(--font-family-mono)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-primary)',
          wordBreak: 'break-all',
        }}
        aria-label="Poll URL"
      >
        {url}
      </span>
      <button
        onClick={handleCopy}
        aria-label={copied ? 'Copied to clipboard' : 'Copy poll URL to clipboard'}
        style={{
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: copied ? 'var(--color-success-600)' : 'var(--color-primary-700)',
          color: 'var(--color-text-on-primary)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-semibold)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'background-color var(--transition-fast)',
        }}
      >
        {copied ? '✓ Copied!' : 'Copy'}
      </button>
    </div>
  );
}
