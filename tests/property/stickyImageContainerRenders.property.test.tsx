import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { ListLayout, LayoutProps } from '@/components/participant/ParticipantForm';

/**
 * Feature: mobile-background-image
 * Property 1: Non-null image URL renders sticky container
 * **Validates: Requirements 1.1**
 *
 * For any non-null, non-empty `backgroundImageUrl` string passed to `ListLayout`,
 * the rendered output SHALL contain a `StickyImageContainer` element with the
 * image URL applied.
 */

// --- Arbitraries ---

/**
 * Generate arbitrary non-empty URL strings representing any valid image URL.
 * We use webUrl from fast-check to produce realistic URLs, combined with
 * arbitrary string paths to cover edge cases.
 */
const nonEmptyUrlArb = fc.string({ minLength: 1, maxLength: 500 }).filter(
  (s) => s.trim().length > 0
);

/**
 * Minimal question list to satisfy ListLayout rendering requirements.
 */
const minimalQuestion = {
  id: 'q1',
  text: 'Test question',
  options: ['Option A', 'Option B'],
  allowCustom: false,
  position: null,
  displayOrder: 0,
};

function buildLayoutProps(backgroundImageUrl: string): LayoutProps {
  return {
    questions: [minimalQuestion],
    backgroundImageUrl,
    selections: {},
    customTexts: {},
    errors: {},
    onOptionSelect: vi.fn(),
    onCustomTextChange: vi.fn(),
    disabled: false,
  };
}

describe('Property 1: Non-null image URL renders sticky container', () => {
  /**
   * **Validates: Requirements 1.1**
   * For any non-empty backgroundImageUrl, the ListLayout renders a container
   * with role="img" and aria-label="Poll background image".
   */
  it('renders a container with role="img" and aria-label for any non-empty URL', () => {
    fc.assert(
      fc.property(nonEmptyUrlArb, (url) => {
        const props = buildLayoutProps(url);
        const { unmount } = render(<ListLayout {...props} />);

        // Assert that the sticky image container is present
        const container = screen.getByRole('img', { name: 'Poll background image' });
        expect(container).toBeInTheDocument();

        unmount();
      }),
      { numRuns: 150 }
    );
  });

  /**
   * **Validates: Requirements 1.1**
   * For any non-empty backgroundImageUrl, the rendered output contains an
   * img element with the generated URL as its src attribute.
   */
  it('renders an img element with the generated URL as src for any non-empty URL', () => {
    fc.assert(
      fc.property(nonEmptyUrlArb, (url) => {
        const props = buildLayoutProps(url);
        const { container, unmount } = render(<ListLayout {...props} />);

        // Find the img element inside the sticky container
        const imgElement = container.querySelector('img[src]');
        expect(imgElement).not.toBeNull();
        expect(imgElement!.getAttribute('src')).toBe(url);

        unmount();
      }),
      { numRuns: 150 }
    );
  });
});
