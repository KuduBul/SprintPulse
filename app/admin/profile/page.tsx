'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useApi } from '@/lib/hooks/useApi';

/**
 * Profile management page for facilitators.
 * Displays email (read-only) and allows editing display name.
 */
export default function ProfilePage() {
  const { user } = useAuth();
  const { get, request } = useApi();
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      const res = await get<{ email: string; displayName: string }>('/api/profile');
      if (res.data) {
        setDisplayName(res.data.displayName);
      }
      setLoading(false);
    }
    fetchProfile();
  }, [get]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    const res = await request<{ displayName: string }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ displayName }),
    });

    if (res.error) {
      setMessage({ type: 'error', text: res.error.message || 'Failed to update profile' });
    } else {
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '500px' }}>
      <h1
        style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--space-6)',
        }}
      >
        Profile
      </h1>

      {message && (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          style={{
            padding: 'var(--space-3)',
            backgroundColor: message.type === 'error' ? 'var(--color-error-50)' : 'var(--color-success-50)',
            border: `1px solid ${message.type === 'error' ? 'var(--color-error-300)' : 'var(--color-success-300)'}`,
            borderRadius: 'var(--radius-md)',
            color: message.type === 'error' ? 'var(--color-error-700)' : 'var(--color-success-700)',
            fontSize: 'var(--font-size-sm)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Email (read-only) */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label
            htmlFor="email-field"
            style={{
              display: 'block',
              fontWeight: 'var(--font-weight-medium)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Email
          </label>
          <input
            id="email-field"
            type="email"
            value={user?.email ?? ''}
            readOnly
            disabled
            style={{
              width: '100%',
              padding: 'var(--space-3)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-base)',
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-secondary)',
            }}
          />
        </div>

        {/* Display Name */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label
            htmlFor="display-name-field"
            style={{
              display: 'block',
              fontWeight: 'var(--font-weight-medium)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Display Name
          </label>
          <input
            id="display-name-field"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
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

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: 'var(--space-3) var(--space-6)',
            backgroundColor: 'var(--color-primary-700)',
            color: 'var(--color-text-on-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
