'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/lib/hooks/useApi';

interface Team {
  id: string;
  name: string;
  pin: string;
  createdAt: string;
}

export default function TeamsPage() {
  const { get, post, del, request } = useApi();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Inline rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Clipboard feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await get<Team[]>('/api/teams');
    if (res.error) {
      setError(res.error.message || 'Failed to fetch teams');
    } else if (res.data) {
      setTeams(res.data);
    }
    setLoading(false);
  }, [get]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setCreating(true);
    setCreateError(null);

    const res = await post('/api/teams', { name: newTeamName.trim() });
    if (res.error) {
      setCreateError(res.error.message || 'Failed to create team');
    } else {
      setNewTeamName('');
      fetchTeams();
    }
    setCreating(false);
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    setRenaming(true);

    const res = await request(`/api/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (res.error) {
      alert(res.error.message || 'Failed to rename team');
    } else {
      setEditingId(null);
      fetchTeams();
    }
    setRenaming(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this team? Associated polls will become unassigned.')) return;

    const res = await del(`/api/teams/${id}`);
    if (res.status === 200) {
      setTeams((prev) => prev.filter((t) => t.id !== id));
    } else {
      alert(res.error?.message || 'Failed to delete team');
    }
  }

  async function handleCopyPin(pin: string, teamId: string) {
    try {
      await navigator.clipboard.writeText(pin);
      setCopiedId(teamId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = pin;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedId(teamId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  if (loading) {
    return (
      <section aria-label="Loading teams">
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading teams...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-label="Error">
        <p style={{ color: 'var(--color-error-600)', marginBottom: 'var(--space-4)' }}>
          Error: {error}
        </p>
        <button
          onClick={fetchTeams}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: 'var(--color-primary-700)',
            color: 'var(--color-text-on-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Team management">
      <h1
        style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--space-6)',
        }}
      >
        Teams
      </h1>

      {/* Create Team Form */}
      <div
        style={{
          padding: 'var(--space-5)',
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-default)',
          borderLeft: '3px solid var(--color-primary-400)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-6)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            marginBottom: 'var(--space-3)',
          }}
        >
          Create New Team
        </h2>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name (e.g., Sprint Team Alpha)"
              maxLength={100}
              required
              aria-label="Team name"
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-base)',
              }}
            />
            {createError && (
              <p style={{ color: 'var(--color-error-600)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
                {createError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={creating || !newTeamName.trim()}
            style={{
              padding: 'var(--space-3) var(--space-5)',
              background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))',
              color: 'var(--color-text-on-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: 'var(--font-weight-semibold)',
              fontSize: 'var(--font-size-sm)',
              cursor: creating ? 'not-allowed' : 'pointer',
              opacity: creating || !newTeamName.trim() ? 0.6 : 1,
              boxShadow: '0 2px 4px rgb(20 93 225 / 0.2)',
            }}
          >
            {creating ? 'Creating...' : 'Create Team'}
          </button>
        </form>
      </div>

      {/* Teams List */}
      {teams.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>
          No teams yet. Create your first team to organize polls.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {teams.map((team) => (
            <li
              key={team.id}
              style={{
                padding: 'var(--space-5)',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-default)',
                borderLeft: '3px solid var(--color-primary-400)',
                borderRadius: 'var(--radius-lg)',
                marginBottom: 'var(--space-4)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ flex: 1, minWidth: '200px' }}>
                  {editingId === team.id ? (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={100}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(team.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        style={{
                          flex: 1,
                          padding: 'var(--space-2)',
                          border: '1px solid var(--color-primary-400)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-size-base)',
                        }}
                      />
                      <button
                        onClick={() => handleRename(team.id)}
                        disabled={renaming}
                        style={{
                          padding: 'var(--space-1) var(--space-3)',
                          backgroundColor: 'var(--color-primary-700)',
                          color: 'var(--color-text-on-primary)',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-size-sm)',
                          cursor: 'pointer',
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{
                          padding: 'var(--space-1) var(--space-3)',
                          backgroundColor: 'var(--color-bg-tertiary)',
                          border: '1px solid var(--color-border-default)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-size-sm)',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3
                        style={{
                          fontSize: 'var(--font-size-lg)',
                          fontWeight: 'var(--font-weight-semibold)',
                          marginBottom: 'var(--space-1)',
                        }}
                      >
                        {team.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: 'var(--space-1) var(--space-3)',
                            backgroundColor: 'var(--color-primary-50)',
                            border: '1px solid var(--color-primary-200)',
                            borderRadius: 'var(--radius-md)',
                            fontFamily: 'monospace',
                            fontSize: 'var(--font-size-lg)',
                            fontWeight: 'var(--font-weight-bold)',
                            color: 'var(--color-primary-800)',
                            letterSpacing: '0.1em',
                          }}
                        >
                          {team.pin}
                        </span>
                        <button
                          onClick={() => handleCopyPin(team.pin, team.id)}
                          title="Copy PIN to clipboard"
                          style={{
                            padding: 'var(--space-1) var(--space-2)',
                            backgroundColor: copiedId === team.id ? 'var(--color-success-50)' : 'var(--color-bg-tertiary)',
                            border: `1px solid ${copiedId === team.id ? 'var(--color-success-300)' : 'var(--color-border-default)'}`,
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-xs)',
                            cursor: 'pointer',
                            color: copiedId === team.id ? 'var(--color-success-700)' : 'var(--color-text-secondary)',
                          }}
                        >
                          {copiedId === team.id ? '✓ Copied' : '📋 Copy'}
                        </button>
                      </div>
                      <p
                        style={{
                          color: 'var(--color-text-muted)',
                          fontSize: 'var(--font-size-xs)',
                        }}
                      >
                        Created: {new Date(team.createdAt).toLocaleDateString()}
                      </p>
                    </>
                  )}
                </div>

                {editingId !== team.id && (
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      onClick={() => {
                        setEditingId(team.id);
                        setEditName(team.name);
                      }}
                      style={{
                        padding: 'var(--space-1) var(--space-3)',
                        backgroundColor: 'var(--color-bg-tertiary)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(team.id)}
                      style={{
                        padding: 'var(--space-1) var(--space-3)',
                        backgroundColor: 'var(--color-error-50)',
                        border: '1px solid var(--color-error-300)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-error-700)',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
