'use client';

import { useState, useRef, FormEvent } from 'react';
import { isAllowedImageType, isAllowedImageSize } from '@/lib/validators/imageValidator';
import { TeamSelector } from './TeamSelector';

export interface PollFormData {
  title: string;
  description: string;
  imageFile: File | null;
  teamId: string;
}

interface PollFormProps {
  initialData?: {
    title: string;
    description: string;
    backgroundImageUrl?: string | null;
    teamId?: string | null;
  };
  onSubmit: (data: PollFormData) => Promise<void>;
  submitLabel: string;
  isEdit?: boolean;
}

interface FieldErrors {
  title?: string;
  description?: string;
  image?: string;
  teamId?: string;
}

/**
 * Shared form component for creating and editing polls.
 * Handles client-side validation for title, description, and image file.
 */
export function PollForm({ initialData, onSubmit, submitLabel, isEdit = false }: PollFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [teamId, setTeamId] = useState(initialData?.teamId ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function validate(): FieldErrors {
    const fieldErrors: FieldErrors = {};

    if (!title.trim()) {
      fieldErrors.title = 'Title is required.';
    } else if (title.length > 200) {
      fieldErrors.title = 'Title must be 200 characters or fewer.';
    }

    if (description.length > 1000) {
      fieldErrors.description = 'Description must be 1000 characters or fewer.';
    }

    if (imageFile) {
      if (!isAllowedImageType(imageFile.type)) {
        fieldErrors.image = 'Only JPEG, PNG, and WebP images are allowed.';
      } else if (!isAllowedImageSize(imageFile.size)) {
        fieldErrors.image = 'Image must be 5 MB or smaller.';
      }
    }

    // teamId required for new polls, optional for editing legacy polls
    if (!isEdit && !teamId) {
      fieldErrors.teamId = 'Team selection is required for new polls.';
    }

    return fieldErrors;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);

    // Clear image error when user selects a new file
    if (errors.image) {
      setErrors((prev) => ({ ...prev, image: undefined }));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const fieldErrors = validate();
    setErrors(fieldErrors);

    if (Object.keys(fieldErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ title: title.trim(), description: description.trim(), imageFile, teamId });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {submitError && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
            backgroundColor: 'var(--color-error-50)',
            border: '1px solid var(--color-error-300)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-error-700)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {submitError}
        </div>
      )}

      {/* Team selector */}
      <TeamSelector
        value={teamId}
        onChange={(id) => {
          setTeamId(id);
          if (errors.teamId) setErrors((prev) => ({ ...prev, teamId: undefined }));
        }}
        required={!isEdit}
        error={errors.teamId}
      />

      {/* Title field */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <label
          htmlFor="poll-title"
          style={{
            display: 'block',
            fontWeight: 'var(--font-weight-medium)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Title <span aria-hidden="true">*</span>
        </label>
        <input
          id="poll-title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
          }}
          maxLength={200}
          required
          aria-required="true"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'poll-title-error' : undefined}
          placeholder="Enter poll title"
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            border: `1px solid ${errors.title ? 'var(--color-error-500)' : 'var(--color-border-strong)'}`,
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-base)',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 'var(--space-1)',
          }}
        >
          {errors.title ? (
            <p
              id="poll-title-error"
              role="alert"
              style={{
                color: 'var(--color-error-600)',
                fontSize: 'var(--font-size-sm)',
                margin: 0,
              }}
            >
              {errors.title}
            </p>
          ) : (
            <span />
          )}
          <span
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            {title.length}/200
          </span>
        </div>
      </div>

      {/* Description field */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <label
          htmlFor="poll-description"
          style={{
            display: 'block',
            fontWeight: 'var(--font-weight-medium)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Description
        </label>
        <textarea
          id="poll-description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
          }}
          maxLength={1000}
          rows={4}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? 'poll-description-error' : undefined}
          placeholder="Optional description for this poll"
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            border: `1px solid ${errors.description ? 'var(--color-error-500)' : 'var(--color-border-strong)'}`,
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-base)',
            resize: 'vertical',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 'var(--space-1)',
          }}
        >
          {errors.description ? (
            <p
              id="poll-description-error"
              role="alert"
              style={{
                color: 'var(--color-error-600)',
                fontSize: 'var(--font-size-sm)',
                margin: 0,
              }}
            >
              {errors.description}
            </p>
          ) : (
            <span />
          )}
          <span
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            {description.length}/1000
          </span>
        </div>
      </div>

      {/* Image upload field */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label
          htmlFor="poll-image"
          style={{
            display: 'block',
            fontWeight: 'var(--font-weight-medium)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Background Image
        </label>
        {initialData?.backgroundImageUrl && !imageFile && (
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Current image set. Upload a new file to replace it.
          </p>
        )}
        <input
          id="poll-image"
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          aria-invalid={!!errors.image}
          aria-describedby="poll-image-help poll-image-error"
          style={{
            display: 'block',
            fontSize: 'var(--font-size-sm)',
          }}
        />
        <p
          id="poll-image-help"
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-xs)',
            marginTop: 'var(--space-1)',
            marginBottom: 0,
          }}
        >
          JPEG, PNG, or WebP. Max 5 MB.
        </p>
        {errors.image && (
          <p
            id="poll-image-error"
            role="alert"
            style={{
              color: 'var(--color-error-600)',
              fontSize: 'var(--font-size-sm)',
              marginTop: 'var(--space-1)',
              marginBottom: 0,
            }}
          >
            {errors.image}
          </p>
        )}
        {imageFile && !errors.image && (
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-xs)',
              marginTop: 'var(--space-1)',
              marginBottom: 0,
            }}
          >
            Selected: {imageFile.name} ({(imageFile.size / (1024 * 1024)).toFixed(2)} MB)
            {/* TODO: Actual upload to Supabase Storage will be wired in task 15.1 */}
          </p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: 'var(--space-3) var(--space-6)',
          backgroundColor: submitting ? 'var(--color-primary-400)' : 'var(--color-primary-700)',
          color: 'var(--color-text-on-primary)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-semibold)',
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
