'use client';

type RevealStage = 'HIDDEN' | 'COUNTS' | 'DETAILS';

interface OptionResult {
  label: string;
  count: number;
  percentage: number;
  participants?: string[];
}

interface CustomResponse {
  text: string;
  participantLabel: string;
}

interface QuestionResult {
  questionId: string;
  questionText: string;
  options: OptionResult[];
  customResponses: CustomResponse[];
  totalResponses: number;
}

interface AggregatedResults {
  questions: QuestionResult[];
  participantCount: number;
  submissionCount: number;
}

export interface ResultsDisplayProps {
  results: AggregatedResults;
  revealStage: RevealStage;
  anonymise: boolean;
}

/**
 * Displays aggregated poll results respecting the current reveal stage.
 *
 * - HIDDEN: shows a "Results are hidden" message
 * - COUNTS: shows option counts, percentages, and bar charts (no custom responses)
 * - DETAILS: shows everything including free-text custom responses with participant labels
 */
export function ResultsDisplay({ results, revealStage, anonymise }: ResultsDisplayProps) {
  if (revealStage === 'HIDDEN') {
    return (
      <div
        role="status"
        aria-label="Results hidden"
        style={{
          padding: 'var(--space-6)',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-base)',
        }}
      >
        Results are hidden
      </div>
    );
  }

  if (results.questions.length === 0) {
    return (
      <div
        role="status"
        style={{
          padding: 'var(--space-4)',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        No questions available.
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      aria-label="Poll results"
    >
      {results.questions.map((question) => (
        <QuestionResultCard
          key={question.questionId}
          question={question}
          revealStage={revealStage}
          anonymise={anonymise}
        />
      ))}
    </div>
  );
}

/**
 * Renders a single question's aggregated results with bar charts.
 */
function QuestionResultCard({
  question,
  revealStage,
  anonymise,
}: {
  question: QuestionResult;
  revealStage: RevealStage;
  anonymise: boolean;
}) {
  return (
    <div
      style={{
        padding: 'var(--space-4)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <h3
        style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--space-3)',
        }}
      >
        {question.questionText}
      </h3>

      {question.totalResponses === 0 ? (
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          No responses yet
        </p>
      ) : (
        <>
          {/* Option bars with counts and percentages */}
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
            role="list"
            aria-label={`Results for ${question.questionText}`}
          >
            {question.options.map((opt) => (
              <div
                key={opt.label}
                role="listitem"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-primary)',
                      minWidth: '80px',
                    }}
                  >
                    {opt.label}
                  </div>
                  <div
                    style={{
                      width: '120px',
                      height: '8px',
                      backgroundColor: 'var(--color-neutral-200)',
                      borderRadius: 'var(--radius-full)',
                      overflow: 'hidden',
                    }}
                    role="progressbar"
                    aria-valuenow={opt.percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${opt.label}: ${opt.percentage}%`}
                  >
                    <div
                      style={{
                        width: `${opt.percentage}%`,
                        height: '100%',
                        backgroundColor: 'var(--color-primary-500)',
                        borderRadius: 'var(--radius-full)',
                        transition: 'width var(--transition-normal)',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                      minWidth: '60px',
                      textAlign: 'right',
                    }}
                  >
                    {opt.count} ({opt.percentage}%)
                  </div>
                </div>
                {revealStage === 'DETAILS' && opt.participants && opt.participants.length > 0 && (
                  <div
                    style={{
                      paddingLeft: 'var(--space-2)',
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {opt.participants.map((name, idx) => (
                      <span
                        key={idx}
                        style={{ fontWeight: 'var(--font-weight-medium)' }}
                      >
                        {name}{idx < opt.participants!.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Free-text custom responses — only shown in DETAILS stage */}
          {revealStage === 'DETAILS' && question.customResponses.length > 0 && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <h4
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                Custom
              </h4>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
              >
                {question.customResponses.map((cr, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--color-bg-tertiary)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                      {cr.participantLabel}:
                    </span>{' '}
                    {cr.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
