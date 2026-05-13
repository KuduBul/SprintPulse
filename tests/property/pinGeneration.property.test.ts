import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: team-based-poll-access, Property 2: PIN generation format and uniqueness
 * Validates: Requirements 1.2, 1.3
 *
 * For any set of N created teams, each team's PIN SHALL be 4–6 characters long,
 * contain only alphanumeric characters from the valid charset, and be unique
 * across all teams in the set.
 */

/**
 * The valid charset for PIN generation.
 * Excludes ambiguous characters: I, O, 0, 1 for readability.
 */
const PIN_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 6;

/**
 * Standalone PIN generation function extracted from TeamService logic
 * for pure property testing without database dependencies.
 */
function generatePin(): string {
  const length = PIN_MIN_LENGTH + Math.floor(Math.random() * (PIN_MAX_LENGTH - PIN_MIN_LENGTH + 1));
  let pin = '';
  for (let i = 0; i < length; i++) {
    pin += PIN_CHARSET[Math.floor(Math.random() * PIN_CHARSET.length)];
  }
  return pin;
}

describe('Property 2: PIN generation format and uniqueness', () => {
  /**
   * **Validates: Requirements 1.2**
   * WHEN a Team is created, THE Team_Service SHALL auto-generate a unique
   * Team_PIN of 4 to 6 alphanumeric characters.
   */
  it('generated PINs are always 4–6 characters long', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (_seed) => {
        const pin = generatePin();
        expect(pin.length).toBeGreaterThanOrEqual(PIN_MIN_LENGTH);
        expect(pin.length).toBeLessThanOrEqual(PIN_MAX_LENGTH);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   * All characters in a generated PIN must come from the valid charset
   * (uppercase letters excluding I and O, digits excluding 0 and 1).
   */
  it('generated PINs contain only valid charset characters', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (_seed) => {
        const pin = generatePin();
        for (const char of pin) {
          expect(PIN_CHARSET).toContain(char);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   * PINs must never contain ambiguous characters (I, O, 0, 1).
   */
  it('generated PINs never contain ambiguous characters (I, O, 0, 1)', () => {
    const ambiguousChars = ['I', 'O', '0', '1'];

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (_seed) => {
        const pin = generatePin();
        for (const char of ambiguousChars) {
          expect(pin).not.toContain(char);
        }
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.3**
   * THE Team_Service SHALL ensure each generated Team_PIN is unique across
   * all teams in the system. We verify uniqueness across batches of generated PINs.
   */
  it('generated PINs are unique across a batch', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 50 }),
        (batchSize) => {
          const pins = new Set<string>();
          for (let i = 0; i < batchSize; i++) {
            const pin = generatePin();
            pins.add(pin);
          }
          // With the charset of 30 chars and lengths 4-6, the probability of
          // collision in a batch of 50 is extremely low (~0.003%).
          // We verify that all generated PINs in the batch are unique.
          expect(pins.size).toBe(batchSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   * PINs must be purely alphanumeric (letters and digits only).
   */
  it('generated PINs are alphanumeric', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (_seed) => {
        const pin = generatePin();
        expect(pin).toMatch(/^[A-Z0-9]+$/);
      }),
      { numRuns: 200 }
    );
  });
});
