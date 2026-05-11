'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Question {
  id: string;
  text: string;
  options: string[];
  allowCustom: boolean;
  position: Position | null;
  displayOrder: number;
}

interface FacilitatorState {
  votingOpen: boolean;
  liveResults: boolean;
  anonymise: boolean;
  revealStage: string;
}

interface PublicPollView {
  id: string;
  title: string;
  description: string | null;
  backgroundImageUrl: string | null;
  facilitatorState: FacilitatorState;
  questions: Question[];
}

interface Answer {
  questionId: string;
  selectedOption: string;
  customText?: string;
}

interface SubmitResponsesInput {
  participantName: string;
  sessionToken: string;
  answers: Answer[];
  isTest: boolean;
}

export interface ParticipantFormProps {
  poll: PublicPollView;
  facilitatorState: FacilitatorState;
  onSubmit: (responses: SubmitResponsesInput) => Promise<void>;
  participantName: string;
  sessionToken: string;
  pollId: string;
  isTestMode?: boolean;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const CUSTOM_OPTION_VALUE = '__custom__';
const POLL_INTERVAL_MS = 3000;

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export function ParticipantForm({
  poll,
  facilitatorState: initialFacilitatorState,
  onSubmit,
  participantName,
  sessionToken,
  pollId,
  isTestMode = false,
}: ParticipantFormProps) {
  // State for answers: questionId -> selectedOption
  const [selections, setSelections] = useState<Record<string, string>>({});
  // State for custom text: questionId -> text
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});
  // Validation errors: questionId -> error message
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  // Facilitator state (polled)
  const [facilitatorState, setFacilitatorState] = useState<FacilitatorState>(initialFacilitatorState);
  // Viewport
  const [isMobile, setIsMobile] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // --------------------------------------------------------------------------
  // Responsive detection
  // --------------------------------------------------------------------------

  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // --------------------------------------------------------------------------
  // Poll facilitator state every 3 seconds
  // --------------------------------------------------------------------------

  const pollFacilitatorState = useCallback(async () => {
    try {
      const res = await fetch(`/api/polls/${pollId}/public`);
      if (res.ok) {
        const data = await res.json();
        if (data.facilitatorState) {
          setFacilitatorState(data.facilitatorState);
        }
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [pollId]);

  useEffect(() => {
    // Don't poll if already submitted
    if (isSubmitted) return;

    pollingRef.current = setInterval(pollFacilitatorState, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [pollFacilitatorState, isSubmitted]);

  // --------------------------------------------------------------------------
  // Derived state
  // --------------------------------------------------------------------------

  const votingClosed = !facilitatorState.votingOpen;

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  function handleOptionSelect(questionId: string, option: string) {
    setSelections((prev) => ({ ...prev, [questionId]: option }));
    // Clear error for this question
    setErrors((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }

  function handleCustomTextChange(questionId: string, text: string) {
    setCustomTexts((prev) => ({ ...prev, [questionId]: text }));
    // Clear error if text is now non-empty
    if (text.trim()) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    for (const question of poll.questions) {
      const selection = selections[question.id];
      if (!selection) {
        newErrors[question.id] = 'Please select an option';
      } else if (selection === CUSTOM_OPTION_VALUE) {
        const customText = customTexts[question.id]?.trim();
        if (!customText) {
          newErrors[question.id] = 'Please enter your custom answer';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (votingClosed || isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);

    const answers: Answer[] = poll.questions.map((question) => {
      const selection = selections[question.id];
      const answer: Answer = {
        questionId: question.id,
        selectedOption: selection === CUSTOM_OPTION_VALUE ? 'Custom' : selection,
      };
      if (selection === CUSTOM_OPTION_VALUE) {
        answer.customText = customTexts[question.id]?.trim();
      }
      return answer;
    });

    try {
      await onSubmit({
        participantName,
        sessionToken,
        answers,
        isTest: isTestMode,
      });
      setIsSubmitted(true);
    } catch {
      // Error handling is done by the parent
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCopyAnswers() {
    const textParts: string[] = [];
    for (const question of poll.questions) {
      const selection = selections[question.id];
      if (selection === CUSTOM_OPTION_VALUE) {
        const customText = customTexts[question.id] || '';
        textParts.push(`${question.text}: ${customText}`);
      } else if (selection) {
        textParts.push(`${question.text}: ${selection}`);
      }
    }
    const text = textParts.join('\n');
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback: select text in a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  }

  // --------------------------------------------------------------------------
  // Confirmation screen
  // --------------------------------------------------------------------------

  if (isSubmitted) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          textAlign: 'center',
          padding: 'var(--space-8)',
        }}
      >
        <div
          style={{
            padding: 'var(--space-8)',
            backgroundColor: 'var(--color-success-50)',
            border: '1px solid var(--color-success-300)',
            borderRadius: 'var(--radius-lg)',
            maxWidth: '500px',
            margin: '0 auto',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-success-800)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Thank you for your responses!
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            Your answers have been submitted successfully.
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  const sortedQuestions = [...poll.questions].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  const hasCanvasPositions = poll.questions.some((q) => q.position !== null);
  const useCanvasLayout = !isMobile && hasCanvasPositions;

  return (
    <div style={{ position: 'relative' }}>
      {/* Voting closed banner */}
      {votingClosed && (
        <div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-warning-50)',
            border: '1px solid var(--color-warning-300)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              color: 'var(--color-warning-800)',
              fontWeight: 'var(--font-weight-semibold)',
            }}
          >
            Voting has been closed by the facilitator
          </p>
        </div>
      )}

      {/* Questions */}
      {useCanvasLayout ? (
        <CanvasLayout
          questions={poll.questions}
          backgroundImageUrl={poll.backgroundImageUrl}
          selections={selections}
          customTexts={customTexts}
          errors={errors}
          onOptionSelect={handleOptionSelect}
          onCustomTextChange={handleCustomTextChange}
          disabled={votingClosed}
        />
      ) : (
        <ListLayout
          questions={sortedQuestions}
          selections={selections}
          customTexts={customTexts}
          errors={errors}
          onOptionSelect={handleOptionSelect}
          onCustomTextChange={handleCustomTextChange}
          disabled={votingClosed}
        />
      )}

      {/* Actions */}
      <div
        style={{
          marginTop: 'var(--space-8)',
          paddingTop: 'var(--space-4)',
          display: 'flex',
          gap: 'var(--space-3)',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={handleSubmit}
          disabled={votingClosed || isSubmitting}
          aria-busy={isSubmitting}
          style={{
            padding: 'var(--space-3) var(--space-8)',
            backgroundColor: votingClosed
              ? 'var(--color-neutral-300)'
              : 'var(--color-primary-600)',
            color: 'var(--color-text-on-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: votingClosed || isSubmitting ? 'not-allowed' : 'pointer',
            opacity: votingClosed || isSubmitting ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          {isSubmitting && <LoadingSpinner />}
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>

        {votingClosed && (
          <button
            type="button"
            onClick={handleCopyAnswers}
            style={{
              padding: 'var(--space-3) var(--space-6)',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-medium)',
              cursor: 'pointer',
            }}
          >
            Copy answers
          </button>
        )}
      </div>
    </div>
  );
}


// --------------------------------------------------------------------------
// CanvasLayout — renders questions at their canvas positions (desktop)
// --------------------------------------------------------------------------

interface LayoutProps {
  questions: Question[];
  backgroundImageUrl?: string | null;
  selections: Record<string, string>;
  customTexts: Record<string, string>;
  errors: Record<string, string>;
  onOptionSelect: (questionId: string, option: string) => void;
  onCustomTextChange: (questionId: string, text: string) => void;
  disabled: boolean;
}

function CanvasLayout({
  questions,
  backgroundImageUrl,
  selections,
  customTexts,
  errors,
  onOptionSelect,
  onCustomTextChange,
  disabled,
}: LayoutProps) {
  const placedQuestions = questions.filter((q) => q.position !== null);
  const unplacedQuestions = questions
    .filter((q) => q.position === null)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div>
      {/* Canvas area with positioned questions */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '500px',
          paddingBottom: '56.25%', // 16:9 aspect ratio
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '2px solid var(--color-border-strong)',
          backgroundColor: backgroundImageUrl ? undefined : 'var(--color-bg-canvas)',
          backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
        role="region"
        aria-label="Poll questions canvas"
      >
        {placedQuestions.map((question, index) => {
          const pos = question.position!;
          return (
            <div
              key={question.id}
              style={{
                position: 'absolute',
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${pos.width}%`,
                maxHeight: `${100 - pos.y}%`,
                zIndex: index + 1,
                backgroundColor: 'rgba(255, 255, 255, 0.97)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-3)',
                boxShadow: 'var(--shadow-md)',
                overflow: 'auto',
              }}
              aria-label={question.text}
            >
              <QuestionCard
                question={question}
                selection={selections[question.id] || ''}
                customText={customTexts[question.id] || ''}
                error={errors[question.id]}
                onOptionSelect={onOptionSelect}
                onCustomTextChange={onCustomTextChange}
                disabled={disabled}
                compact
              />
            </div>
          );
        })}
      </div>

      {/* Unplaced questions rendered as list below canvas */}
      {unplacedQuestions.length > 0 && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          {unplacedQuestions.map((question) => (
            <div
              key={question.id}
              style={{
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <QuestionCard
                question={question}
                selection={selections[question.id] || ''}
                customText={customTexts[question.id] || ''}
                error={errors[question.id]}
                onOptionSelect={onOptionSelect}
                onCustomTextChange={onCustomTextChange}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// ListLayout — vertical list for mobile
// --------------------------------------------------------------------------

function ListLayout({
  questions,
  selections,
  customTexts,
  errors,
  onOptionSelect,
  onCustomTextChange,
  disabled,
}: Omit<LayoutProps, 'backgroundImageUrl'>) {
  return (
    <div role="list" aria-label="Poll questions">
      {questions.map((question) => (
        <div
          key={question.id}
          role="listitem"
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <QuestionCard
            question={question}
            selection={selections[question.id] || ''}
            customText={customTexts[question.id] || ''}
            error={errors[question.id]}
            onOptionSelect={onOptionSelect}
            onCustomTextChange={onCustomTextChange}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------
// QuestionCard — renders a single question with options
// --------------------------------------------------------------------------

interface QuestionCardProps {
  question: Question;
  selection: string;
  customText: string;
  error?: string;
  onOptionSelect: (questionId: string, option: string) => void;
  onCustomTextChange: (questionId: string, text: string) => void;
  disabled: boolean;
  compact?: boolean;
}

function QuestionCard({
  question,
  selection,
  customText,
  error,
  onOptionSelect,
  onCustomTextChange,
  disabled,
  compact = false,
}: QuestionCardProps) {
  const questionLabelId = `question-label-${question.id}`;
  const errorId = `question-error-${question.id}`;

  return (
    <fieldset
      style={{
        border: 'none',
        padding: 0,
        margin: 0,
      }}
      aria-describedby={error ? errorId : undefined}
    >
      <legend
        id={questionLabelId}
        style={{
          fontSize: compact ? 'var(--font-size-sm)' : 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
          marginBottom: compact ? 'var(--space-2)' : 'var(--space-3)',
          display: 'block',
          padding: 0,
        }}
      >
        {question.text}
      </legend>

      <div
        role="radiogroup"
        aria-labelledby={questionLabelId}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? 'var(--space-1)' : 'var(--space-2)',
        }}
      >
        {question.options.map((option) => (
          <label
            key={option}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: compact ? 'var(--space-1) var(--space-2)' : 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${
                selection === option
                  ? 'var(--color-primary-400)'
                  : 'var(--color-border-default)'
              }`,
              backgroundColor:
                selection === option
                  ? 'var(--color-primary-50)'
                  : 'var(--color-bg-primary)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.7 : 1,
              transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
              fontSize: compact ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
            }}
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              value={option}
              checked={selection === option}
              onChange={() => onOptionSelect(question.id, option)}
              disabled={disabled}
              style={{ margin: 0, flexShrink: 0 }}
            />
            <span style={{ color: 'var(--color-text-primary)' }}>{option}</span>
          </label>
        ))}

        {/* Custom option */}
        {question.allowCustom && (
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: compact ? 'var(--space-1) var(--space-2)' : 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${
                  selection === CUSTOM_OPTION_VALUE
                    ? 'var(--color-primary-400)'
                    : 'var(--color-border-default)'
                }`,
                backgroundColor:
                  selection === CUSTOM_OPTION_VALUE
                    ? 'var(--color-primary-50)'
                    : 'var(--color-bg-primary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.7 : 1,
                transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
                fontSize: compact ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
              }}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={CUSTOM_OPTION_VALUE}
                checked={selection === CUSTOM_OPTION_VALUE}
                onChange={() => onOptionSelect(question.id, CUSTOM_OPTION_VALUE)}
                disabled={disabled}
                style={{ margin: 0, flexShrink: 0 }}
              />
              <span style={{ color: 'var(--color-text-primary)' }}>Custom</span>
            </label>

            {/* Custom text input — shown when custom option is selected */}
            {selection === CUSTOM_OPTION_VALUE && (
              <div style={{ marginTop: 'var(--space-2)', paddingLeft: 'var(--space-6)' }}>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => onCustomTextChange(question.id, e.target.value)}
                  placeholder="Enter your answer..."
                  disabled={disabled}
                  maxLength={2000}
                  aria-label={`Custom answer for: ${question.text}`}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: compact ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
                    border: `1px solid ${
                      error ? 'var(--color-error-500)' : 'var(--color-border-default)'
                    }`,
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-primary)',
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p
          id={errorId}
          role="alert"
          style={{
            marginTop: 'var(--space-2)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-error-600)',
            fontWeight: 'var(--font-weight-medium)',
          }}
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}

// --------------------------------------------------------------------------
// LoadingSpinner
// --------------------------------------------------------------------------

function LoadingSpinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: '16px',
        height: '16px',
        border: '2px solid var(--color-neutral-200)',
        borderTopColor: 'var(--color-text-on-primary)',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }}
    />
  );
}
