'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminToken } from '@/lib/hooks/useAdminToken';
import Link from 'next/link';

interface Poll {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPollsPage() {
  const { token } = useAdminToken();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPolls = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/polls', {
        headers: {
          'x-admin-token': token,
        },
      });

      if (!response.ok) {
        const body = await response.json();
        setError(body.error?.message || 'Failed to fetch polls');
        return;
      }

      const data = await response.json();
      setPolls(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  const handleDelete = async (pollId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this poll?')) return;

    try {
      const response = await fetch(`/api/polls/${pollId}`, {
        method: 'DELETE',
        headers: {
          'x-admin-token': token,
        },
      });

      if (response.ok) {
        setPolls((prev) => prev.filter((p) => p.id !== pollId));
      } else {
        const body = await response.json();
        alert(body.error?.message || 'Failed to delete poll');
      }
    } catch {
      alert('Network error while deleting poll');
    }
  };

  const handleClone = async (pollId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/polls/${pollId}/clone`, {
        method: 'POST',
        headers: {
          'x-admin-token': token,
        },
      });

      if (response.ok) {
        fetchPolls();
      } else {
        const body = await response.json();
        alert(body.error?.message || 'Failed to clone poll');
      }
    } catch {
      alert('Network error while cloning poll');
    }
  };

  const handleReset = async (pollId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to reset all responses for this poll?')) return;

    try {
      const response = await fetch(`/api/polls/${pollId}/reset`, {
        method: 'POST',
        headers: {
          'x-admin-token': token,
        },
      });

      if (response.ok) {
        alert('Responses reset successfully');
      } else {
        const body = await response.json();
        alert(body.error?.message || 'Failed to reset responses');
      }
    } catch {
      alert('Network error while resetting responses');
    }
  };

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
          onClick={fetchPolls}
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
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: 'var(--color-primary-700)',
            color: 'var(--color-text-on-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            fontWeight: 'var(--font-weight-semibold)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          Create New Poll
        </Link>
      </div>

      {polls.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>
          No polls yet. Create your first poll to get started.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {polls.map((poll) => (
            <li
              key={poll.id}
              style={{
                padding: 'var(--space-4)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-3)',
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
                  <h2
                    style={{
                      fontSize: 'var(--font-size-lg)',
                      fontWeight: 'var(--font-weight-semibold)',
                      marginBottom: 'var(--space-1)',
                    }}
                  >
                    {poll.title}
                  </h2>
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
          ))}
        </ul>
      )}
    </section>
  );
}
