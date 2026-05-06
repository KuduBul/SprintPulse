'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useApi } from '@/lib/hooks/useApi';
import { FacilitatorDashboard } from '@/components/facilitator/FacilitatorDashboard';
import Link from 'next/link';

interface PollData {
  id: string;
  title: string;
  description: string | null;
  backgroundImageUrl: string | null;
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
  const { get } = useApi();

  const [poll, setPoll] = useState<PollData | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

        // Fetch questions - the poll GET may include them, or we fetch separately
        // Based on the API structure, questions are fetched via the poll's public endpoint
        // or we can use the admin poll endpoint which may include questions
        const questionsRes = await get<QuestionData[]>(
          `/api/polls/${pollId}/questions`
        );
        if (questionsRes.data) {
          setQuestions(questionsRes.data);
        }
      } catch {
        setError('An unexpected error occurred.');
      }
      setLoading(false);
    }

    fetchData();
  }, [pollId, get]);

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
          Back to Polls
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

  return (
    <FacilitatorDashboard
      pollId={pollId}
      poll={poll}
      questions={questions}
    />
  );
}
