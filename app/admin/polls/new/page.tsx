'use client';

import { useRouter } from 'next/navigation';
import { useApi } from '@/lib/hooks/useApi';
import { PollForm, PollFormData } from '@/components/admin/PollForm';

export default function NewPollPage() {
  const router = useRouter();
  const { post } = useApi();

  async function handleSubmit(data: PollFormData) {
    const result = await post('/api/polls', {
      title: data.title,
      description: data.description || undefined,
      teamId: data.teamId,
    });

    if (result.error) {
      throw new Error(result.error.message || 'Failed to create poll.');
    }

    router.push('/admin');
  }

  return (
    <section aria-label="Create new poll" style={{ maxWidth: '600px' }}>
      <h1
        style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--space-6)',
        }}
      >
        Create New Poll
      </h1>
      <PollForm onSubmit={handleSubmit} submitLabel="Create Poll" />
    </section>
  );
}
