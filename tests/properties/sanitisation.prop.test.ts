import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sanitise } from '../../lib/utils/sanitise';

/**
 * Feature: shoprite-x-polling-app
 * Property 30: XSS sanitisation of free-text input
 *
 * Validates: Requirements 11.2
 */

// ─── Property 30: XSS sanitisation of free-text input ────────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 30: XSS sanitisation of free-text input
 *
 * For any free-text input containing HTML tags or script elements, the sanitised
 * output SHALL not contain executable script content or unsanitised HTML tags.
 *
 * **Validates: Requirements 11.2**
 */
describe('Property 30: XSS sanitisation of free-text input', () => {
  /**
   * Arbitrary that generates strings containing <script> elements with random content.
   */
  const scriptTagArb = fc.tuple(
    fc.string({ minLength: 0, maxLength: 50 }),
    fc.string({ minLength: 0, maxLength: 100 }),
    fc.string({ minLength: 0, maxLength: 50 })
  ).map(([before, scriptContent, after]) =>
    `${before}<script>${scriptContent}</script>${after}`
  );

  /**
   * Arbitrary that generates strings containing HTML tags with various tag names.
   */
  const htmlTagArb = fc.tuple(
    fc.string({ minLength: 0, maxLength: 50 }),
    fc.constantFrom('div', 'span', 'img', 'a', 'iframe', 'object', 'embed', 'form', 'input', 'button'),
    fc.string({ minLength: 0, maxLength: 50 }),
    fc.string({ minLength: 0, maxLength: 50 })
  ).map(([before, tag, attrs, after]) =>
    `${before}<${tag} ${attrs}>${after}`
  );

  /**
   * Arbitrary that generates script tags with attributes (e.g., src, type).
   */
  const scriptWithAttrsArb = fc.tuple(
    fc.string({ minLength: 0, maxLength: 30 }),
    fc.constantFrom(
      'src="evil.js"',
      'type="text/javascript"',
      'src="https://evil.com/xss.js"',
      'nonce="abc"',
      'async defer'
    ),
    fc.string({ minLength: 0, maxLength: 50 }),
    fc.string({ minLength: 0, maxLength: 30 })
  ).map(([before, attr, content, after]) =>
    `${before}<script ${attr}>${content}</script>${after}`
  );

  /**
   * Arbitrary that generates event handler attributes (onerror, onload, onclick, etc.).
   */
  const eventHandlerArb = fc.tuple(
    fc.constantFrom('img', 'div', 'body', 'svg', 'input', 'a'),
    fc.constantFrom('onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'),
    fc.string({ minLength: 1, maxLength: 50 })
  ).map(([tag, event, payload]) =>
    `<${tag} ${event}="${payload}">`
  );

  /**
   * Arbitrary that generates HTML-entity-encoded script tags to test bypass attempts.
   */
  const encodedScriptArb = fc.tuple(
    fc.string({ minLength: 0, maxLength: 30 }),
    fc.string({ minLength: 0, maxLength: 50 }),
    fc.string({ minLength: 0, maxLength: 30 })
  ).map(([before, content, after]) =>
    `${before}&lt;script&gt;${content}&lt;/script&gt;${after}`
  );

  /**
   * **Validates: Requirements 11.2**
   * For any input containing <script> tags, the sanitised output SHALL not
   * contain <script> or </script> tags.
   */
  it('removes script tags and their content from input', () => {
    fc.assert(
      fc.property(
        scriptTagArb,
        (input) => {
          const result = sanitise(input);
          expect(result).not.toMatch(/<script\b/i);
          expect(result).not.toMatch(/<\/script>/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * For any input containing script tags with attributes, the sanitised output
   * SHALL not contain executable script content.
   */
  it('removes script tags with attributes (src, type, etc.)', () => {
    fc.assert(
      fc.property(
        scriptWithAttrsArb,
        (input) => {
          const result = sanitise(input);
          expect(result).not.toMatch(/<script\b/i);
          expect(result).not.toMatch(/<\/script>/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * For any input containing HTML tags, the sanitised output SHALL not contain
   * any HTML tag syntax (opening or closing tags).
   */
  it('removes all HTML tags from input', () => {
    fc.assert(
      fc.property(
        htmlTagArb,
        (input) => {
          const result = sanitise(input);
          // No opening HTML tags should remain
          expect(result).not.toMatch(/<[a-z][^>]*>/i);
          // No closing HTML tags should remain
          expect(result).not.toMatch(/<\/[a-z][^>]*>/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * For any input containing event handler attributes (onerror, onload, etc.),
   * the sanitised output SHALL not contain the event handler or its tag.
   */
  it('removes tags with event handler attributes', () => {
    fc.assert(
      fc.property(
        eventHandlerArb,
        (input) => {
          const result = sanitise(input);
          expect(result).not.toMatch(/<[a-z][^>]*>/i);
          // Event handlers should not survive
          expect(result).not.toMatch(/on\w+\s*=/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * For any input containing HTML-entity-encoded script tags, the sanitised
   * output SHALL not contain executable script tags after entity decoding.
   */
  it('handles entity-encoded script tags (bypass attempts)', () => {
    fc.assert(
      fc.property(
        encodedScriptArb,
        (input) => {
          const result = sanitise(input);
          expect(result).not.toMatch(/<script\b/i);
          expect(result).not.toMatch(/<\/script>/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * For any arbitrary string input, the sanitised output SHALL never contain
   * HTML tag patterns that could execute scripts or inject markup.
   */
  it('universal property: output never contains executable HTML tags', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (input) => {
          const result = sanitise(input);
          // The output should not contain any well-formed HTML tags
          expect(result).not.toMatch(/<script\b[^>]*>/i);
          expect(result).not.toMatch(/<\/script>/i);
          expect(result).not.toMatch(/<style\b[^>]*>/i);
          expect(result).not.toMatch(/<\/style>/i);
          expect(result).not.toMatch(/<iframe\b[^>]*>/i);
          expect(result).not.toMatch(/<object\b[^>]*>/i);
          expect(result).not.toMatch(/<embed\b[^>]*>/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * For null or undefined input, the sanitised output SHALL be an empty string.
   */
  it('returns empty string for null/undefined input', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined),
        (input) => {
          const result = sanitise(input as any);
          expect(result).toBe('');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 11.2**
   * For any plain text input (no HTML tags), the sanitised output SHALL
   * preserve the text content (trimmed).
   */
  it('preserves plain text content without HTML', () => {
    // Generate strings that don't contain < or > or & characters
    const plainTextArb = fc.string({ minLength: 1, maxLength: 200 })
      .filter((s) => !/</.test(s) && !/>/.test(s) && !/&/.test(s));

    fc.assert(
      fc.property(
        plainTextArb,
        (input) => {
          const result = sanitise(input);
          expect(result).toBe(input.trim());
        }
      ),
      { numRuns: 100 }
    );
  });
});
