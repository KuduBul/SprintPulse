'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';

/**
 * Authentication form component with Login/Register toggle.
 * Handles email/password sign-in and sign-up with display name.
 */
export function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validateForm = (): string | null => {
    if (!email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format';
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (mode === 'register' && !displayName.trim()) return 'Display name is required';
    if (mode === 'register' && displayName.trim().length > 100) return 'Display name must be 100 characters or less';
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: authError } = await signIn(email, password);
        if (authError) {
          setError(authError.message);
        }
      } else {
        const { error: authError } = await signUp(email, password, displayName.trim());
        if (authError) {
          setError(authError.message);
        } else {
          setSuccessMessage('Account created! Check your email for confirmation, or sign in if email confirmation is disabled.');
        }
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      style={{
        maxWidth: '400px',
        width: '100%',
        padding: 'var(--space-8)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <h1
        style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--space-4)',
          color: 'var(--color-primary-800)',
        }}
      >
        SprintPulse
      </h1>
      <p
        style={{
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {mode === 'login' ? 'Sign in to manage your polls.' : 'Create an account to get started.'}
      </p>

      {/* Mode Toggle */}
      <div
        style={{
          display: 'flex',
          marginBottom: 'var(--space-6)',
          borderBottom: '2px solid var(--color-border-default)',
        }}
      >
        <button
          type="button"
          onClick={() => { setMode('login'); setError(null); setSuccessMessage(null); }}
          style={{
            flex: 1,
            padding: 'var(--space-3)',
            border: 'none',
            borderBottom: mode === 'login' ? '2px solid var(--color-primary-700)' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: mode === 'login' ? 'var(--color-primary-700)' : 'var(--color-text-secondary)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => { setMode('register'); setError(null); setSuccessMessage(null); }}
          style={{
            flex: 1,
            padding: 'var(--space-3)',
            border: 'none',
            borderBottom: mode === 'register' ? '2px solid var(--color-primary-700)' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: mode === 'register' ? 'var(--color-primary-700)' : 'var(--color-text-secondary)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          Register
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-error-50)',
            border: '1px solid var(--color-error-300)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-error-700)',
            fontSize: 'var(--font-size-sm)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {error}
        </div>
      )}

      {/* Success Display */}
      {successMessage && (
        <div
          role="status"
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-success-50)',
            border: '1px solid var(--color-success-300)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-success-700)',
            fontSize: 'var(--font-size-sm)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Display Name (Register only) */}
        {mode === 'register' && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label
              htmlFor="display-name-input"
              style={{
                display: 'block',
                fontWeight: 'var(--font-weight-medium)',
                marginBottom: 'var(--space-2)',
              }}
            >
              Display Name
            </label>
            <input
              id="display-name-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={100}
              required
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-base)',
              }}
            />
          </div>
        )}

        {/* Email */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label
            htmlFor="email-input"
            style={{
              display: 'block',
              fontWeight: 'var(--font-weight-medium)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Email
          </label>
          <input
            id="email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={{
              width: '100%',
              padding: 'var(--space-3)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-base)',
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label
            htmlFor="password-input"
            style={{
              display: 'block',
              fontWeight: 'var(--font-weight-medium)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Password
          </label>
          <input
            id="password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter password'}
            required
            minLength={8}
            style={{
              width: '100%',
              padding: 'var(--space-3)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-base)',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-primary-700)',
            color: 'var(--color-text-on-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
    </section>
  );
}
