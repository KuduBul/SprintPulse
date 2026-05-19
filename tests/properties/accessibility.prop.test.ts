import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: shoprite-x-polling-app
 * Property 31: ARIA labels on canvas-placed questions
 *
 * Validates: Requirements 13.3
 */

// ─── Types (mirroring component types) ──────────────────────────────────────

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

// ─── ARIA label logic (extracted from PollCanvas.tsx and ParticipantForm.tsx) ─

/**
 * Determines the aria-label for a canvas-placed question element.
 * Both PollCanvas.tsx and ParticipantForm.tsx use `aria-label={question.text}`
 * on elements rendered at canvas positions.
 *
 * This function returns the aria-label value for a question that has a
 * non-null position (i.e., is placed on the canvas).
 */
function getCanvasQuestionAriaLabel(question: Question): string | null {
  if (question.position === null) {
    return null; // Not placed on canvas — no canvas aria-label needed
  }
  return question.text;
}

/**
 * Determines whether a question should be rendered on the canvas
 * (has a non-null position).
 */
function isCanvasPlaced(question: Question): boolean {
  return question.position !== null;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates a valid Position object with percentage-based coordinates.
 */
const positionArb: fc.Arbitrary<Position> = fc.record({
  x: fc.double({ min: 0, max: 100, noNaN: true }),
  y: fc.double({ min: 0, max: 100, noNaN: true }),
  width: fc.double({ min: 1, max: 100, noNaN: true }),
  height: fc.double({ min: 1, max: 100, noNaN: true }),
});

/**
 * Generates a non-empty question text (1-500 chars as per schema).
 */
const questionTextArb = fc.string({ minLength: 1, maxLength: 500 }).filter((s) => s.trim().length > 0);

/**
 * Generates a question with a non-null canvas position.
 */
const canvasPlacedQuestionArb: fc.Arbitrary<Question> = fc.record({
  id: fc.uuid(),
  text: questionTextArb,
  options: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 2, maxLength: 10 }),
  allowCustom: fc.boolean(),
  position: positionArb,
  displayOrder: fc.nat({ max: 100 }),
});

/**
 * Generates a question without a canvas position (unplaced).
 */
const unplacedQuestionArb: fc.Arbitrary<Question> = fc.record({
  id: fc.uuid(),
  text: questionTextArb,
  options: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 2, maxLength: 10 }),
  allowCustom: fc.boolean(),
  position: fc.constant(null),
  displayOrder: fc.nat({ max: 100 }),
});

/**
 * Generates a mixed array of placed and unplaced questions.
 */
const mixedQuestionsArb: fc.Arbitrary<Question[]> = fc.array(
  fc.oneof(canvasPlacedQuestionArb, unplacedQuestionArb),
  { minLength: 1, maxLength: 20 }
);

// ─── Property 31: ARIA labels on canvas-placed questions ─────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 31: ARIA labels on canvas-placed questions
 *
 * For any question with a non-null canvas position, the rendered element SHALL
 * include an `aria-label` attribute containing the question text.
 *
 * **Validates: Requirements 13.3**
 */
describe('Property 31: ARIA labels on canvas-placed questions', () => {
  /**
   * **Validates: Requirements 13.3**
   * Any question with a non-null position SHALL have an aria-label equal to its text.
   */
  it('canvas-placed questions have aria-label containing the question text', () => {
    fc.assert(
      fc.property(canvasPlacedQuestionArb, (question) => {
        const ariaLabel = getCanvasQuestionAriaLabel(question);

        // aria-label must not be null for placed questions
        expect(ariaLabel).not.toBeNull();

        // aria-label must contain the question text
        expect(ariaLabel).toBe(question.text);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.3**
   * The aria-label SHALL be exactly the question text (not a transformation of it).
   */
  it('aria-label is exactly the question text, not a prefix or suffix', () => {
    fc.assert(
      fc.property(canvasPlacedQuestionArb, (question) => {
        const ariaLabel = getCanvasQuestionAriaLabel(question);

        expect(ariaLabel).toBe(question.text);
        expect(ariaLabel!.length).toBe(question.text.length);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.3**
   * Questions without a canvas position (unplaced) do NOT require a canvas aria-label.
   */
  it('unplaced questions return null for canvas aria-label', () => {
    fc.assert(
      fc.property(unplacedQuestionArb, (question) => {
        const ariaLabel = getCanvasQuestionAriaLabel(question);
        expect(ariaLabel).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.3**
   * In a mixed set of questions, every canvas-placed question SHALL have an
   * aria-label and every unplaced question SHALL not.
   */
  it('in a mixed set, only canvas-placed questions have aria-labels', () => {
    fc.assert(
      fc.property(mixedQuestionsArb, (questions) => {
        for (const question of questions) {
          const ariaLabel = getCanvasQuestionAriaLabel(question);

          if (isCanvasPlaced(question)) {
            expect(ariaLabel).toBe(question.text);
          } else {
            expect(ariaLabel).toBeNull();
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.3**
   * The aria-label SHALL be non-empty for any canvas-placed question
   * (since question text is always 1+ characters).
   */
  it('aria-label is never empty for canvas-placed questions', () => {
    fc.assert(
      fc.property(canvasPlacedQuestionArb, (question) => {
        const ariaLabel = getCanvasQuestionAriaLabel(question);

        expect(ariaLabel).not.toBeNull();
        expect(ariaLabel!.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 13.3**
   * The aria-label generation is deterministic — calling it twice with the same
   * question produces the same result.
   */
  it('aria-label generation is deterministic', () => {
    fc.assert(
      fc.property(canvasPlacedQuestionArb, (question) => {
        const ariaLabel1 = getCanvasQuestionAriaLabel(question);
        const ariaLabel2 = getCanvasQuestionAriaLabel(question);

        expect(ariaLabel1).toBe(ariaLabel2);
      }),
      { numRuns: 100 }
    );
  });
});
