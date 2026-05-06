import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResponsivePollCanvas } from '@/components/canvas/ResponsivePollCanvas';

// --------------------------------------------------------------------------
// Test helpers
// --------------------------------------------------------------------------

const mockQuestions = [
  {
    id: 'q1',
    text: 'What is your favourite colour?',
    options: ['Red', 'Blue', 'Green'],
    allowCustom: false,
    position: { x: 10, y: 20, width: 20, height: 15 },
    displayOrder: 0,
  },
  {
    id: 'q2',
    text: 'Rate your experience',
    options: ['Good', 'Bad'],
    allowCustom: true,
    position: null,
    displayOrder: 1,
  },
  {
    id: 'q3',
    text: 'Any suggestions?',
    options: ['Yes', 'No'],
    allowCustom: false,
    position: { x: 50, y: 50, width: 25, height: 20 },
    displayOrder: 2,
  },
];

const defaultProps = {
  pollId: 'poll-1',
  questions: mockQuestions,
  backgroundImageUrl: null,
  onQuestionPositionChange: vi.fn(),
  onQuestionRemoveFromCanvas: vi.fn(),
};

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
  window.dispatchEvent(new Event('resize'));
}

// Mock matchMedia
function mockMatchMedia(width: number) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    let matches = false;
    if (query === '(min-width: 1024px)') {
      matches = width >= 1024;
    } else if (query === '(min-width: 768px) and (max-width: 1023px)') {
      matches = width >= 768 && width <= 1023;
    }
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('ResponsivePollCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Desktop mode (≥1024px)', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
      mockMatchMedia(1200);
    });

    it('renders the full PollCanvas editor', () => {
      render(<ResponsivePollCanvas {...defaultProps} />);
      // The PollCanvas renders with role="application" and aria-label="Poll canvas editor"
      expect(screen.getByRole('application', { name: 'Poll canvas editor' })).toBeInTheDocument();
    });

    it('renders sidebar with unplaced questions', () => {
      render(<ResponsivePollCanvas {...defaultProps} />);
      expect(screen.getByText('Unplaced Questions')).toBeInTheDocument();
      expect(screen.getByText('Rate your experience')).toBeInTheDocument();
    });
  });

  describe('Tablet mode (768–1023px)', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
      mockMatchMedia(900);
    });

    it('renders view-only canvas mode', () => {
      render(<ResponsivePollCanvas {...defaultProps} />);
      expect(screen.getByText(/View-only mode/)).toBeInTheDocument();
    });

    it('shows placed questions without drag handles', () => {
      render(<ResponsivePollCanvas {...defaultProps} />);
      expect(screen.getByRole('img', { name: 'Poll canvas preview' })).toBeInTheDocument();
      // Placed questions should be visible
      expect(screen.getByText('What is your favourite colour?')).toBeInTheDocument();
      expect(screen.getByText('Any suggestions?')).toBeInTheDocument();
    });

    it('lists unplaced questions below the canvas', () => {
      render(<ResponsivePollCanvas {...defaultProps} />);
      // Unplaced question should appear in the list below
      expect(screen.getByText('Rate your experience')).toBeInTheDocument();
    });
  });

  describe('Mobile mode (<768px)', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { value: 500, writable: true });
      mockMatchMedia(500);
    });

    it('renders questions as a vertical scrollable list', () => {
      render(<ResponsivePollCanvas {...defaultProps} />);
      expect(screen.getByRole('list', { name: 'Poll questions' })).toBeInTheDocument();
    });

    it('shows all questions sorted by displayOrder', () => {
      render(<ResponsivePollCanvas {...defaultProps} />);
      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(3);
      expect(items[0]).toHaveTextContent('What is your favourite colour?');
      expect(items[1]).toHaveTextContent('Rate your experience');
      expect(items[2]).toHaveTextContent('Any suggestions?');
    });

    it('does not render canvas elements', () => {
      render(<ResponsivePollCanvas {...defaultProps} />);
      expect(screen.queryByRole('application')).not.toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'Poll canvas preview' })).not.toBeInTheDocument();
    });
  });

  describe('Drag and Drop feature detection', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
      mockMatchMedia(1200);
    });

    it('falls back to coordinate inputs when DnD is not supported', () => {
      // Mock createElement to return an element without draggable
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'div') {
          // Remove draggable property to simulate no DnD support
          Object.defineProperty(el, 'draggable', { value: undefined, configurable: true });
          delete (el as any).draggable;
        }
        return el;
      });

      render(<ResponsivePollCanvas {...defaultProps} />);
      expect(
        screen.getByText(/Your browser does not support drag and drop/)
      ).toBeInTheDocument();

      vi.restoreAllMocks();
      // Re-mock matchMedia after restoreAllMocks
      mockMatchMedia(1200);
    });
  });

  describe('Image load failure', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
      mockMatchMedia(1200);
    });

    it('shows error banner when background image fails to load', async () => {
      // Mock Image to simulate load failure
      const mockImage = {
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        src: '',
      };

      vi.spyOn(globalThis, 'Image').mockImplementation(() => mockImage as any);

      render(
        <ResponsivePollCanvas
          {...defaultProps}
          backgroundImageUrl="https://example.com/broken-image.jpg"
        />
      );

      // Trigger the error callback
      if (mockImage.onerror) {
        mockImage.onerror();
      }

      // Wait for state update
      await vi.waitFor(() => {
        expect(
          screen.getByText(/Background image failed to load/)
        ).toBeInTheDocument();
      });

      vi.restoreAllMocks();
      mockMatchMedia(1200);
    });
  });
});
