'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSessionToken } from '@/lib/hooks/useSessionToken';
import { ParticipantForm } from '@/components/participant/ParticipantForm';

interface FacilitatorState {
  votingOpen: boolean;
  liveResults: boolean;
  anonymise: boolean;
  revealStage: string;
}

interface PollData {
  id: string;
  title: string;
  description: string | null;
  backgroundImageUrl: string | null;
  facilitatorState: FacilitatorState;
  questions: Array<{
    id: string;
    text: string;
    options: string[];
    allowCustom: boolean;
    position: { x: number; y: number; width: number; height: number } | null;
    displayOrder: number;
  }>;
}

export default function ParticipantPollPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pollId = params.id as string;
  const isTestMode = searchParams.get('testMode') === 'true';
  const { getSession, createSession, hasSession } = useSessionToken();

  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [nameError, setNameError] = useState('');
  const [sessionCreated, setSessionCreated] = useState(false);

  // Fetch poll data and check session on mount
  useEffect(() => {
    async function fetchPoll() {
      try {
        const res = await fetch(`/api/polls/${pollId}/public`);
        if (res.status === 404) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const data: PollData = await res.json();
        setPoll(data);

        // Check if session already exists for this poll
        const existingSession = getSession(pollId);
        if (existingSession) {
          setParticipantName(existingSession.name);
          setAlreadySubmitted(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchPoll();
  }, [pollId, getSession]);

  // Restore name from session on mount (for page refresh scenario where session exists but not yet submitted)
  useEffect(() => {
    if (!loading && poll && !alreadySubmitted) {
      const existingSession = getSession(pollId);
      if (existingSession) {
        setParticipantName(existingSession.name);
        setSessionCreated(true);
      }
    }
  }, [loading, poll, pollId, getSession, alreadySubmitted]);

  function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    setNameError('');

    const trimmedName = participantName.trim();
    if (trimmedName.length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }
    if (trimmedName.length > 50) {
      setNameError('Name must be 50 characters or fewer');
      return;
    }

    createSession(pollId, trimmedName);
    setParticipantName(trimmedName);
    setSessionCreated(true);
  }

  // Loading state
  if (loading) {
    return (
      <main id="main-content" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p>Loading poll...</p>
      </main>
    );
  }

  // 404 state
  if (notFound) {
    return (
      <main id="main-content" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)' }}>
          Poll Not Found
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          The poll you are looking for does not exist or has been removed.
        </p>
      </main>
    );
  }

  // Voting closed state
  if (poll && !poll.facilitatorState.votingOpen) {
    return (
      <main id="main-content" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)' }}>
          {poll.title}
        </h1>
        <div
          role="status"
          style={{
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-warning-50)',
            border: '1px solid var(--color-warning-300)',
            borderRadius: 'var(--radius-lg)',
            maxWidth: '500px',
            margin: '0 auto',
          }}
        >
          <p style={{ color: 'var(--color-warning-800)', fontWeight: 'var(--font-weight-semibold)' }}>
            Voting is currently closed
          </p>
        </div>
      </main>
    );
  }

  // Already submitted state
  if (alreadySubmitted) {
    return (
      <main id="main-content" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)' }}>
          {poll?.title}
        </h1>
        <div
          role="status"
          style={{
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-success-50)',
            border: '1px solid var(--color-success-300)',
            borderRadius: 'var(--radius-lg)',
            maxWidth: '500px',
            margin: '0 auto',
          }}
        >
          <p style={{ color: 'var(--color-success-800)', fontWeight: 'var(--font-weight-semibold)' }}>
            Already submitted
          </p>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
            You have already submitted your responses to this poll as {participantName}.
          </p>
        </div>
      </main>
    );
  }

  // Session created — show ParticipantForm
  if (sessionCreated) {
    return (
      <main id="main-content" style={{ padding: 'var(--space-8)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)', textAlign: 'center' }}>
          {poll?.title}
        </h1>
        {poll?.description && (
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', textAlign: 'center' }}>
            {poll.description}
          </p>
        )}
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)', textAlign: 'center' }}>
          Welcome, {participantName}!
        </p>
        {poll && (
          <ParticipantForm
            poll={poll}
            facilitatorState={poll.facilitatorState}
            participantName={participantName}
            sessionToken={getSession(pollId)?.token || ''}
            pollId={pollId}
            isTestMode={isTestMode}
            onSubmit={async (responses) => {
              const res = await fetch(`/api/polls/${pollId}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(responses),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error?.message || 'Submission failed');
              }
              setAlreadySubmitted(true);
            }}
          />
        )}
      </main>
    );
  }

  // Name entry form
  return (
    <main id="main-content" style={{ padding: 'var(--space-8)', maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)', textAlign: 'center' }}>
        {poll?.title}
      </h1>
      {poll?.description && (
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)', textAlign: 'center' }}>
          {poll.description}
        </p>
      )}

      <form onSubmit={handleNameSubmit} noValidate>
        <label
          htmlFor="participant-name"
          style={{
            display: 'block',
            fontWeight: 'var(--font-weight-medium)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Enter your name to begin
        </label>
        <input
          id="participant-name"
          type="text"
          value={participantName}
          onChange={(e) => {
            setParticipantName(e.target.value);
            if (nameError) setNameError('');
          }}
          placeholder="Your name (2–50 characters)"
          minLength={2}
          maxLength={50}
          required
          aria-describedby={nameError ? 'name-error' : undefined}
          aria-invalid={nameError ? true : undefined}
          style={{
            width: '100%',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 'var(--font-size-base)',
            border: `1px solid ${nameError ? 'var(--color-error-500)' : 'var(--color-border-default)'}`,
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-2)',
          }}
        />
        {nameError && (
          <p
            id="name-error"
            role="alert"
            style={{
              color: 'var(--color-error-600)',
              fontSize: 'var(--font-size-sm)',
              marginBottom: 'var(--space-4)',
            }}
          >
            {nameError}
          </p>
        )}
        <button
          type="submit"
          style={{
            width: '100%',
            padding: 'var(--space-3) var(--space-6)',
            backgroundColor: 'var(--color-primary-600)',
            color: 'var(--color-text-on-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: 'pointer',
            marginTop: 'var(--space-2)',
          }}
        >
          Continue
        </button>
      </form>
    </main>
  );
}
