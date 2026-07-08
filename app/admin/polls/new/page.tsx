'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/lib/hooks/useApi';
import { PollForm, PollFormData } from '@/components/admin/PollForm';
import {
  ActivityTypeSelector,
  ActivityType,
  RetroConfig,
} from '@/components/admin/ActivityTypeSelector';

export default function NewPollPage() {
  const router = useRouter();
  const { post } = useApi();

  const [activityType, setActivityType] = useState<ActivityType>('pulse');
  const [retroConfig, setRetroConfig] = useState<RetroConfig>({
    template: 'start_stop_continue',
    customLanes: [''],
    votesPerUser: 3,
  });

  async function handleSubmit(data: PollFormData) {
    // Build the request body based on activity type.
    // When activityType is "pulse" (or when the flag is off and the selector
    // doesn't render), this is the existing flow unchanged.
    const body: Record<string, unknown> = {
      title: data.title,
      description: data.description || undefined,
      teamId: data.teamId,
    };

    if (activityType === 'retro') {
      body.type = 'retro';
      body.template = retroConfig.template;
      if (retroConfig.votesPerUser !== 3) {
        body.votesPerUser = retroConfig.votesPerUser;
      }
      // For custom template, send the lane titles
      if (retroConfig.template === 'custom') {
        const lanes = retroConfig.customLanes
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        if (lanes.length === 0) {
          throw new Error('At least one lane title is required for custom templates.');
        }
        body.lanes = lanes;
      }
    }

    const result = await post('/api/polls', body);

    if (result.error) {
      throw new Error(result.error.message || 'Failed to create activity.');
    }

    // Upload background image if one was selected
    if (data.imageFile && result.data) {
      // Retro creation returns { poll, board }; pulse returns the poll directly.
      const created = result.data as { id?: string; poll?: { id: string } };
      const newPollId = created.poll?.id ?? created.id;

      if (!newPollId) {
        console.error('Could not determine created poll id for image upload');
      } else {
        const formData = new FormData();
        formData.append('file', data.imageFile);

        const uploadRes = await fetch(`/api/polls/${newPollId}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          // Poll was created but image failed — don't block navigation
          console.error('Image upload failed after poll creation');
        }
      }
    }

    router.push('/admin');
  }

  return (
    <section aria-label="Create new activity" style={{ maxWidth: '600px' }}>
      <h1
        style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {activityType === 'retro' ? 'Create New Retro' : 'Create New Session'}
      </h1>

      {/* Activity type selector — only visible when RETRO_ENABLED flag is true */}
      <ActivityTypeSelector
        activityType={activityType}
        onActivityTypeChange={setActivityType}
        retroConfig={retroConfig}
        onRetroConfigChange={setRetroConfig}
      />

      <PollForm onSubmit={handleSubmit} submitLabel={activityType === 'retro' ? 'Create Retro' : 'Create Poll'} />
    </section>
  );
}
