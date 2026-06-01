import React from 'react';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: mobile-background-image
 * Property 4: All questions remain scrollable with sticky container present
 * **Validates: Requirements 4.1**
 *
 * For any list of N questions (where N >= 1) rendered in ListLayout with a
 * StickyImageContainer present, all N question cards SHALL be reachable
 * within the scrollable area below the sticky container.
 */

import { ParticipantForm, ListLayout } from '../ParticipantForm';

// --- Arbitraries ---

const questionArb = (index: number) =>
  fc.record({
    id: fc.constant(`q-${index}`),
    text: fc.string({ minLength: 1, maxLength: 100 }),
    options: fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
      minLength: 2,
      maxLength: 5,
    }),
    allowCustom: fc.boolean(),
    position: fc.constant(null),
    displayOrder: fc.constant(index),
  });

const questionsArb = fc
  .integer({ min: 1, max: 20 })
  .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => questionArb(i))));

const backgroundImageUrlArb = fc.webUrl();

describe('Property 4: All questions remain scrollable with sticky container present', () => {
  beforeEach(() => {
    // Set viewport to mobile width to trigger ListLayout
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    // Mock fetch to prevent polling errors
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ facilitatorState: null }), { status: 200 })
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  /**
   * **Validates: Requirements 4.1**
   * For any list of N questions (N >= 1) rendered in ListLayout with a
   * StickyImageContainer present, all N question cards are rendered in the DOM
   * and the sticky container is also present — proving all questions remain
   * reachable in the scrollable area.
   */
  it('all N question cards are rendered alongside the sticky container', () => {
    fc.assert(
      fc.property(questionsArb, backgroundImageUrlArb, (questions, imageUrl) => {
        const poll = {
          id: 'test-poll',
          title: 'Test Poll',
          description: null,
          backgroundImageUrl: imageUrl,
          facilitatorState: {
            votingOpen: true,
            liveResults: false,
            anonymise: false,
            revealStage: 'hidden',
          },
          questions,
        };

        let container: ReturnType<typeof render> | undefined;

        act(() => {
          container = render(
            <ParticipantForm
              poll={poll}
              facilitatorState={poll.facilitatorState}
              onSubmit={async () => {}}
              participantName="Test User"
              sessionToken="test-token"
              pollId={poll.id}
            />
          );
        });

        // Trigger the resize event so the useEffect picks up the mobile width
        act(() => {
          window.dispatchEvent(new Event('resize'));
        });

        // Assert the sticky container is present
        const stickyContainer = screen.getByRole('img', {
          name: 'Poll background image',
        });
        expect(stickyContainer).toBeInTheDocument();

        // Assert all N question cards are rendered as listitems
        const listItems = screen.getAllByRole('listitem');
        expect(listItems.length).toBe(questions.length);

        // Both sticky container AND all questions coexist in the DOM
        expect(stickyContainer).toBeInTheDocument();
        expect(listItems.length).toBeGreaterThanOrEqual(1);

        container!.unmount();
      }),
      { numRuns: 100 }
    );
  });
});


describe('Property 2: Null image URL renders no container', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * **Validates: Requirements 1.2**
   *
   * For any render of ListLayout where backgroundImageUrl is null,
   * the rendered output SHALL NOT contain a StickyImageContainer element.
   */
  it('does not render StickyImageContainer when backgroundImageUrl is null', () => {
    fc.assert(
      fc.property(questionsArb, (questions) => {
        // Set viewport to mobile width to trigger ListLayout
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 375,
        });

        const poll = {
          id: 'test-poll',
          title: 'Test Poll',
          description: null,
          backgroundImageUrl: null,
          facilitatorState: {
            votingOpen: true,
            liveResults: false,
            anonymise: false,
            revealStage: 'hidden',
          },
          questions,
        };

        const { unmount } = render(
          <ParticipantForm
            poll={poll}
            facilitatorState={poll.facilitatorState}
            onSubmit={async () => {}}
            participantName="Test User"
            sessionToken="test-token"
            pollId={poll.id}
          />
        );

        // No element with role="img" and aria-label="Poll background image" should exist
        const imgContainer = screen.queryByRole('img', {
          name: 'Poll background image',
        });
        expect(imgContainer).not.toBeInTheDocument();

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   *
   * For any render of ListLayout where backgroundImageUrl is undefined,
   * the rendered output SHALL NOT contain a StickyImageContainer element.
   */
  it('does not render StickyImageContainer when backgroundImageUrl is undefined', () => {
    fc.assert(
      fc.property(questionsArb, (questions) => {
        // Set viewport to mobile width to trigger ListLayout
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 375,
        });

        const poll = {
          id: 'test-poll',
          title: 'Test Poll',
          description: null,
          backgroundImageUrl: undefined as unknown as string | null,
          facilitatorState: {
            votingOpen: true,
            liveResults: false,
            anonymise: false,
            revealStage: 'hidden',
          },
          questions,
        };

        const { unmount } = render(
          <ParticipantForm
            poll={poll}
            facilitatorState={poll.facilitatorState}
            onSubmit={async () => {}}
            participantName="Test User"
            sessionToken="test-token"
            pollId={poll.id}
          />
        );

        // No element with role="img" and aria-label="Poll background image" should exist
        const imgContainer = screen.queryByRole('img', {
          name: 'Poll background image',
        });
        expect(imgContainer).not.toBeInTheDocument();

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});


describe('Property 5: Failed image load hides container', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * **Validates: Requirements 4.3**
   * For any backgroundImageUrl that triggers an image load error,
   * the StickyImageContainer SHALL remove itself from the visible DOM,
   * leaving no empty placeholder.
   */
  it('container with role="img" is removed from DOM after image load error', () => {
    fc.assert(
      fc.property(backgroundImageUrlArb, (imageUrl) => {
        const { unmount } = render(
          <ListLayout
            questions={[
              {
                id: 'q1',
                text: 'Test question',
                options: ['A', 'B'],
                allowCustom: false,
                position: null,
                displayOrder: 0,
              },
            ]}
            backgroundImageUrl={imageUrl}
            selections={{}}
            customTexts={{}}
            errors={{}}
            onOptionSelect={vi.fn()}
            onCustomTextChange={vi.fn()}
            disabled={false}
          />
        );

        // Verify the sticky container is initially present
        const container = screen.getByRole('img', { name: 'Poll background image' });
        expect(container).toBeInTheDocument();

        // Simulate an error event on the img element
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        fireEvent.error(img!);

        // Assert that the container with role="img" is no longer in the DOM after the error
        expect(
          screen.queryByRole('img', { name: 'Poll background image' })
        ).not.toBeInTheDocument();

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 3: Aspect ratio invariant ---

/**
 * Feature: mobile-background-image
 * Property 3: Aspect ratio invariant (height = width * 9/16)
 * **Validates: Requirements 2.2, 3.3**
 *
 * For any viewport width, the StickyImageContainer height SHALL equal the
 * viewport width multiplied by 9/16, maintaining a 16:9 aspect ratio.
 *
 * Since jsdom doesn't compute actual layout dimensions, we verify the CSS
 * property `aspectRatio: '16 / 9'` is set on the container element's style.
 */

/**
 * Generate arbitrary viewport widths in the mobile range (320-768px).
 */
const viewportWidthArb = fc.integer({ min: 320, max: 768 });

describe('Property 3: Aspect ratio invariant', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * **Validates: Requirements 2.2, 3.3**
   * For any viewport width and any valid image URL, the StickyImageContainer
   * SHALL have aspectRatio: '16 / 9' set in its inline style, ensuring the
   * container maintains a 16:9 aspect ratio at any viewport width.
   */
  it('StickyImageContainer has aspectRatio 16/9 for any viewport width and image URL', () => {
    fc.assert(
      fc.property(viewportWidthArb, backgroundImageUrlArb, (viewportWidth, imageUrl) => {
        // Simulate mobile viewport width
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: viewportWidth,
        });
        window.dispatchEvent(new Event('resize'));

        const { container, unmount } = render(
          <ListLayout
            questions={[
              {
                id: 'q-0',
                text: 'Test question',
                options: ['Option A', 'Option B'],
                allowCustom: false,
                position: null,
                displayOrder: 0,
              },
            ]}
            backgroundImageUrl={imageUrl}
            selections={{}}
            customTexts={{}}
            errors={{}}
            onOptionSelect={vi.fn()}
            onCustomTextChange={vi.fn()}
            disabled={false}
          />
        );

        // Find the sticky image container by its role and aria-label
        const stickyContainer = container.querySelector(
          '[role="img"][aria-label="Poll background image"]'
        ) as HTMLElement;

        // Container should be rendered since we provided a valid image URL
        expect(stickyContainer).not.toBeNull();

        // Verify the aspectRatio CSS property is set to '16 / 9'
        expect(stickyContainer.style.aspectRatio).toBe('16 / 9');

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});
