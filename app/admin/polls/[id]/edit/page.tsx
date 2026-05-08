'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useApi } from '@/lib/hooks/useApi';
import { PollForm, PollFormData } from '@/components/admin/PollForm';
import { ResponsivePollCanvas } from '@/components/canvas/ResponsivePollCanvas';

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
  position: { x: number; y: number; width: number; height: number } | null;
  displayOrder: number;
}

export default function EditPollPage() {
  const router = useRouter();
  const params = useParams();
  const pollId = params.id as string;
  const { get, post, patch, del, isLoaded } = useApi();

  const [poll, setPoll] = useState<PollData | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Question form state
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [questionOptions, setQuestionOptions] = useState<string[]>(['', '']);
  const [allowCustom, setAllowCustom] = useState(false);
  const [questionSaving, setQuestionSaving] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const pollRes = await get<PollData>(`/api/polls/${pollId}`);
    if (pollRes.error) {
      setFetchError(pollRes.error.message || 'Failed to load poll.');
      setLoading(false);
      return;
    }
    if (pollRes.data) setPoll(pollRes.data);

    const qRes = await get<QuestionData[]>(`/api/polls/${pollId}/questions`);
    if (qRes.data) setQuestions(qRes.data);
    setLoading(false);
  }, [pollId, get]);

  useEffect(() => {
    if (!isLoaded) return;
    fetchData();
  }, [isLoaded, fetchData]);

  async function handlePollSubmit(data: PollFormData) {
    // Upload image first if one was selected
    if (data.imageFile) {
      const formData = new FormData();
      formData.append('file', data.imageFile);

      const uploadRes = await fetch(`/api/polls/${pollId}/upload`, {
        method: 'POST',
        headers: { 'x-admin-token': localStorage.getItem('adminToken') || '' },
        body: formData,
      });

      if (!uploadRes.ok) {
        const body = await uploadRes.json();
        throw new Error(body.error?.message || 'Failed to upload image.');
      }

      const updatedPoll = await uploadRes.json();
      setPoll(updatedPoll);
    }

    // Update title and description
    const result = await patch(`/api/polls/${pollId}`, {
      title: data.title,
      description: data.description || undefined,
    });
    if (result.error) {
      throw new Error(result.error.message || 'Failed to update poll.');
    }
    if (result.data) setPoll(result.data as PollData);
  }

  function resetQuestionForm() {
    setQuestionText('');
    setQuestionOptions(['', '']);
    setAllowCustom(false);
    setEditingQuestion(null);
    setShowQuestionForm(false);
    setQuestionError(null);
  }

  function startEditQuestion(q: QuestionData) {
    setEditingQuestion(q);
    setQuestionText(q.text);
    setQuestionOptions(q.options.length >= 2 ? [...q.options] : [...q.options, '', '']);
    setAllowCustom(q.allowCustom);
    setShowQuestionForm(true);
    setQuestionError(null);
  }

  async function handleSaveQuestion() {
    setQuestionError(null);
    const trimmedText = questionText.trim();
    const trimmedOptions = questionOptions.map(o => o.trim()).filter(o => o.length > 0);

    if (!trimmedText) {
      setQuestionError('Question text is required.');
      return;
    }
    if (trimmedOptions.length < 2) {
      setQuestionError('At least 2 options are required.');
      return;
    }
    if (trimmedOptions.length > 10) {
      setQuestionError('Maximum 10 options allowed.');
      return;
    }

    setQuestionSaving(true);

    if (editingQuestion) {
      // Update existing question
      const result = await patch(`/api/polls/${pollId}/questions/${editingQuestion.id}`, {
        text: trimmedText,
        options: trimmedOptions,
        allowCustom,
      });
      if (result.error) {
        setQuestionError(result.error.message || 'Failed to update question.');
        setQuestionSaving(false);
        return;
      }
    } else {
      // Create new question
      const result = await post(`/api/polls/${pollId}/questions`, {
        text: trimmedText,
        options: trimmedOptions,
        allowCustom,
        displayOrder: questions.length,
        position: null,
      });
      if (result.error) {
        setQuestionError(result.error.message || 'Failed to create question.');
        setQuestionSaving(false);
        return;
      }
    }

    setQuestionSaving(false);
    resetQuestionForm();
    // Refresh questions
    const qRes = await get<QuestionData[]>(`/api/polls/${pollId}/questions`);
    if (qRes.data) setQuestions(qRes.data);
  }

  async function handleDeleteQuestion(qId: string) {
    if (!confirm('Delete this question?')) return;
    const result = await del(`/api/polls/${pollId}/questions/${qId}`);
    if (result.error) {
      alert(result.error.message || 'Failed to delete question.');
      return;
    }
    setQuestions(prev => prev.filter(q => q.id !== qId));
  }

  const handlePositionChange = useCallback(async (questionId: string, position: { x: number; y: number; width: number; height: number }) => {
    await patch(`/api/polls/${pollId}/questions/${questionId}`, { position });
    setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, position } : q));
  }, [pollId, patch]);

  const handleRemoveFromCanvas = useCallback(async (questionId: string) => {
    await patch(`/api/polls/${pollId}/questions/${questionId}`, { position: null });
    setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, position: null } : q));
  }, [pollId, patch]);

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
        <p style={{ color: 'var(--color-error-600)', marginBottom: 'var(--space-4)' }}>{fetchError}</p>
        <button onClick={() => router.push('/admin')} style={{ padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-primary-700)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {/* Poll Metadata */}
      <section aria-label="Edit poll" style={{ maxWidth: '600px' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-6)' }}>
          Edit Poll
        </h1>
        <PollForm
          initialData={{ title: poll.title, description: poll.description ?? '', backgroundImageUrl: poll.backgroundImageUrl }}
          onSubmit={handlePollSubmit}
          submitLabel="Save Changes"
        />
      </section>

      {/* Questions Section */}
      <section aria-label="Manage questions">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>
            Questions ({questions.length}/20)
          </h2>
          {!showQuestionForm && (
            <button
              onClick={() => { resetQuestionForm(); setShowQuestionForm(true); }}
              disabled={questions.length >= 20}
              style={{ padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-primary-700)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: questions.length >= 20 ? 'not-allowed' : 'pointer', opacity: questions.length >= 20 ? 0.5 : 1, fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)' }}
            >
              + Add Question
            </button>
          )}
        </div>

        {/* Question Form */}
        {showQuestionForm && (
          <div style={{ padding: 'var(--space-4)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', backgroundColor: 'var(--color-bg-secondary)' }}>
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-3)' }}>
              {editingQuestion ? 'Edit Question' : 'New Question'}
            </h3>

            {questionError && (
              <p style={{ color: 'var(--color-error-600)', marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>{questionError}</p>
            )}

            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label htmlFor="q-text" style={{ display: 'block', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>
                Question Text *
              </label>
              <input
                id="q-text"
                type="text"
                value={questionText}
                onChange={e => setQuestionText(e.target.value)}
                maxLength={500}
                placeholder="e.g., What went well this sprint?"
                style={{ width: '100%', padding: 'var(--space-2)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-base)' }}
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{questionText.length}/500</span>
            </div>

            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label style={{ display: 'block', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>
                Options (2–10) *
              </label>
              {questionOptions.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                  <input
                    type="text"
                    value={opt}
                    onChange={e => {
                      const updated = [...questionOptions];
                      updated[i] = e.target.value;
                      setQuestionOptions(updated);
                    }}
                    placeholder={`Option ${i + 1}`}
                    style={{ flex: 1, padding: 'var(--space-2)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)' }}
                  />
                  {questionOptions.length > 2 && (
                    <button
                      onClick={() => setQuestionOptions(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ padding: 'var(--space-1) var(--space-2)', backgroundColor: 'var(--color-error-50)', border: '1px solid var(--color-error-300)', borderRadius: 'var(--radius-sm)', color: 'var(--color-error-700)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {questionOptions.length < 10 && (
                <button
                  onClick={() => setQuestionOptions(prev => [...prev, ''])}
                  style={{ marginTop: 'var(--space-1)', padding: 'var(--space-1) var(--space-3)', backgroundColor: 'transparent', border: '1px dashed var(--color-border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}
                >
                  + Add Option
                </button>
              )}
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowCustom}
                  onChange={e => setAllowCustom(e.target.checked)}
                />
                <span style={{ fontSize: 'var(--font-size-sm)' }}>Allow custom free-text answer</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={handleSaveQuestion}
                disabled={questionSaving}
                style={{ padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-primary-700)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)', opacity: questionSaving ? 0.7 : 1 }}
              >
                {questionSaving ? 'Saving...' : editingQuestion ? 'Update Question' : 'Add Question'}
              </button>
              <button
                onClick={resetQuestionForm}
                style={{ padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Question List */}
        {questions.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
            No questions yet. Click &quot;+ Add Question&quot; to create your first question.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {questions.sort((a, b) => a.displayOrder - b.displayOrder).map((q, idx) => (
              <li key={q.id} style={{ padding: 'var(--space-3)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-1)' }}>
                    {idx + 1}. {q.text}
                  </p>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    Options: {q.options.join(', ')}{q.allowCustom ? ' + Custom' : ''}
                  </p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {q.position ? `Canvas: (${q.position.x.toFixed(0)}%, ${q.position.y.toFixed(0)}%)` : 'Not placed on canvas'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button
                    onClick={() => startEditQuestion(q)}
                    style={{ padding: 'var(--space-1) var(--space-2)', backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    style={{ padding: 'var(--space-1) var(--space-2)', backgroundColor: 'var(--color-error-50)', border: '1px solid var(--color-error-300)', borderRadius: 'var(--radius-sm)', color: 'var(--color-error-700)', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Canvas Editor */}
      {questions.length > 0 && (
        <section aria-label="Visual canvas editor">
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-4)' }}>
            Visual Canvas Editor
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
            Drag questions from the sidebar onto the canvas to position them. Participants will see questions placed at these positions on desktop.
          </p>
          <ResponsivePollCanvas
            pollId={pollId}
            questions={questions}
            backgroundImageUrl={poll.backgroundImageUrl}
            onQuestionPositionChange={handlePositionChange}
            onQuestionRemoveFromCanvas={handleRemoveFromCanvas}
          />
        </section>
      )}
    </div>
  );
}
