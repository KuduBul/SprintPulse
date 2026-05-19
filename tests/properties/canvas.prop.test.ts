import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: shoprite-x-polling-app
 * Property 8: Canvas z-index matches placement order
 *
 * Validates: Requirements 3.11
 */

// ─── Z-index calculation logic (extracted from PollCanvas.tsx) ────────────────

/**
 * Computes the z-index for a question based on its position in the placement order.
 * This mirrors the `getZIndex` function inside PollCanvas.tsx:
 *   const index = placementOrder.indexOf(questionId);
 *   return index >= 0 ? index + 1 : 1;
 */
function getZIndex(placementOrder: string[], questionId: string): number {
  const index = placementOrder.indexOf(questionId);
  return index >= 0 ? index + 1 : 1;
}

// ─── Property 8: Canvas z-index matches placement order ──────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 8: Canvas z-index matches placement order
 *
 * For any set of questions placed on the canvas, the rendered z-index of each question
 * SHALL correspond to its placement order (last-placed has highest z-index).
 *
 * **Validates: Requirements 3.11**
 */
describe('Property 8: Canvas z-index matches placement order', () => {
  /**
   * Arbitrary: generates a non-empty array of unique question IDs representing
   * the placement order (first element = first placed, last element = last placed).
   */
  const placementOrderArb = fc
    .uniqueArray(fc.uuid(), { minLength: 1, maxLength: 50 })
    .filter((arr) => arr.length >= 1);

  /**
   * **Validates: Requirements 3.11**
   * The last-placed question (last in placementOrder) SHALL have the highest z-index.
   */
  it('last-placed question has the highest z-index', () => {
    fc.assert(
      fc.property(placementOrderArb, (placementOrder) => {
        const lastPlacedId = placementOrder[placementOrder.length - 1];
        const lastZIndex = getZIndex(placementOrder, lastPlacedId);

        // All other questions must have a lower z-index
        for (let i = 0; i < placementOrder.length - 1; i++) {
          const otherZIndex = getZIndex(placementOrder, placementOrder[i]);
          expect(otherZIndex).toBeLessThan(lastZIndex);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.11**
   * Z-index values SHALL be strictly increasing with placement order.
   * If question A was placed before question B, then zIndex(A) < zIndex(B).
   */
  it('z-index is strictly increasing with placement order', () => {
    fc.assert(
      fc.property(placementOrderArb, (placementOrder) => {
        for (let i = 0; i < placementOrder.length - 1; i++) {
          const currentZ = getZIndex(placementOrder, placementOrder[i]);
          const nextZ = getZIndex(placementOrder, placementOrder[i + 1]);
          expect(currentZ).toBeLessThan(nextZ);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.11**
   * For any two questions placed at different times, the one placed later SHALL
   * always have a higher z-index (rendering on top).
   */
  it('for any pair of placed questions, later-placed has higher z-index', () => {
    fc.assert(
      fc.property(
        placementOrderArb.filter((arr) => arr.length >= 2),
        fc.nat(),
        fc.nat(),
        (placementOrder, rawI, rawJ) => {
          // Pick two distinct indices
          const i = rawI % placementOrder.length;
          let j = rawJ % placementOrder.length;
          if (j === i) j = (j + 1) % placementOrder.length;

          const zI = getZIndex(placementOrder, placementOrder[i]);
          const zJ = getZIndex(placementOrder, placementOrder[j]);

          if (i < j) {
            // i was placed before j, so j should be on top
            expect(zI).toBeLessThan(zJ);
          } else {
            // j was placed before i, so i should be on top
            expect(zJ).toBeLessThan(zI);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.11**
   * All z-index values SHALL be positive integers (≥ 1).
   */
  it('all z-index values are positive integers', () => {
    fc.assert(
      fc.property(placementOrderArb, (placementOrder) => {
        for (const questionId of placementOrder) {
          const zIndex = getZIndex(placementOrder, questionId);
          expect(zIndex).toBeGreaterThanOrEqual(1);
          expect(Number.isInteger(zIndex)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.11**
   * Adding a new question to the canvas (appending to placementOrder) SHALL give it
   * the highest z-index without changing existing questions' z-indices.
   */
  it('newly placed question gets highest z-index without affecting existing', () => {
    fc.assert(
      fc.property(
        placementOrderArb,
        fc.uuid(),
        (existingOrder, newQuestionId) => {
          // Ensure the new ID is not already in the order
          fc.pre(!existingOrder.includes(newQuestionId));

          // Record z-indices before adding new question
          const zIndicesBefore = existingOrder.map((id) => ({
            id,
            zIndex: getZIndex(existingOrder, id),
          }));

          // Simulate placing a new question (append to order)
          const updatedOrder = [...existingOrder, newQuestionId];

          // Existing questions should retain their z-indices
          for (const { id, zIndex } of zIndicesBefore) {
            expect(getZIndex(updatedOrder, id)).toBe(zIndex);
          }

          // New question should have the highest z-index
          const newZIndex = getZIndex(updatedOrder, newQuestionId);
          for (const { zIndex } of zIndicesBefore) {
            expect(newZIndex).toBeGreaterThan(zIndex);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.11**
   * The z-index of the Nth placed question SHALL equal N (1-indexed).
   */
  it('z-index equals 1-indexed placement position', () => {
    fc.assert(
      fc.property(placementOrderArb, (placementOrder) => {
        for (let i = 0; i < placementOrder.length; i++) {
          const zIndex = getZIndex(placementOrder, placementOrder[i]);
          expect(zIndex).toBe(i + 1);
        }
      }),
      { numRuns: 100 }
    );
  });
});
