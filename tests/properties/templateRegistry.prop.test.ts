import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: retro-enhancements-phase-2b
 * Property 1: Template structure completeness
 *
 * For any template in the built-in template registry, it SHALL have a non-empty `name`,
 * a non-empty `id`, and at least one column definition where each column has a non-empty
 * `title`, a non-empty `icon` (emoji string), and a non-empty `color` (CSS color string).
 *
 * **Validates: Requirements 1.1, 1.2**
 */

import {
  BUILT_IN_TEMPLATES,
  type RetroTemplateDefinition,
} from '@/lib/retro/templateRegistry';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates an index into the BUILT_IN_TEMPLATES array.
 * This allows fast-check to iterate over all templates across many runs.
 */
const templateIndexArb = fc.nat({ max: BUILT_IN_TEMPLATES.length - 1 });

// ─── Property 1: Template structure completeness ─────────────────────────────

describe('Feature: retro-enhancements-phase-2b, Property 1: Template structure completeness', () => {
  it('every built-in template has a non-empty id', () => {
    fc.assert(
      fc.property(templateIndexArb, (index) => {
        const template: RetroTemplateDefinition = BUILT_IN_TEMPLATES[index];
        expect(template.id).toBeDefined();
        expect(typeof template.id).toBe('string');
        expect(template.id.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('every built-in template has a non-empty name', () => {
    fc.assert(
      fc.property(templateIndexArb, (index) => {
        const template: RetroTemplateDefinition = BUILT_IN_TEMPLATES[index];
        expect(template.name).toBeDefined();
        expect(typeof template.name).toBe('string');
        expect(template.name.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('every built-in template has at least 1 column', () => {
    fc.assert(
      fc.property(templateIndexArb, (index) => {
        const template: RetroTemplateDefinition = BUILT_IN_TEMPLATES[index];
        expect(template.columns).toBeDefined();
        expect(Array.isArray(template.columns)).toBe(true);
        expect(template.columns.length).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 100 }
    );
  });

  it('every column in every built-in template has a non-empty title', () => {
    fc.assert(
      fc.property(templateIndexArb, (index) => {
        const template: RetroTemplateDefinition = BUILT_IN_TEMPLATES[index];
        for (const column of template.columns) {
          expect(column.title).toBeDefined();
          expect(typeof column.title).toBe('string');
          expect(column.title.trim().length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('every column in every built-in template has a non-empty icon (emoji)', () => {
    fc.assert(
      fc.property(templateIndexArb, (index) => {
        const template: RetroTemplateDefinition = BUILT_IN_TEMPLATES[index];
        for (const column of template.columns) {
          expect(column.icon).toBeDefined();
          expect(typeof column.icon).toBe('string');
          expect(column.icon.trim().length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('every column in every built-in template has a non-empty color (CSS color string)', () => {
    fc.assert(
      fc.property(templateIndexArb, (index) => {
        const template: RetroTemplateDefinition = BUILT_IN_TEMPLATES[index];
        for (const column of template.columns) {
          expect(column.color).toBeDefined();
          expect(typeof column.color).toBe('string');
          expect(column.color.trim().length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('every column color is a valid CSS hex color', () => {
    fc.assert(
      fc.property(templateIndexArb, (index) => {
        const template: RetroTemplateDefinition = BUILT_IN_TEMPLATES[index];
        const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
        for (const column of template.columns) {
          expect(column.color).toMatch(hexColorRegex);
        }
      }),
      { numRuns: 100 }
    );
  });
});
