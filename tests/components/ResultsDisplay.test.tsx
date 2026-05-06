import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultsDisplay } from '@/components/results/ResultsDisplay';

// --------------------------------------------------------------------------
// Test helpers
// --------------------------------------------------------------------------

function makeResults(overrides: Partial<Parameters<typeof ResultsDisplay>[0]['results']> = {}) {
  return {
    participantCount: 5,
    submissionCount: 5,
    questions: [
      {
        questionId: 'q1',
        questionText: 'What is your favourite colour?',
        options: [
          { label: 'Red', count: 3, percentage: 60 },
          { label: 'Blue', count: 2, percentage: 40 },
        ],
        customResponses: [
          { text: 'Purple is the best', participantLabel: 'Participant 1' },
        ],
        totalResponses: 5,
      },
    ],
    ...overrides,
  };
}

function makeEmptyResults() {
  return {
    participantCount: 0,
    submissionCount: 0,
    questions: [
      {
        questionId: 'q1',
        questionText: 'What is your favourite colour?',
        options: [
          { label: 'Red', count: 0, percentage: 0 },
          { label: 'Blue', count: 0, percentage: 0 },
        ],
        customResponses: [],
        totalResponses: 0,
      },
    ],
  };
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('ResultsDisplay', () => {
  describe('HIDDEN reveal stage', () => {
    it('shows "Results are hidden" message', () => {
      render(
        <ResultsDisplay results={makeResults()} revealStage="HIDDEN" anonymise={false} />
      );

      expect(screen.getByText('Results are hidden')).toBeInTheDocument();
    });

    it('does not show any question results', () => {
      render(
        <ResultsDisplay results={makeResults()} revealStage="HIDDEN" anonymise={false} />
      );

      expect(screen.queryByText('What is your favourite colour?')).not.toBeInTheDocument();
    });
  });

  describe('COUNTS reveal stage', () => {
    it('shows question text', () => {
      render(
        <ResultsDisplay results={makeResults()} revealStage="COUNTS" anonymise={false} />
      );

      expect(screen.getByText('What is your favourite colour?')).toBeInTheDocument();
    });

    it('shows option labels with counts and percentages', () => {
      render(
        <ResultsDisplay results={makeResults()} revealStage="COUNTS" anonymise={false} />
      );

      expect(screen.getByText('Red')).toBeInTheDocument();
      expect(screen.getByText('Blue')).toBeInTheDocument();
      expect(screen.getByText('3 (60%)')).toBeInTheDocument();
      expect(screen.getByText('2 (40%)')).toBeInTheDocument();
    });

    it('does NOT show custom responses', () => {
      render(
        <ResultsDisplay results={makeResults()} revealStage="COUNTS" anonymise={false} />
      );

      expect(screen.queryByText('Custom')).not.toBeInTheDocument();
      expect(screen.queryByText('Purple is the best')).not.toBeInTheDocument();
    });

    it('shows "No responses yet" for questions with zero responses', () => {
      render(
        <ResultsDisplay results={makeEmptyResults()} revealStage="COUNTS" anonymise={false} />
      );

      expect(screen.getByText('No responses yet')).toBeInTheDocument();
    });
  });

  describe('DETAILS reveal stage', () => {
    it('shows option counts and percentages', () => {
      render(
        <ResultsDisplay results={makeResults()} revealStage="DETAILS" anonymise={false} />
      );

      expect(screen.getByText('3 (60%)')).toBeInTheDocument();
      expect(screen.getByText('2 (40%)')).toBeInTheDocument();
    });

    it('shows custom responses with participant labels', () => {
      render(
        <ResultsDisplay results={makeResults()} revealStage="DETAILS" anonymise={false} />
      );

      expect(screen.getByText('Custom')).toBeInTheDocument();
      expect(screen.getByText('Purple is the best')).toBeInTheDocument();
      expect(screen.getByText('Participant 1:')).toBeInTheDocument();
    });

    it('hides free-text section when no custom entries exist', () => {
      const results = makeResults({
        questions: [
          {
            questionId: 'q1',
            questionText: 'What is your favourite colour?',
            options: [
              { label: 'Red', count: 3, percentage: 60 },
              { label: 'Blue', count: 2, percentage: 40 },
            ],
            customResponses: [],
            totalResponses: 5,
          },
        ],
      });

      render(
        <ResultsDisplay results={results} revealStage="DETAILS" anonymise={false} />
      );

      expect(screen.queryByText('Custom')).not.toBeInTheDocument();
    });

    it('displays free-text verbatim without truncation', () => {
      const longText = 'A'.repeat(500);
      const results = makeResults({
        questions: [
          {
            questionId: 'q1',
            questionText: 'Feedback?',
            options: [{ label: 'Other', count: 1, percentage: 100 }],
            customResponses: [
              { text: longText, participantLabel: 'Participant 1' },
            ],
            totalResponses: 1,
          },
        ],
      });

      render(
        <ResultsDisplay results={results} revealStage="DETAILS" anonymise={false} />
      );

      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('shows anonymised participant labels as-is', () => {
      const results = makeResults({
        questions: [
          {
            questionId: 'q1',
            questionText: 'Feedback?',
            options: [{ label: 'Other', count: 2, percentage: 100 }],
            customResponses: [
              { text: 'Great session', participantLabel: 'Participant 1' },
              { text: 'Needs work', participantLabel: 'Participant 2' },
            ],
            totalResponses: 2,
          },
        ],
      });

      render(
        <ResultsDisplay results={results} revealStage="DETAILS" anonymise={true} />
      );

      expect(screen.getByText('Participant 1:')).toBeInTheDocument();
      expect(screen.getByText('Participant 2:')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('renders bar charts with progressbar role and aria attributes', () => {
      render(
        <ResultsDisplay results={makeResults()} revealStage="COUNTS" anonymise={false} />
      );

      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
      expect(progressBars[0]).toHaveAttribute('aria-valuenow', '60');
      expect(progressBars[0]).toHaveAttribute('aria-valuemin', '0');
      expect(progressBars[0]).toHaveAttribute('aria-valuemax', '100');
    });

    it('has a status role on the hidden message', () => {
      render(
        <ResultsDisplay results={makeResults()} revealStage="HIDDEN" anonymise={false} />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('multiple questions', () => {
    it('renders all questions', () => {
      const results = {
        participantCount: 10,
        submissionCount: 10,
        questions: [
          {
            questionId: 'q1',
            questionText: 'Question One',
            options: [{ label: 'A', count: 5, percentage: 50 }, { label: 'B', count: 5, percentage: 50 }],
            customResponses: [],
            totalResponses: 10,
          },
          {
            questionId: 'q2',
            questionText: 'Question Two',
            options: [{ label: 'X', count: 7, percentage: 70 }, { label: 'Y', count: 3, percentage: 30 }],
            customResponses: [],
            totalResponses: 10,
          },
        ],
      };

      render(
        <ResultsDisplay results={results} revealStage="DETAILS" anonymise={false} />
      );

      expect(screen.getByText('Question One')).toBeInTheDocument();
      expect(screen.getByText('Question Two')).toBeInTheDocument();
    });
  });
});
