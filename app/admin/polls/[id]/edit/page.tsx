'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useApi } from '@/lib/hooks/useApi';
import { PollForm, PollFormData } from '@/components/admin/PollForm';

interface PollData {
  id: string;
  title: string;
  description: string | null;
  backgroundImageUrl: string | null;
}

export default function EditPollPage() {
  const router = useRouter();
  const params = useParams();
  const pollId = params.id as string;
  const { get, patch, isLoaded } = useApi();

  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    async function fetchPoll() {
      const result = await get<PollData>(`/api/polls/${pollId}`);

      if (result.error) {
        setFetchError(result.error.message || 'Failed to load poll.');
      } else if (result.data) {
        setPoll(result.data);
      }
      setLoading(false);
    }

    fetchPoll();
  }, [pollId, get, isLoaded]);

  async function handleSubmit(data: PollFormData) {
    // TODO: Image upload to Supabase Storage will be wired in task 15.1.
    // For now, we only send title and description.
    const result = await patch(`/api/polls/${pollId}`, {
      title: data.title,
      description: data.description || undefined,
    });

    if (result.error) {
      throw new Error(result.error.message || 'Failed to update poll.');
    }

    router.push('/admin');
  }

  if (loading) {
    return (
      <section aria-label="Loading poll">
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading poll...</p>
      </section>
    );
  }

  if (fetchError) {
    return (
      <section aria-label="Error loading poll">
        <p style={{ color: 'var(--color-error-600)', marginBottom: 'var(--space-4)' }}>
          {fetchError}
        </p>
        <button
          onClick={() => router.push('/admin')}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: 'var(--color-primary-700)',
            color: 'var(--color-text-on-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
          }}
        >
          Back to Polls
        </button>
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
    <section aria-label="Edit poll" style={{ maxWidth: '600px' }}>
      <h1
        style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--space-6)',
        }}
      >
        Edit Poll
      </h1>
      <PollForm
        initialData={{
          title: poll.title,
          description: poll.description ?? '',
          backgroundImageUrl: poll.backgroundImageUrl,
        }}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
    </section>
  );
}
