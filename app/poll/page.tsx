'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PinEntryForm } from '@/components/participant/PinEntryForm';

interface PublicPoll {
  id: string;
  title: string;
  description: string | null;
  teamId: string | null;
  votingOpen: boolean;
}

const STORAGE_KEY = 'team_pin';

export default function ParticipantLandingPage() {
  const [polls, setPolls] = useState<PublicPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [showPinForm, setShowPinForm] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const fetchPolls = useCallback(async (filterTeamId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = filterTeamId
        ? `/api/polls/public?teamId=${filterTeamId}`
        : '/api/polls/public';
      const res = await fetch(url);
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
  }, []);

  const validatePin = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/teams/validate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        return false;
      }

      const data = await res.json();
      setTeamId(data.teamId);
      setTeamName(data.teamName);
      return true;
    } catch {
      return false;
    }
  }, []);

  // On mount, check localStorage for stored PIN
  useEffect(() => {
    async function init() {
      const storedPin = localStorage.getItem(STORAGE_KEY);

      if (storedPin) {
        const valid = await validatePin(storedPin);
        if (valid) {
          setShowPinForm(false);
        } else {
          // Stored PIN is invalid (team deleted), clear it
          localStorage.removeItem(STORAGE_KEY);
          setShowPinForm(true);
        }
      } else {
        setShowPinForm(true);
      }
      setInitializing(false);
    }
    init();
  }, [validatePin]);

  // Fetch polls when teamId changes
  useEffect(() => {
    if (!initializing) {
      if (teamId) {
        fetchPolls(teamId);
      } else if (showPinForm) {
        // Don't fetch polls while showing PIN form
        setLoading(false);
      } else {
        fetchPolls();
      }
    }
  }, [teamId, initializing, showPinForm, fetchPolls]);

  async function handlePinSubmit(pin: string) {
    setPinError(null);
    const valid = await validatePin(pin);
    if (valid) {
      localStorage.setItem(STORAGE_KEY, pin);
      setShowPinForm(false);
      setPinError(null);
    } else {
      setPinError('PIN not recognized. Please check with your facilitator.');
    }
  }

  function handleSwitchTeam() {
    localStorage.removeItem(STORAGE_KEY);
    setTeamId(null);
    setTeamName(null);
    setPolls([]);
    setShowPinForm(true);
    setPinError(null);
  }

  if (initializing) {
    return (
      <main
        id="main-content"
        style={{
          minHeight: '100vh',
          padding: 'var(--space-8)',
          fontFamily: 'var(--font-family-sans)',
          backgroundColor: 'var(--color-bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      </main>
    );
  }

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
          {teamName && !showPinForm && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <span
                style={{
                  padding: 'var(--space-1) var(--space-3)',
                  backgroundColor: 'var(--color-primary-50)',
                  border: '1px solid var(--color-primary-200)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-primary-700)',
                }}
              >
                Team: {teamName}
              </span>
              <button
                onClick={handleSwitchTeam}
                style={{
                  padding: 'var(--space-1) var(--space-3)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Switch Team
              </button>
            </div>
          )}
          {!showPinForm && (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
              Select a poll below to participate.
            </p>
          )}
        </div>

        {/* PIN Entry Form */}
        {showPinForm && (
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <PinEntryForm onSubmit={handlePinSubmit} error={pinError} />
          </div>
        )}

        {/* Poll list (only shown after PIN validation) */}
        {!showPinForm && (
          <>
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
          </>
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
