'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface PublicPoll {
  id: string;
  title: string;
  description: string | null;
  votingOpen: boolean;
}

export default function ParticipantLandingPage() {
  const [polls, setPolls] = useState<PublicPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPolls() {
      try {
        const res = await fetch('/api/polls/public');
        if (!res.ok) {
          setError('Unable to load polls.');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setPolls(data || []);
      } catch {
        setError('Unable to load polls.');
      } finally {
        setLoading(false);
      }
    }
    fetchPolls();
  }, []);

  return (
    <main
      id="main-content"
      style={{
        minHeight: '100vh',
        padding: 'var(--space-8)',
        fontFamily: 'var(--font-family-sans)',
        backgroundColor: 'var(--color-bg-secondary)',
      }}
    >
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <Link href="/" style={{ display: 'inline-block', marginBottom: 'var(--space-4)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt="SprintPulse"
              width={40}
              height={40}
            />
          </Link>
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Join a Poll
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
            Select a poll below to participate.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading polls...</p>
        )}

        {/* Error */}
        {error && (
          <p style={{ textAlign: 'center', color: 'var(--color-error-600)' }}>{error}</p>
        )}

        {/* Poll list */}
        {!loading && !error && polls.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No polls available at the moment.
          </p>
        )}

        {!loading && !error && polls.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {polls.map((poll) => (
              <Link
                key={poll.id}
                href={`/poll/${poll.id}`}
                style={{
                  display: 'block',
                  padding: 'var(--space-5) var(--space-6)',
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-lg)',
                  textDecoration: 'none',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'box-shadow var(--transition-normal), border-color var(--transition-normal)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                  <div style={{ flex: 1 }}>
                    <h2
                      style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 'var(--font-weight-semibold)',
                        color: 'var(--color-text-primary)',
                        marginBottom: 'var(--space-1)',
                      }}
                    >
                      {poll.title}
                    </h2>
                    {poll.description && (
                      <p
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--color-text-secondary)',
                          lineHeight: 'var(--line-height-relaxed)',
                        }}
                      >
                        {poll.description}
                      </p>
                    )}
                  </div>
                  <span
                    style={{
                      flexShrink: 0,
                      padding: 'var(--space-1) var(--space-3)',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-medium)',
                      backgroundColor: poll.votingOpen ? 'var(--color-success-50)' : 'var(--color-neutral-100)',
                      color: poll.votingOpen ? 'var(--color-success-700)' : 'var(--color-text-muted)',
                      border: `1px solid ${poll.votingOpen ? 'var(--color-success-200)' : 'var(--color-border-default)'}`,
                    }}
                  >
                    {poll.votingOpen ? 'Open' : 'Closed'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: 'var(--space-8)' }}>
          <Link
            href="/"
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-primary-600)',
              textDecoration: 'none',
            }}
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
