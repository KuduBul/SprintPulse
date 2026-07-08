'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useApi } from '@/lib/hooks/useApi';
import { FacilitatorDashboard } from '@/components/facilitator/FacilitatorDashboard';
import { RetroFacilitatorControls } from '@/components/retro/RetroFacilitatorControls';
import Link from 'next/link';

interface PollData {
  id: string;
  title: string;
  description: string | null;
  backgroundImageUrl: string | null;
  accessToken?: string;
  type?: string;
  retroBoard?: { id: string } | null;
}

interface QuestionData {
  id: string;
  text: string;
  options: string[];
  allowCustom: boolean;
  position: unknown;
  displayOrder: number;
}

export default function FacilitatePollPage() {
  const params = useParams();
  const pollId = params.id as string;
  const { get, isLoaded } = useApi();

  const [poll, setPoll] = useState<PollData | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    async function fetchData() {
      try {
        const pollRes = await get<PollData>(`/api/polls/${pollId}`);
        if (pollRes.error) {
          setError(pollRes.error.message || 'Failed to load poll.');
          setLoading(false);
          return;
        }

        if (pollRes.data) {
          setPoll(pollRes.data);
        }

        // For pulse polls, fetch questions
        if (!pollRes.data || pollRes.data.type !== 'retro') {
          const questionsRes = await get<QuestionData[]>(
            `/api/polls/${pollId}/questions`
          );
          if (questionsRes.data) {
            setQuestions(questionsRes.data);
          }
        }
      } catch {
        setError('An unexpected error occurred.');
      }
      setLoading(false);
    }

    fetchData();
  }, [pollId, get, isLoaded]);

  if (loading) {
    return (
      <section aria-label="Loading facilitator dashboard">
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Loading facilitator dashboard...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-label="Error loading facilitator dashboard">
        <p
          style={{
            color: 'var(--color-error-600)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {error}
        </p>
        <Link
          href="/admin"
          style={{
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: 'var(--color-primary-700)',
            color: 'var(--color-text-on-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
          }}
        >
          Back to Sessions
        </Link>
      </section>
    );
  }

  if (!poll) {
    return (
      <section aria-label="Poll not found">
        <p style={{ color: 'var(--color-text-secondary)' }}>Poll not found.</p>
      </section>
    );
  }

  // Retro-type poll: show RetroFacilitatorControls instead of the pulse dashboard
  if (poll.type === 'retro') {
    if (!poll.retroBoard) {
      return (
        <section aria-label="Retro board loading">
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Loading retro board... If this persists, the retro board may not have been created correctly.
          </p>
        </section>
      );
    }
    return (
      <RetroFacilitatorControls
        boardId={poll.retroBoard.id}
        pollTitle={poll.title}
        accessToken={poll.accessToken}
      />
    );
  }

  return (
    <FacilitatorDashboard
      pollId={pollId}
      poll={poll}
      questions={questions}
    />
  );
}
