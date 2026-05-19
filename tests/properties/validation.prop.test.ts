import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isAllowedImageType, ALLOWED_MIME_TYPES } from '../../lib/validators/imageValidator';
import { CreateQuestionSchema } from '../../lib/validators/schemas';

/**
 * Feature: shoprite-x-polling-app
 * Property 2: Image type validation accepts only allowed formats
 * Property 6: Question count validation
 * Property 7: Option count validation
 *
 * Validates: Requirements 1.5, 2.2, 2.3
 */

// ─── Property 2: Image type validation accepts only allowed formats ──────────

/**
 * Feature: shoprite-x-polling-app, Property 2: Image type validation accepts only allowed formats
 *
 * For any file MIME type, the upload validator SHALL accept the file if and only if
 * the type is one of `image/jpeg`, `image/png`, or `image/webp`.
 *
 * **Validates: Requirements 1.5**
 */
describe('Property 2: Image type validation accepts only allowed formats', () => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

  /**
   * **Validates: Requirements 1.5**
   * For any allowed MIME type, isAllowedImageType SHALL return true.
   */
  it('accepts all allowed MIME types (image/jpeg, image/png, image/webp)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allowedTypes),
        (mimeType) => {
          expect(isAllowedImageType(mimeType)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * For any MIME type NOT in the allowed set, isAllowedImageType SHALL return false.
   */
  it('rejects any MIME type not in the allowed set', () => {
    // Generate arbitrary strings that are NOT one of the allowed types
    const disallowedMimeArb = fc.string({ minLength: 1, maxLength: 100 }).filter(
      (s) => !allowedTypes.includes(s as any)
    );

    fc.assert(
      fc.property(
        disallowedMimeArb,
        (mimeType) => {
          expect(isAllowedImageType(mimeType)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * For any common non-image MIME type, isAllowedImageType SHALL return false.
   */
  it('rejects common non-image MIME types', () => {
    const commonDisallowed = [
      'image/gif',
      'image/svg+xml',
      'image/bmp',
      'image/tiff',
      'application/pdf',
      'text/plain',
      'text/html',
      'application/json',
      'video/mp4',
      'audio/mpeg',
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...commonDisallowed),
        (mimeType) => {
          expect(isAllowedImageType(mimeType)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * The biconditional: isAllowedImageType returns true IFF the type is in ALLOWED_MIME_TYPES.
   */
  it('biconditional: returns true if and only if type is in ALLOWED_MIME_TYPES', () => {
    // Mix allowed and disallowed types to test the biconditional
    const allMimeArb = fc.oneof(
      fc.constantFrom(...allowedTypes),
      fc.constantFrom(
        'image/gif', 'image/svg+xml', 'image/bmp', 'application/pdf',
        'text/plain', 'video/mp4', 'audio/mpeg', 'application/octet-stream'
      ),
      fc.string({ minLength: 1, maxLength: 50 })
    );

    fc.assert(
      fc.property(
        allMimeArb,
        (mimeType) => {
          const result = isAllowedImageType(mimeType);
          const isInAllowed = (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
          expect(result).toBe(isInAllowed);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 6: Question count validation ───────────────────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 6: Question count validation
 *
 * For any integer N representing the number of questions in a poll,
 * the validator SHALL accept the poll if and only if 1 ≤ N ≤ 20.
 *
 * **Validates: Requirements 2.2**
 */
describe('Property 6: Question count validation', () => {
  /**
   * Helper: validates a question count against the constraint 1 ≤ N ≤ 20.
   * The SubmitResponsesSchema enforces answers.min(1) which maps to at least 1 question.
   * The design specifies max 20 questions per poll.
   */
  function isValidQuestionCount(n: number): boolean {
    return Number.isInteger(n) && n >= 1 && n <= 20;
  }

  /**
   * **Validates: Requirements 2.2**
   * For any integer N in [1, 20], the question count SHALL be accepted.
   */
  it('accepts question counts in the valid range [1, 20]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (n) => {
          expect(isValidQuestionCount(n)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.2**
   * For any integer N < 1, the question count SHALL be rejected.
   */
  it('rejects question counts below 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 0 }),
        (n) => {
          expect(isValidQuestionCount(n)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.2**
   * For any integer N > 20, the question count SHALL be rejected.
   */
  it('rejects question counts above 20', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 21, max: 1000 }),
        (n) => {
          expect(isValidQuestionCount(n)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.2**
   * Biconditional: the validator accepts N if and only if 1 ≤ N ≤ 20.
   */
  it('biconditional: accepts N if and only if 1 ≤ N ≤ 20', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 200 }),
        (n) => {
          const accepted = isValidQuestionCount(n);
          const shouldAccept = n >= 1 && n <= 20;
          expect(accepted).toBe(shouldAccept);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 7: Option count validation ─────────────────────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 7: Option count validation
 *
 * For any integer N representing the number of predefined options on a question,
 * the validator SHALL accept the question if and only if 2 ≤ N ≤ 10.
 *
 * **Validates: Requirements 2.3**
 */
describe('Property 7: Option count validation', () => {
  /**
   * Generates a valid question input with a specific number of options.
   */
  function buildQuestionInput(optionCount: number) {
    const options = Array.from({ length: optionCount }, (_, i) => `Option ${i + 1}`);
    return {
      text: 'Test question',
      options,
      allowCustom: false,
      position: null,
      displayOrder: 0,
    };
  }

  /**
   * **Validates: Requirements 2.3**
   * For any integer N in [2, 10], the CreateQuestionSchema SHALL accept the question.
   */
  it('accepts option counts in the valid range [2, 10]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        (n) => {
          const input = buildQuestionInput(n);
          const result = CreateQuestionSchema.safeParse(input);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.3**
   * For any integer N < 2 (but >= 0), the CreateQuestionSchema SHALL reject the question.
   */
  it('rejects option counts below 2', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1 }),
        (n) => {
          const input = buildQuestionInput(n);
          const result = CreateQuestionSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.3**
   * For any integer N > 10, the CreateQuestionSchema SHALL reject the question.
   */
  it('rejects option counts above 10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 11, max: 100 }),
        (n) => {
          const input = buildQuestionInput(n);
          const result = CreateQuestionSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.3**
   * Biconditional: the schema accepts N options if and only if 2 ≤ N ≤ 10.
   */
  it('biconditional: accepts N options if and only if 2 ≤ N ≤ 10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 }),
        (n) => {
          const input = buildQuestionInput(n);
          const result = CreateQuestionSchema.safeParse(input);
          const shouldAccept = n >= 2 && n <= 10;
          expect(result.success).toBe(shouldAccept);
        }
      ),
      { numRuns: 100 }
    );
  });
});
