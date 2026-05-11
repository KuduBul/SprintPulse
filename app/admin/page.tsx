'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/lib/hooks/useApi';
import Link from 'next/link';

interface Poll {
  id: string;
  title: string;
  description: string | null;
  teamId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Team {
  id: string;
  name: string;
  pin: string;
}

export default function AdminPollsPage() {
  const { get, del, post } = useApi();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTeamId, setFilterTeamId] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [pollsRes, teamsRes] = await Promise.all([
      get<Poll[]>('/api/polls'),
      get<Team[]>('/api/teams'),
    ]);

    if (pollsRes.error) {
      setError(pollsRes.error.message || 'Failed to fetch polls');
    } else if (pollsRes.data) {
      setPolls(pollsRes.data);
    }

    if (teamsRes.data) {
      setTeams(teamsRes.data);
    }

    setLoading(false);
  }, [get]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (pollId: string) => {
    if (!confirm('Are you sure you want to delete this poll?')) return;

    const res = await del(`/api/polls/${pollId}`);
    if (res.status === 200) {
      setPolls((prev) => prev.filter((p) => p.id !== pollId));
    } else {
      alert(res.error?.message || 'Failed to delete poll');
    }
  };

  const handleClone = async (pollId: string) => {
    const res = await post(`/api/polls/${pollId}/clone`);
    if (res.status === 201) {
      fetchData();
    } else {
      alert(res.error?.message || 'Failed to clone poll');
    }
  };

  const handleReset = async (pollId: string) => {
    if (!confirm('Are you sure you want to reset all responses for this poll?')) return;

    const res = await post(`/api/polls/${pollId}/reset`);
    if (res.status === 200) {
      alert('Responses reset successfully');
    } else {
      alert(res.error?.message || 'Failed to reset responses');
    }
  };

  function getTeamName(teamId: string | null): string | null {
    if (!teamId) return null;
    const team = teams.find((t) => t.id === teamId);
    return team ? team.name : null;
  }

  const filteredPolls = filterTeamId
    ? polls.filter((p) => p.teamId === filterTeamId)
    : polls;

  if (loading) {
    return (
      <section aria-label="Loading polls">
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading polls...</p>
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
          onClick={fetchData}
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
    <section aria-label="Poll list">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-6)',
        }}
      >
        <h1
          style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
          }}
        >
          Polls
        </h1>
        <Link
          href="/admin/polls/new"
          style={{
            padding: 'var(--space-2) var(--space-5)',
            background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))',
            color: 'var(--color-text-on-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            fontWeight: 'var(--font-weight-semibold)',
            fontSize: 'var(--font-size-sm)',
            boxShadow: '0 2px 4px rgb(20 93 225 / 0.2)',
          }}
        >
          Create New Poll
        </Link>
      </div>

      {/* Team filter */}
      {teams.length > 0 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <select
            value={filterTeamId}
            onChange={(e) => setFilterTeamId(e.target.value)}
            aria-label="Filter by team"
            style={{
              padding: 'var(--space-2) var(--space-3)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              backgroundColor: 'var(--color-bg-primary)',
            }}
          >
            <option value="">All Teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {filteredPolls.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>
          {filterTeamId ? 'No polls found for this team.' : 'No polls yet. Create your first poll to get started.'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {filteredPolls.map((poll) => {
            const teamName = getTeamName(poll.teamId);
            return (
              <li
                key={poll.id}
                style={{
                  padding: 'var(--space-5)',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-default)',
                  borderLeft: '3px solid var(--color-primary-400)',
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: 'var(--space-4)',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'box-shadow var(--transition-normal)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                      <h2
                        style={{
                          fontSize: 'var(--font-size-lg)',
                          fontWeight: 'var(--font-weight-semibold)',
                        }}
                      >
                        {poll.title}
                      </h2>
                      {teamName ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px var(--space-2)',
                            backgroundColor: 'var(--color-primary-50)',
                            border: '1px solid var(--color-primary-200)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-medium)',
                            color: 'var(--color-primary-700)',
                          }}
                        >
                          {teamName}
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px var(--space-2)',
                            backgroundColor: 'var(--color-neutral-100)',
                            border: '1px solid var(--color-border-default)',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          No team
                        </span>
                      )}
                    </div>
                    {poll.description && (
                      <p
                        style={{
                          color: 'var(--color-text-secondary)',
                          fontSize: 'var(--font-size-sm)',
                          marginBottom: 'var(--space-2)',
                        }}
                      >
                        {poll.description}
                      </p>
                    )}
                    <p
                      style={{
                        color: 'var(--color-text-muted)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      Created: {new Date(poll.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--space-2)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Link
                      href={`/admin/polls/${poll.id}/edit`}
                      style={{
                        padding: 'var(--space-1) var(--space-3)',
                        backgroundColor: 'var(--color-bg-tertiary)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-sm)',
                        textDecoration: 'none',
                        color: 'var(--color-text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/admin/polls/${poll.id}/facilitate`}
                      style={{
                        padding: 'var(--space-1) var(--space-3)',
                        backgroundColor: 'var(--color-secondary-50)',
                        border: '1px solid var(--color-secondary-300)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-sm)',
                        textDecoration: 'none',
                        color: 'var(--color-secondary-800)',
                        cursor: 'pointer',
                      }}
                    >
                      Facilitate
                    </Link>
                    <button
                      onClick={() => handleClone(poll.id)}
                      style={{
                        padding: 'var(--space-1) var(--space-3)',
                        backgroundColor: 'var(--color-bg-tertiary)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-sm)',
                        cursor: 'pointer',
                      }}
                    >
                      Clone
                    </button>
                    <button
                      onClick={() => handleReset(poll.id)}
                      style={{
                        padding: 'var(--space-1) var(--space-3)',
                        backgroundColor: 'var(--color-warning-50)',
                        border: '1px solid var(--color-warning-300)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-warning-800)',
                        cursor: 'pointer',
                      }}
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => handleDelete(poll.id)}
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
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
