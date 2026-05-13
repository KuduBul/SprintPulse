import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasFallback } from '@/components/canvas/CanvasFallback';

// --------------------------------------------------------------------------
// Test helpers
// --------------------------------------------------------------------------

const mockQuestions = [
  {
    id: 'q1',
    text: 'What is your favourite colour?',
    options: ['Red', 'Blue', 'Green'],
    allowCustom: false,
    position: { x: 10, y: 20, width: 25, height: 15 },
    displayOrder: 0,
  },
  {
    id: 'q2',
    text: 'Rate your experience',
    options: ['Good', 'Bad'],
    allowCustom: true,
    position: null,
    displayOrder: 1,
  },
];

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('CanvasFallback', () => {
  it('renders the warning banner', () => {
    const onPositionChange = vi.fn();
    render(
      <CanvasFallback questions={mockQuestions} onQuestionPositionChange={onPositionChange} />
    );

    expect(
      screen.getByText(
        'Your browser does not support drag and drop. Use the coordinate fields below to position questions.'
      )
    ).toBeInTheDocument();
  });

  it('renders the warning banner with alert role', () => {
    const onPositionChange = vi.fn();
    render(
      <CanvasFallback questions={mockQuestions} onQuestionPositionChange={onPositionChange} />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders coordinate inputs for each question', () => {
    const onPositionChange = vi.fn();
    render(
      <CanvasFallback questions={mockQuestions} onQuestionPositionChange={onPositionChange} />
    );

    // Each question should have x, y, width, height inputs
    expect(screen.getByText('What is your favourite colour?')).toBeInTheDocument();
    expect(screen.getByText('Rate your experience')).toBeInTheDocument();

    // Check for coordinate labels (4 per question = 8 total)
    const xLabels = screen.getAllByText('X');
    const yLabels = screen.getAllByText('Y');
    const widthLabels = screen.getAllByText('Width');
    const heightLabels = screen.getAllByText('Height');

    expect(xLabels).toHaveLength(2);
    expect(yLabels).toHaveLength(2);
    expect(widthLabels).toHaveLength(2);
    expect(heightLabels).toHaveLength(2);
  });

  it('shows existing position values for placed questions', () => {
    const onPositionChange = vi.fn();
    render(
      <CanvasFallback questions={mockQuestions} onQuestionPositionChange={onPositionChange} />
    );

    // q1 has position { x: 10, y: 20, width: 25, height: 15 }
    const inputs = screen.getAllByRole('spinbutton');
    // q1: x=10, y=20, width=25, height=15
    // q2: x=0, y=0, width=20, height=15 (defaults)
    expect(inputs[0]).toHaveValue(10);  // q1 x
    expect(inputs[1]).toHaveValue(20);  // q1 y
    expect(inputs[2]).toHaveValue(25);  // q1 width
    expect(inputs[3]).toHaveValue(15);  // q1 height
  });

  it('uses default values for unplaced questions', () => {
    const onPositionChange = vi.fn();
    render(
      <CanvasFallback questions={mockQuestions} onQuestionPositionChange={onPositionChange} />
    );

    const inputs = screen.getAllByRole('spinbutton');
    // q2 (unplaced): defaults to x=0, y=0, width=20, height=15
    expect(inputs[4]).toHaveValue(0);   // q2 x
    expect(inputs[5]).toHaveValue(0);   // q2 y
    expect(inputs[6]).toHaveValue(20);  // q2 width
    expect(inputs[7]).toHaveValue(15);  // q2 height
  });

  it('calls onQuestionPositionChange when a coordinate value changes', () => {
    const onPositionChange = vi.fn();
    render(
      <CanvasFallback questions={mockQuestions} onQuestionPositionChange={onPositionChange} />
    );

    const inputs = screen.getAllByRole('spinbutton');
    // Change q1's x value from 10 to 30
    fireEvent.change(inputs[0], { target: { value: '30' } });

    expect(onPositionChange).toHaveBeenCalledWith('q1', {
      x: 30,
      y: 20,
      width: 25,
      height: 15,
    });
  });

  it('clamps values to 0-100 range', () => {
    const onPositionChange = vi.fn();
    render(
      <CanvasFallback questions={mockQuestions} onQuestionPositionChange={onPositionChange} />
    );

    const inputs = screen.getAllByRole('spinbutton');

    // Try setting value above 100
    fireEvent.change(inputs[0], { target: { value: '150' } });
    expect(onPositionChange).toHaveBeenCalledWith('q1', {
      x: 100,
      y: 20,
      width: 25,
      height: 15,
    });

    onPositionChange.mockClear();

    // Try setting value below 0
    fireEvent.change(inputs[0], { target: { value: '-10' } });
    expect(onPositionChange).toHaveBeenCalledWith('q1', {
      x: 0,
      y: 20,
      width: 25,
      height: 15,
    });
  });

  it('does not call onQuestionPositionChange for NaN input', () => {
    const onPositionChange = vi.fn();
    render(
      <CanvasFallback questions={mockQuestions} onQuestionPositionChange={onPositionChange} />
    );

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: 'abc' } });

    expect(onPositionChange).not.toHaveBeenCalled();
  });
});
