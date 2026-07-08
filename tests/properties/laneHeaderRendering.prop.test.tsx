import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, within, cleanup } from '@testing-library/react';
import { RetroBoardView } from '@/components/retro/RetroBoardView';
import { BoardView, BoardLaneView } from '@/lib/services/retroService';

/**
 * Feature: retro-enhancements-phase-2b, Property 3: Lane header renders icon and title together
 *
 * For any lane view with a non-null `icon`, the rendered lane header output SHALL contain
 * both the icon character and the lane title text, and SHALL include an accessible text label
 * (via `aria-label` or visible text) conveying the icon meaning.
 *
 * **Validates: Requirements 3.1, 3.3, 10.1, 11.1, 11.2**
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Common emoji characters for generating random lane icons. */
const EMOJI_SET = [
  '🚀', '🛑', '✅', '❤️', '📚', '🕳️', '⭐', '😡', '😢', '😊',
  '💨', '⚓', '🪨', '🏝️', '🎯', '💡', '🔥', '🎉', '⚡', '🌟',
  '👍', '🙏', '🤔', '💪', '🏆', '🎨', '🛠️', '📝', '✨', '🌈',
];

function createLane(overrides: Partial<BoardLaneView> = {}): BoardLaneView {
  return {
    id: `lane-${Math.random().toString(36).slice(2)}`,
    title: 'Test Lane',
    displayOrder: 0,
    position: null,
    icon: null,
    color: null,
    cardCount: 0,
    cards: [],
    ...overrides,
  };
}

function createBoard(lanes: BoardLaneView[]): BoardView {
  return {
    id: 'board-1',
    pollId: 'poll-1',
    template: 'start_stop_continue',
    phase: 'gather',
    votesPerUser: 3,
    backgroundImage: null,
    lanes,
  };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates a non-empty lane title (1-50 chars, printable).
 * Internal whitespace runs are collapsed to a single space because the DOM
 * accessible-name computation normalizes whitespace — so "a  b" becomes "a b".
 * Real lane titles are single-line trimmed strings, so this reflects actual input
 * and keeps the accessible-name assertion deterministic.
 */
const laneTitleArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter((s) => s.length > 0);

/** Generates a random emoji icon from the set. */
const emojiIconArb = fc.constantFrom(...EMOJI_SET);

/** Generates a valid CSS hex color for lane color. */
const cssColorArb = fc.hexaString({ minLength: 6, maxLength: 6 }).map((h) => `#${h}`);

/** Generates a random displayOrder index. */
const displayOrderArb = fc.integer({ min: 0, max: 7 });

// ─── Viewport setup ──────────────────────────────────────────────────────────

function setDesktopViewport() {
  Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query === '(min-width: 768px)',
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      addListener: () => {},
      removeListener: () => {},
    }),
  });
  window.dispatchEvent(new Event('resize'));
}

// ─── Property 3: Lane header renders icon and title together ─────────────────

describe('Feature: retro-enhancements-phase-2b, Property 3: Lane header renders icon and title together', () => {
  beforeEach(() => {
    setDesktopViewport();
  });

  it('non-null icon lanes render both icon and title with aria-label', () => {
    fc.assert(
      fc.property(
        laneTitleArb,
        emojiIconArb,
        cssColorArb,
        displayOrderArb,
        (title, icon, color, order) => {
          const lane = createLane({
            id: `lane-${order}`,
            title,
            icon,
            color,
            displayOrder: order,
          });
          const board = createBoard([lane]);

          const { unmount } = render(<RetroBoardView board={board} />);

          try {
            // The lane group should exist
            const laneGroup = screen.getByRole('group', { name: `Lane: ${title}` });
            expect(laneGroup).toBeInTheDocument();

            // The icon character should be present in the rendered output
            const iconElement = within(laneGroup).getByRole('img', { name: `Lane icon: ${icon}` });
            expect(iconElement).toBeInTheDocument();
            expect(iconElement.textContent).toContain(icon);

            // The title text should be visible
            expect(laneGroup).toHaveTextContent(title);

            // The aria-label on the icon element conveys the icon meaning
            expect(iconElement).toHaveAttribute('aria-label', `Lane icon: ${icon}`);

            // Both icon and title must coexist (text label accompanies icon)
            const headerText = laneGroup.textContent || '';
            expect(headerText).toContain(icon);
            expect(headerText).toContain(title);
          } finally {
            // Always unmount, even if an assertion throws, so the next
            // fast-check iteration starts from a clean DOM.
            unmount();
            cleanup();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('null icon lanes render title only without icon element or icon aria-label', () => {
    fc.assert(
      fc.property(
        laneTitleArb,
        displayOrderArb,
        (title, order) => {
          const lane = createLane({
            id: `lane-${order}`,
            title,
            icon: null,
            color: null,
            displayOrder: order,
          });
          const board = createBoard([lane]);

          const { unmount } = render(<RetroBoardView board={board} />);

          try {
            // The lane group should exist with title
            const laneGroup = screen.getByRole('group', { name: `Lane: ${title}` });
            expect(laneGroup).toBeInTheDocument();
            expect(laneGroup).toHaveTextContent(title);

            // No img role element should exist (no icon rendered)
            const iconElements = within(laneGroup).queryAllByRole('img');
            expect(iconElements.length).toBe(0);
          } finally {
            unmount();
            cleanup();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
