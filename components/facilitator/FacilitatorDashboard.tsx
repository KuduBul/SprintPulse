'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@/lib/hooks/useApi';
import { ResultsDisplay } from '@/components/results/ResultsDisplay';

type RevealStage = 'HIDDEN' | 'COUNTS' | 'DETAILS';

interface FacilitatorState {
  votingOpen: boolean;
  liveResults: boolean;
  anonymise: boolean;
  revealStage: RevealStage;
}

interface Question {
  id: string;
  text: string;
  options: string[];
  allowCustom: boolean;
  position: unknown;
  displayOrder: number;
}

interface Poll {
  id: string;
  title: string;
  description: string | null;
  backgroundImageUrl: string | null;
}

interface OptionResult {
  label: string;
  count: number;
  percentage: number;
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

export interface FacilitatorDashboardProps {
  pollId: string;
  poll: Poll;
  questions: Question[];
}

export function FacilitatorDashboard({ pollId, poll, questions }: FacilitatorDashboardProps) {
  const { get, patch, post } = useApi();

  const [facilitatorState, setFacilitatorState] = useState<FacilitatorState>({
    votingOpen: false,
    liveResults: false,
    anonymise: true,
    revealStage: 'HIDDEN',
  });
  const [results, setResults] = useState<AggregatedResults | null>(null);
  const [testResults, setTestResults] = useState<AggregatedResults | null>(null);
  const [activeTab, setActiveTab] = useState<'results' | 'test'>('results');
  const [stateAnnouncement, setStateAnnouncement] = useState('');
  const [clearingTest, setClearingTest] = useState(false);
  const [updatingState, setUpdatingState] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastStateUpdateRef = useRef<number>(Date.now());

  // Fetch facilitator state
  const fetchState = useCallback(async () => {
    const res = await get<FacilitatorState>(`/api/polls/${pollId}/facilitator`);
    if (res.data) {
      setFacilitatorState(res.data);
    }
  }, [get, pollId]);

  // Fetch results (real responses)
  const fetchResults = useCallback(async () => {
    const res = await get<AggregatedResults>(`/api/polls/${pollId}/results`);
    if (res.data) {
      setResults(res.data);
    }
  }, [get, pollId]);

  // Fetch test results
  const fetchTestResults = useCallback(async () => {
    const res = await get<AggregatedResults>(
      `/api/polls/${pollId}/results?includeTest=true`
    );
    if (res.data) {
      setTestResults(res.data);
    }
  }, [get, pollId]);

  // Poll state and results every 3 seconds
  useEffect(() => {
    // Initial fetch
    fetchState();
    fetchResults();
    fetchTestResults();

    pollingRef.current = setInterval(() => {
      fetchState();
      fetchResults();
      fetchTestResults();
    }, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchState, fetchResults, fetchTestResults]);

  // Update facilitator state
  const updateState = useCallback(
    async (statePatch: Partial<FacilitatorState>) => {
      setUpdatingState(true);
      const res = await patch<FacilitatorState>(
        `/api/polls/${pollId}/facilitator`,
        statePatch
      );
      if (res.data) {
        setFacilitatorState(res.data);
        lastStateUpdateRef.current = Date.now();

        // Announce state change for screen readers
        const changes: string[] = [];
        if (statePatch.votingOpen !== undefined) {
          changes.push(statePatch.votingOpen ? 'Voting opened' : 'Voting closed');
        }
        if (statePatch.liveResults !== undefined) {
          changes.push(statePatch.liveResults ? 'Live results enabled' : 'Live results disabled');
        }
        if (statePatch.anonymise !== undefined) {
          changes.push(statePatch.anonymise ? 'Anonymisation enabled' : 'Anonymisation disabled');
        }
        if (statePatch.revealStage !== undefined) {
          changes.push(`Reveal stage set to ${statePatch.revealStage}`);
        }
        setStateAnnouncement(changes.join('. '));
      }
      setUpdatingState(false);
    },
    [patch, pollId]
  );

  // Clear test responses
  const handleClearTestResponses = useCallback(async () => {
    setClearingTest(true);
    await post(`/api/polls/${pollId}/reset?testOnly=true`);
    await fetchTestResults();
    setClearingTest(false);
    setStateAnnouncement('Test responses cleared');
  }, [post, pollId, fetchTestResults]);

  // Preview as participant
  const handlePreviewAsParticipant = () => {
    window.open(`/poll/${pollId}?testMode=true`, '_blank');
  };

  const hasQuestions = questions.length > 0;

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Screen reader announcements for state changes */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only" role="status">
        {stateAnnouncement}
      </div>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <h1
          style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
          }}
        >
          Facilitate: {poll.title}
        </h1>
        <button
          onClick={handlePreviewAsParticipant}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: 'var(--color-secondary-700)',
            color: 'var(--color-text-inverse)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: 'pointer',
          }}
        >
          Preview as Participant
        </button>
      </div>

      {/* No questions warning */}
      {!hasQuestions && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-error-50)',
            border: '1px solid var(--color-error-300)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-6)',
            color: 'var(--color-error-700)',
          }}
        >
          Add questions before starting a session.
        </div>
      )}

      {/* Toggle Controls */}
      <section
        aria-label="Session controls"
        style={{
          padding: 'var(--space-6)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-6)',
          backgroundColor: 'var(--color-bg-secondary)',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            marginBottom: 'var(--space-4)',
          }}
        >
          Session Controls
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}
        >
          {/* Voting Toggle */}
          <button
            onClick={() => updateState({ votingOpen: !facilitatorState.votingOpen })}
            disabled={updatingState}
            aria-pressed={facilitatorState.votingOpen}
            aria-label={facilitatorState.votingOpen ? 'Close voting' : 'Open voting'}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: facilitatorState.votingOpen
                ? 'var(--color-success-600)'
                : 'var(--color-neutral-600)',
              color: 'var(--color-text-inverse)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: updatingState ? 'not-allowed' : 'pointer',
              opacity: updatingState ? 0.7 : 1,
            }}
          >
            {facilitatorState.votingOpen ? '✓ Voting Open' : '✗ Voting Closed'}
          </button>

          {/* Live Results Toggle */}
          <button
            onClick={() => updateState({ liveResults: !facilitatorState.liveResults })}
            disabled={updatingState}
            aria-pressed={facilitatorState.liveResults}
            aria-label={facilitatorState.liveResults ? 'Disable live results' : 'Enable live results'}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: facilitatorState.liveResults
                ? 'var(--color-success-600)'
                : 'var(--color-neutral-600)',
              color: 'var(--color-text-inverse)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: updatingState ? 'not-allowed' : 'pointer',
              opacity: updatingState ? 0.7 : 1,
            }}
          >
            {facilitatorState.liveResults ? '✓ Live Results On' : '✗ Live Results Off'}
          </button>

          {/* Anonymisation Toggle */}
          <button
            onClick={() => updateState({ anonymise: !facilitatorState.anonymise })}
            disabled={updatingState}
            aria-pressed={facilitatorState.anonymise}
            aria-label={facilitatorState.anonymise ? 'Disable anonymisation' : 'Enable anonymisation'}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: facilitatorState.anonymise
                ? 'var(--color-success-600)'
                : 'var(--color-neutral-600)',
              color: 'var(--color-text-inverse)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: updatingState ? 'not-allowed' : 'pointer',
              opacity: updatingState ? 0.7 : 1,
            }}
          >
            {facilitatorState.anonymise ? '✓ Anonymised' : '✗ Names Visible'}
          </button>
        </div>

        {/* Reveal Stage Selector */}
        <div>
          <h3
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              marginBottom: 'var(--space-2)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Reveal Stage
          </h3>
          <div
            role="radiogroup"
            aria-label="Reveal stage"
            style={{ display: 'flex', gap: 'var(--space-2)' }}
            onKeyDown={(e) => {
              const stages: RevealStage[] = ['HIDDEN', 'COUNTS', 'DETAILS'];
              const currentIndex = stages.indexOf(facilitatorState.revealStage);
              let newIndex = currentIndex;
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                newIndex = (currentIndex + 1) % stages.length;
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                newIndex = (currentIndex - 1 + stages.length) % stages.length;
              }
              if (newIndex !== currentIndex) {
                updateState({ revealStage: stages[newIndex] });
                // Move focus to the newly selected radio button
                const container = e.currentTarget;
                const buttons = container.querySelectorAll('[role="radio"]');
                (buttons[newIndex] as HTMLElement)?.focus();
              }
            }}
          >
            {(['HIDDEN', 'COUNTS', 'DETAILS'] as RevealStage[]).map((stage) => (
              <button
                key={stage}
                role="radio"
                aria-checked={facilitatorState.revealStage === stage}
                tabIndex={facilitatorState.revealStage === stage ? 0 : -1}
                onClick={() => updateState({ revealStage: stage })}
                disabled={updatingState}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  backgroundColor:
                    facilitatorState.revealStage === stage
                      ? 'var(--color-primary-700)'
                      : 'var(--color-bg-primary)',
                  color:
                    facilitatorState.revealStage === stage
                      ? 'var(--color-text-inverse)'
                      : 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  cursor: updatingState ? 'not-allowed' : 'pointer',
                }}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Live Stats */}
      <section
        aria-label="Live statistics"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div
          style={{
            padding: 'var(--space-4)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-primary-700)',
            }}
          >
            {results?.participantCount ?? 0}
          </div>
          <div
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Participants
          </div>
        </div>
        <div
          style={{
            padding: 'var(--space-4)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-primary-700)',
            }}
          >
            {results?.submissionCount ?? 0}
          </div>
          <div
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Submissions
          </div>
        </div>
      </section>

      {/* Tabs: Results / Test Responses */}
      <section aria-label="Results and test responses">
        <div
          role="tablist"
          style={{
            display: 'flex',
            borderBottom: '2px solid var(--color-border-default)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <button
            role="tab"
            aria-selected={activeTab === 'results'}
            aria-controls="panel-results"
            id="tab-results"
            onClick={() => setActiveTab('results')}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderBottom:
                activeTab === 'results'
                  ? '2px solid var(--color-primary-700)'
                  : '2px solid transparent',
              backgroundColor: 'transparent',
              color:
                activeTab === 'results'
                  ? 'var(--color-primary-700)'
                  : 'var(--color-text-secondary)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: 'pointer',
              marginBottom: '-2px',
            }}
          >
            Results
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'test'}
            aria-controls="panel-test"
            id="tab-test"
            onClick={() => setActiveTab('test')}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              border: 'none',
              borderBottom:
                activeTab === 'test'
                  ? '2px solid var(--color-primary-700)'
                  : '2px solid transparent',
              backgroundColor: 'transparent',
              color:
                activeTab === 'test'
                  ? 'var(--color-primary-700)'
                  : 'var(--color-text-secondary)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: 'pointer',
              marginBottom: '-2px',
            }}
          >
            Test Responses
          </button>
        </div>

        {/* Results Panel */}
        <div
          id="panel-results"
          role="tabpanel"
          aria-labelledby="tab-results"
          hidden={activeTab !== 'results'}
        >
          {results ? (
            <ResultsDisplay
              results={results}
              revealStage={facilitatorState.revealStage}
              anonymise={facilitatorState.anonymise}
            />
          ) : (
            <p style={{ color: 'var(--color-text-secondary)', padding: 'var(--space-4)' }}>
              No responses yet.
            </p>
          )}
        </div>

        {/* Test Responses Panel */}
        <div
          id="panel-test"
          role="tabpanel"
          aria-labelledby="tab-test"
          hidden={activeTab !== 'test'}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 'var(--space-4)',
            }}
          >
            <button
              onClick={handleClearTestResponses}
              disabled={clearingTest}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                backgroundColor: 'var(--color-error-600)',
                color: 'var(--color-text-inverse)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                cursor: clearingTest ? 'not-allowed' : 'pointer',
                opacity: clearingTest ? 0.7 : 1,
              }}
            >
              {clearingTest ? 'Clearing...' : 'Clear Test Responses'}
            </button>
          </div>
          {testResults ? (
            <ResultsDisplay
              results={testResults}
              revealStage={facilitatorState.revealStage}
              anonymise={facilitatorState.anonymise}
            />
          ) : (
            <p style={{ color: 'var(--color-text-secondary)', padding: 'var(--space-4)' }}>
              No test responses yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
