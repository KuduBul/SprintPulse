'use client';

import { useState, FormEvent } from 'react';

interface PinEntryFormProps {
  onSubmit: (pin: string) => Promise<void>;
  error?: string | null;
}

/**
 * PIN input form for participants to enter a team PIN.
 * Displays error message for invalid/unrecognized PINs.
 */
export function PinEntryForm({ onSubmit, error }: PinEntryFormProps) {
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pin.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit(pin.trim().toUpperCase());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label
          htmlFor="team-pin"
          style={{
            display: 'block',
            fontWeight: 'var(--font-weight-medium)',
            marginBottom: 'var(--space-2)',
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-primary)',
          }}
        >
          Enter Team PIN
        </label>
        <input
          id="team-pin"
          type="text"
          value={pin}
          onChange={(e) => setPin(e.target.value.toUpperCase())}
          placeholder="e.g., AB3X"
          maxLength={6}
          minLength={4}
          required
          aria-required="true"
          aria-invalid={!!error}
          aria-describedby={error ? 'pin-error' : 'pin-help'}
          autoComplete="off"
          style={{
            width: '100%',
            padding: 'var(--space-4)',
            border: `2px solid ${error ? 'var(--color-error-500)' : 'var(--color-border-strong)'}`,
            borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--font-size-xl)',
            fontFamily: 'monospace',
            textAlign: 'center',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        />
        {error && (
          <p
            id="pin-error"
            role="alert"
            style={{
              color: 'var(--color-error-600)',
              fontSize: 'var(--font-size-sm)',
              marginTop: 'var(--space-2)',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}
        {!error && (
          <p
            id="pin-help"
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-sm)',
              marginTop: 'var(--space-2)',
              textAlign: 'center',
            }}
          >
            Ask your facilitator for the team PIN
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting || pin.trim().length < 4}
        style={{
          width: '100%',
          padding: 'var(--space-3) var(--space-6)',
          background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))',
          color: 'var(--color-text-on-primary)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-semibold)',
          cursor: submitting || pin.trim().length < 4 ? 'not-allowed' : 'pointer',
          opacity: submitting || pin.trim().length < 4 ? 0.6 : 1,
          boxShadow: '0 2px 4px rgb(20 93 225 / 0.2)',
        }}
      >
        {submitting ? 'Validating...' : 'Join Team'}
      </button>
    </form>
  );
}
