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
// Draft persistence
//
// In-progress votes used to live in memory only, so a reload — or a phone
// discarding a backgrounded tab mid-session — wiped them. That is the retro
// vote-loss bug: cards added during a session forced participants to reload,
// and every reload silently cleared their answers. Mirror the draft into
// localStorage, scoped per poll + session token so a shared device never shows
// one participant another's answers.
// --------------------------------------------------------------------------

export interface ParticipantDraft {
  selections: Record<string, string>;
  customTexts: Record<string, string>;
}

export function draftStorageKey(pollId: string, sessionToken: string): string {
  return `sp_draft_${pollId}_${sessionToken}`;
}

/** localStorage is unavailable during SSR and throws in Safari private mode. */
function draftStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadDraft(pollId: string, sessionToken: string): ParticipantDraft | null {
  const store = draftStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(draftStorageKey(pollId, sessionToken));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ParticipantDraft> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      selections:
        parsed.selections && typeof parsed.selections === 'object' ? parsed.selections : {},
      customTexts:
        parsed.customTexts && typeof parsed.customTexts === 'object' ? parsed.customTexts : {},
    };
  } catch {
    return null;
  }
}

export function saveDraft(pollId: string, sessionToken: string, draft: ParticipantDraft): void {
  const store = draftStorage();
  if (!store) return;
  try {
    store.setItem(draftStorageKey(pollId, sessionToken), JSON.stringify(draft));
  } catch {
    // Quota or private mode — failing to store a draft must never break voting.
  }
}

export function clearDraft(pollId: string, sessionToken: string): void {
  const store = draftStorage();
  if (!store) return;
  try {
    store.removeItem(draftStorageKey(pollId, sessionToken));
  } catch {
    // ignore
  }
}

// --------------------------------------------------------------------------
// Live board reconciliation
//
// The board changes during a live session (cards are added and removed). Keep
// the card list in state so it can be refreshed, while never dropping a vote
// on a card that is still part of the board.
// --------------------------------------------------------------------------

function sortByDisplayOrder(questions: Question[]): Question[] {
  return [...questions].sort((a, b) => a.displayOrder - b.displayOrder);
}

function boardSignature(questions: Question[]): string {
  return questions
    .map((q) => `${q.id}:${q.displayOrder}:${q.text}:${q.options.join('|')}`)
    .join('§');
}

/** Drop entry keys that are no longer on the board; same object if unchanged. */
function pruneToBoard<T>(previous: Record<string, T>, ids: Set<string>): Record<string, T> {
  let changed = false;
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(previous)) {
    if (ids.has(key)) {
      next[key] = value;
    } else {
      changed = true;
    }
  }
  return changed ? next : previous;
}

/**
 * Drop selections whose card was removed, and selections whose chosen option no
 * longer exists on that card (a renamed/removed option would otherwise submit a
 * stale label that the results view cannot count).
 */
function pruneSelectionsToBoard(
  previous: Record<string, string>,
  board: Question[],
): Record<string, string> {
  const byId = new Map(board.map((q) => [q.id, q]));
  let changed = false;
  const next: Record<string, string> = {};

  for (const [questionId, selection] of Object.entries(previous)) {
    const question = byId.get(questionId);
    if (!question) {
      changed = true;
      continue;
    }
    if (selection === CUSTOM_OPTION_VALUE || question.options.includes(selection)) {
      next[questionId] = selection;
    } else {
      changed = true;
    }
  }

  return changed ? next : previous;
}

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
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Facilitator state (polled)
  const [facilitatorState, setFacilitatorState] = useState<FacilitatorState>(initialFacilitatorState);
  // The card list is live: the facilitator adds/removes cards mid-session.
  const [questions, setQuestions] = useState<Question[]>(() => sortByDisplayOrder(poll.questions));
  // Viewport
  const [isMobile, setIsMobile] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const draftRestoredRef = useRef(false);

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
  // Live board + draft persistence
  // --------------------------------------------------------------------------

  /**
   * Apply the board sent by the server. Votes already cast on cards that are
   * still present are kept; votes for cards that were removed (or whose chosen
   * option no longer exists) are dropped so nothing stale is ever submitted.
   */
  const applyBoard = useCallback((incoming: Question[]) => {
    const next = sortByDisplayOrder(incoming);
    const ids = new Set(next.map((q) => q.id));

    setQuestions((prev) => (boardSignature(prev) === boardSignature(next) ? prev : next));
    setSelections((prev) => pruneSelectionsToBoard(prev, next));
    setCustomTexts((prev) => pruneToBoard(prev, ids));
    setErrors((prev) => pruneToBoard(prev, ids));
  }, []);

  // Stay in step if the parent re-renders with a refreshed poll.
  useEffect(() => {
    applyBoard(poll.questions);
  }, [poll.questions, applyBoard]);

  // Restore any draft saved before a reload / mobile tab eviction.
  useEffect(() => {
    const draft = loadDraft(pollId, sessionToken);
    if (draft) {
      setSelections(draft.selections);
      setCustomTexts(draft.customTexts);
    }
  }, [pollId, sessionToken]);

  // Persist the draft as the participant votes. The first pass is skipped so an
  // as-yet-unrestored empty state can never overwrite a stored draft.
  useEffect(() => {
    if (!draftRestoredRef.current) {
      draftRestoredRef.current = true;
      return;
    }
    if (isSubmitted) {
      clearDraft(pollId, sessionToken);
      return;
    }
    saveDraft(pollId, sessionToken, { selections, customTexts });
  }, [selections, customTexts, isSubmitted, pollId, sessionToken]);

  // --------------------------------------------------------------------------
  // Poll facilitator state and the board every 3 seconds
  // --------------------------------------------------------------------------

  const pollFacilitatorState = useCallback(async () => {
    try {
      const res = await fetch(`/api/polls/${pollId}/public`);
      if (res.ok) {
        const data = await res.json();
        if (data.facilitatorState) {
          setFacilitatorState(data.facilitatorState);
        }
        // Cards added or removed during the session must reach participants
        // without a reload: reloading used to cost them their answers.
        if (Array.isArray(data.questions)) {
          applyBoard(data.questions as Question[]);
        }
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [pollId, applyBoard]);

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

    for (const question of questions) {
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
    setSubmitError(null);

    const answers: Answer[] = questions.map((question) => {
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
    } catch (err: any) {
      setSubmitError(err?.message || 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCopyAnswers() {
    const textParts: string[] = [];
    for (const question of questions) {
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

  const sortedQuestions = questions;

  const hasCanvasPositions = questions.some((q) => q.position !== null);
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
          questions={questions}
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
          backgroundImageUrl={poll.backgroundImageUrl}
          selections={selections}
          customTexts={customTexts}
          errors={errors}
          onOptionSelect={handleOptionSelect}
          onCustomTextChange={handleCustomTextChange}
          disabled={votingClosed}
        />
      )}

      {/* Submit Error */}
      {submitError && (
        <div
          role="alert"
          style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-error-50)',
            border: '1px solid var(--color-error-300)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-error-700)',
            fontSize: 'var(--font-size-sm)',
            textAlign: 'center',
          }}
        >
          {submitError}
        </div>
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

export interface LayoutProps {
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
// StickyImageContainer — sticky background image for mobile
// --------------------------------------------------------------------------

export interface StickyImageContainerProps {
  imageUrl: string;
}

export function StickyImageContainer({ imageUrl }: StickyImageContainerProps) {
  const [isVisible, setIsVisible] = useState(true);

  function handleImageError() {
    setIsVisible(false);
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="img"
      aria-label="Poll background image"
      style={{
        position: 'sticky',
        top: 0,
        width: '100vw',
        marginLeft: 'calc(-50vw + 50%)',
        aspectRatio: '16 / 9',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      <img
        src={imageUrl}
        alt=""
        onError={handleImageError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </div>
  );
}

// --------------------------------------------------------------------------
// ListLayout — vertical list for mobile
// --------------------------------------------------------------------------

export function ListLayout({
  questions,
  backgroundImageUrl,
  selections,
  customTexts,
  errors,
  onOptionSelect,
  onCustomTextChange,
  disabled,
}: LayoutProps) {
  return (
    <div role="list" aria-label="Poll questions">
      {backgroundImageUrl && (
        <StickyImageContainer imageUrl={backgroundImageUrl} />
      )}
      <div>
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
