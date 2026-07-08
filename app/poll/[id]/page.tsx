'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSessionToken } from '@/lib/hooks/useSessionToken';
import { useParticipantToken } from '@/lib/hooks/useParticipantToken';
import { InteractiveRetroBoardView } from '@/components/retro/InteractiveRetroBoardView';
import { ParticipantForm } from '@/components/participant/ParticipantForm';
import { BoardView } from '@/lib/services/retroService';

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
  type?: string;
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
  const [currentSessionToken, setCurrentSessionToken] = useState('');

  // Fetch poll data and check session on mount
  useEffect(() => {
    async function fetchPoll() {
      try {
        // Determine if the ID is a UUID or an access token
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pollId);
        const apiUrl = isUuid
          ? `/api/polls/${pollId}/public`
          : `/api/polls/by-token/${pollId}`;

        const res = await fetch(apiUrl);
        if (res.status === 404 || res.status === 410) {
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

        // Use the actual poll UUID for session checks (pollId might be a token)
        const actualPollId = data.id;

        // Check if session already exists for this poll
        const existingSession = getSession(actualPollId);
        if (existingSession) {
          // Verify with server that the response still exists (may have been reset)
          const checkRes = await fetch(`/api/polls/${actualPollId}/session-check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: existingSession.token }),
          });
          const checkData = await checkRes.json().catch(() => ({ submitted: false }));

          if (checkData.submitted) {
            setParticipantName(existingSession.name);
            setAlreadySubmitted(true);
          } else {
            // Server says no submission exists — clear stale local session
            localStorage.removeItem(`session_${actualPollId}`);
          }
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
      const actualId = poll.id;
      const existingSession = getSession(actualId);
      if (existingSession) {
        setParticipantName(existingSession.name);
        setCurrentSessionToken(existingSession.token);
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

    // Use the actual poll UUID for session storage (not the URL token)
    const actualId = poll?.id || pollId;
    const newToken = createSession(actualId, trimmedName);
    setCurrentSessionToken(newToken);
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

  // Voting closed state — only applies to pulse polls, not retro
  if (poll && poll.type !== 'retro' && !poll.facilitatorState.votingOpen) {
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

  // Retro poll — show the interactive retro board for participants
  if (poll && poll.type === 'retro') {
    return <RetroParticipantView pollId={poll.id} title={poll.title} backgroundImageUrl={poll.backgroundImageUrl} />;
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
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'transparent',
              color: 'var(--color-primary-600)',
              border: '1px solid var(--color-primary-300)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
            }}
          >
            Poll was reset? Click to check again
          </button>
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
            sessionToken={currentSessionToken}
            pollId={poll?.id || pollId}
            isTestMode={isTestMode}
            onSubmit={async (responses) => {
              const actualId = poll?.id || pollId;
              const res = await fetch(`/api/polls/${actualId}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(responses),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error?.message || 'Submission failed');
              }
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

// --------------------------------------------------------------------------
// Retro Participant View — shows the interactive retro board for participants
// --------------------------------------------------------------------------

function RetroParticipantView({ pollId, title, backgroundImageUrl }: { pollId: string; title: string; backgroundImageUrl: string | null }) {
  const { getParticipant, createParticipant, hasParticipant } = useParticipantToken();
  const [board, setBoard] = useState<BoardView | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  // Fetch the retro board for this poll using the dedicated by-poll lookup
  const fetchBoard = useCallback(async () => {
    try {
      const participant = getParticipant(pollId);
      const token = participant?.token ?? '';

      const res = await fetch(`/api/retro/by-poll/${pollId}?role=participant&participantToken=${token}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setBoard(data);
        setBoardId(data.id);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [pollId, getParticipant]);

  useEffect(() => {
    // Only fetch board once participant has a token
    if (hasParticipant(pollId)) {
      fetchBoard();
    } else {
      setLoading(false);
    }
  }, [pollId, hasParticipant, fetchBoard]);

  // Poll the board every 3 seconds so phase changes from the facilitator
  // are reflected automatically (e.g. Gather → Vote transition).
  useEffect(() => {
    if (!hasParticipant(pollId)) return;

    const interval = setInterval(() => {
      fetchBoard();
    }, 3000);

    return () => clearInterval(interval);
  }, [pollId, hasParticipant, fetchBoard]);

  // If no participant token, show name entry
  if (!hasParticipant(pollId)) {
    return (
      <main id="main-content" style={{ padding: 'var(--space-8)', maxWidth: '500px', margin: '0 auto' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)', textAlign: 'center' }}>
          {title}
        </h1>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="participant-name" style={{ display: 'block', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-2)' }}>
            Enter your name to join
          </label>
          <input
            id="participant-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your display name"
            maxLength={50}
            style={{ width: '100%', padding: 'var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-base)' }}
          />
        </div>
        <button
          onClick={() => {
            if (name.trim().length >= 2) {
              createParticipant(pollId, name.trim());
              // Trigger re-render by fetching the board
              fetchBoard();
            }
          }}
          disabled={name.trim().length < 2}
          style={{ width: '100%', padding: 'var(--space-3)', backgroundColor: 'var(--color-primary-700)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', cursor: name.trim().length >= 2 ? 'pointer' : 'not-allowed' }}
        >
          Join Retro
        </button>
      </main>
    );
  }

  if (loading) {
    return (
      <main id="main-content" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p>Loading retro board...</p>
      </main>
    );
  }

  if (!board || !boardId) {
    return (
      <main id="main-content" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)' }}>{title}</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Unable to load retro board. Please try refreshing.</p>
      </main>
    );
  }

  const phaseIndicator = board.phase === 'gather'
    ? { icon: '🟢', label: 'Gathering Cards' }
    : board.phase === 'vote'
    ? { icon: '🗳️', label: 'Voting' }
    : { icon: '🔒', label: 'Closed' };

  return (
    <main id="main-content" style={{ padding: 'var(--space-4)', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Gradient header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-primary-700) 0%, var(--color-primary-500) 50%, var(--color-secondary-500) 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6) var(--space-8)',
        marginBottom: 'var(--space-5)',
        textAlign: 'center',
        boxShadow: 'var(--shadow-md)',
      }}>
        <h1 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-inverse)',
          margin: 0,
          marginBottom: 'var(--space-2)',
        }}>
          {title}
        </h1>
        {/* Phase indicator */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-1) var(--space-3)',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 'var(--radius-full)',
          backdropFilter: 'blur(4px)',
        }}>
          <span style={{ fontSize: 'var(--font-size-sm)' }}>{phaseIndicator.icon}</span>
          <span style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text-inverse)',
          }}>
            {phaseIndicator.label}
          </span>
        </div>
      </div>

      {/* Board with responsive horizontal scroll for >3 columns on mobile */}
      <div style={{
        overflowX: board.lanes.length > 3 ? 'auto' : 'visible',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'var(--space-2)',
      }}>
        <InteractiveRetroBoardView
          board={board}
          boardId={boardId}
          backgroundImageUrl={backgroundImageUrl}
          boardTitle={title}
          participantPollId={pollId}
          onMutate={() => {
            // Small delay to allow the write to propagate through PgBouncer's
            // connection pool before reading back. Without this, the GET may hit
            // a different backend connection that hasn't seen the INSERT yet,
            // returning stale data that clears the optimistic card.
            setTimeout(() => {
              const participant = getParticipant(pollId);
              const token = participant?.token ?? '';
              fetch(`/api/retro/by-poll/${pollId}?role=participant&participantToken=${token}`, {
                cache: 'no-store',
              })
                .then(r => r.ok ? r.json() : null)
                .then(data => { if (data) setBoard(data); });
            }, 500);
          }}
        />
      </div>
    </main>
  );
}
