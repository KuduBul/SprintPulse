'use client';

import { useCallback } from 'react';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface Position {
  x: number;      // 0-100 percentage
  y: number;      // 0-100 percentage
  width: number;  // 0-100 percentage
  height: number; // 0-100 percentage
}

interface Question {
  id: string;
  text: string;
  options: string[];
  allowCustom: boolean;
  position: Position | null;
  displayOrder: number;
}

interface CanvasFallbackProps {
  questions: Question[];
  onQuestionPositionChange: (questionId: string, position: Position) => void;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export function CanvasFallback({ questions, onQuestionPositionChange }: CanvasFallbackProps) {
  const handleFieldChange = useCallback(
    (questionId: string, field: keyof Position, value: number, currentPosition: Position | null) => {
      const pos = currentPosition ?? { x: 0, y: 0, width: 20, height: 15 };
      const clamped = Math.max(0, Math.min(100, value));
      const updated: Position = { ...pos, [field]: clamped };
      onQuestionPositionChange(questionId, updated);
    },
    [onQuestionPositionChange]
  );

  return (
    <div
      style={{
        fontFamily: 'var(--font-family-sans)',
      }}
    >
      {/* Warning banner */}
      <div
        role="alert"
        style={{
          padding: 'var(--space-3) var(--space-4)',
          backgroundColor: 'var(--color-warning-50)',
          border: '1px solid var(--color-warning-300)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--font-size-lg)',
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          ⚠️
        </span>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-warning-800)',
            fontWeight: 'var(--font-weight-medium)',
          }}
        >
          Your browser does not support drag and drop. Use the coordinate fields below to position questions.
        </p>
      </div>

      {/* Question coordinate inputs */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        {questions.map((question) => {
          const pos = question.position ?? { x: 0, y: 0, width: 20, height: 15 };

          return (
            <div
              key={question.id}
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <p
                style={{
                  margin: '0 0 var(--space-3) 0',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {question.text}
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 'var(--space-3)',
                }}
              >
                <CoordinateField
                  label="X"
                  value={pos.x}
                  onChange={(v) => handleFieldChange(question.id, 'x', v, question.position)}
                  questionId={question.id}
                />
                <CoordinateField
                  label="Y"
                  value={pos.y}
                  onChange={(v) => handleFieldChange(question.id, 'y', v, question.position)}
                  questionId={question.id}
                />
                <CoordinateField
                  label="Width"
                  value={pos.width}
                  onChange={(v) => handleFieldChange(question.id, 'width', v, question.position)}
                  questionId={question.id}
                />
                <CoordinateField
                  label="Height"
                  value={pos.height}
                  onChange={(v) => handleFieldChange(question.id, 'height', v, question.position)}
                  questionId={question.id}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// CoordinateField sub-component
// --------------------------------------------------------------------------

interface CoordinateFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  questionId: string;
}

function CoordinateField({ label, value, onChange, questionId }: CoordinateFieldProps) {
  const inputId = `coord-${questionId}-${label.toLowerCase()}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <label
        htmlFor={inputId}
        style={{
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </label>
      <input
        id={inputId}
        type="number"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100) / 100}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          if (!isNaN(parsed)) {
            onChange(parsed);
          }
        }}
        style={{
          width: '100%',
          padding: 'var(--space-2)',
          fontSize: 'var(--font-size-sm)',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-bg-primary)',
          color: 'var(--color-text-primary)',
        }}
        aria-label={`${label} coordinate for question`}
      />
    </div>
  );
}
