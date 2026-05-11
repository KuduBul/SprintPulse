'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/lib/hooks/useApi';

interface Team {
  id: string;
  name: string;
  pin: string;
}

interface TeamSelectorProps {
  value: string;
  onChange: (teamId: string) => void;
  required?: boolean;
  error?: string;
}

/**
 * Dropdown component that fetches and displays facilitator's teams.
 * Shows team name and PIN in each option for easy identification.
 */
export function TeamSelector({ value, onChange, required = false, error }: TeamSelectorProps) {
  const { get } = useApi();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTeams() {
      const res = await get<Team[]>('/api/teams');
      if (res.error) {
        setFetchError('Failed to load teams');
      } else if (res.data) {
        setTeams(res.data);
      }
      setLoading(false);
    }
    fetchTeams();
  }, [get]);

  if (loading) {
    return (
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <label
          style={{
            display: 'block',
            fontWeight: 'var(--font-weight-medium)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Team {required && <span aria-hidden="true">*</span>}
        </label>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Loading teams...
        </p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <label
          style={{
            display: 'block',
            fontWeight: 'var(--font-weight-medium)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Team {required && <span aria-hidden="true">*</span>}
        </label>
        <p style={{ color: 'var(--color-error-600)', fontSize: 'var(--font-size-sm)' }}>
          {fetchError}
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <label
        htmlFor="team-selector"
        style={{
          display: 'block',
          fontWeight: 'var(--font-weight-medium)',
          marginBottom: 'var(--space-2)',
        }}
      >
        Team {required && <span aria-hidden="true">*</span>}
      </label>
      <select
        id="team-selector"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error ? 'team-selector-error' : undefined}
        style={{
          width: '100%',
          padding: 'var(--space-3)',
          border: `1px solid ${error ? 'var(--color-error-500)' : 'var(--color-border-strong)'}`,
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-base)',
          backgroundColor: 'var(--color-bg-primary)',
        }}
      >
        <option value="">Select a team...</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} (PIN: {team.pin})
          </option>
        ))}
      </select>
      {error && (
        <p
          id="team-selector-error"
          role="alert"
          style={{
            color: 'var(--color-error-600)',
            fontSize: 'var(--font-size-sm)',
            marginTop: 'var(--space-1)',
          }}
        >
          {error}
        </p>
      )}
      {teams.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
          No teams available. Create a team first in the Teams page.
        </p>
      )}
    </div>
  );
}
