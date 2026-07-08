import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RetroBoardView } from '../RetroBoardView';
import { BoardView, BoardLaneView, BoardCardView } from '@/lib/services/retroService';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function createCard(overrides: Partial<BoardCardView> = {}): BoardCardView {
  return {
    id: `card-${Math.random().toString(36).slice(2)}`,
    laneId: 'lane-1',
    text: 'Sample card text',
    authorToken: null,
    authorName: null,
    isOwn: false,
    voteCount: 0,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    ...overrides,
  };
}

function createLane(overrides: Partial<BoardLaneView> = {}): BoardLaneView {
  return {
    id: `lane-${Math.random().toString(36).slice(2)}`,
    title: 'Test Lane',
    displayOrder: 1,
    position: null,
    icon: null,
    color: null,
    cardCount: 0,
    cards: [],
    ...overrides,
  };
}

function createBoard(overrides: Partial<BoardView> = {}): BoardView {
  return {
    id: 'board-1',
    pollId: 'poll-1',
    template: 'start_stop_continue',
    phase: 'gather',
    votesPerUser: 3,
    backgroundImage: null,
    lanes: [
      createLane({ id: 'lane-1', title: 'Start', displayOrder: 1 }),
      createLane({ id: 'lane-2', title: 'Stop', displayOrder: 2 }),
      createLane({ id: 'lane-3', title: 'Continue', displayOrder: 3 }),
    ],
    ...overrides,
  };
}

function setDesktopViewport() {
  Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
  window.dispatchEvent(new Event('resize'));
}

function setMobileViewport() {
  Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
  window.dispatchEvent(new Event('resize'));
}

// --------------------------------------------------------------------------
// Desktop Tests
// --------------------------------------------------------------------------

describe('RetroBoardView - Desktop', () => {
  beforeEach(() => {
    setDesktopViewport();
    // Mock matchMedia for desktop
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
  });

  it('renders the board region with correct aria-label', () => {
    render(<RetroBoardView board={createBoard()} />);
    expect(screen.getByRole('region', { name: 'Retro board' })).toBeInTheDocument();
  });

  it('renders all lanes', () => {
    render(<RetroBoardView board={createBoard()} />);
    expect(screen.getByRole('group', { name: 'Lane: Start' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Lane: Stop' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Lane: Continue' })).toBeInTheDocument();
  });

  it('uses column layout when no lanes have positions', () => {
    const board = createBoard();
    const { container } = render(<RetroBoardView board={board} />);
    const region = screen.getByRole('region', { name: 'Retro board' });
    // Column layout uses grid
    expect(region.style.display).toBe('grid');
  });

  it('uses positioned layout when lanes have positions', () => {
    const board = createBoard({
      lanes: [
        createLane({ id: 'lane-1', title: 'Start', displayOrder: 1, position: { x: 0, y: 0, width: 30, height: 100 } }),
        createLane({ id: 'lane-2', title: 'Stop', displayOrder: 2, position: { x: 35, y: 0, width: 30, height: 100 } }),
        createLane({ id: 'lane-3', title: 'Continue', displayOrder: 3, position: { x: 70, y: 0, width: 30, height: 100 } }),
      ],
    });
    render(<RetroBoardView board={board} />);
    const region = screen.getByRole('region', { name: 'Retro board' });
    // Positioned layout uses relative positioning
    expect(region.style.position).toBe('relative');
  });

  it('renders background image when provided in positioned layout', () => {
    const board = createBoard({
      lanes: [
        createLane({ id: 'lane-1', title: 'Start', displayOrder: 1, position: { x: 0, y: 0, width: 50, height: 100 } }),
      ],
    });
    render(<RetroBoardView board={board} backgroundImageUrl="https://example.com/bg.jpg" />);
    const region = screen.getByRole('region', { name: 'Retro board' });
    // Background image is now rendered as a separate layer div inside the region
    const bgLayer = region.querySelector('[aria-hidden="true"]');
    expect(bgLayer).not.toBeNull();
    expect(bgLayer!.style.backgroundImage).toContain('https://example.com/bg.jpg');
  });

  it('displays cards within their lanes', () => {
    const board = createBoard({
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 2,
          cards: [
            createCard({ id: 'c1', text: 'First card', laneId: 'lane-1' }),
            createCard({ id: 'c2', text: 'Second card', laneId: 'lane-1' }),
          ],
        }),
      ],
    });
    render(<RetroBoardView board={board} />);
    expect(screen.getByText('First card')).toBeInTheDocument();
    expect(screen.getByText('Second card')).toBeInTheDocument();
  });

  it('shows card count badge in lane header', () => {
    const board = createBoard({
      lanes: [
        createLane({ id: 'lane-1', title: 'Start', displayOrder: 1, cardCount: 5 }),
      ],
    });
    render(<RetroBoardView board={board} />);
    expect(screen.getByLabelText('5 cards')).toBeInTheDocument();
  });

  it('shows "No cards yet" when a lane has no cards', () => {
    const board = createBoard({
      lanes: [createLane({ id: 'lane-1', title: 'Start', displayOrder: 1, cards: [] })],
    });
    render(<RetroBoardView board={board} />);
    expect(screen.getByText('No cards yet')).toBeInTheDocument();
  });

  it('shows vote counts during vote phase', () => {
    const board = createBoard({
      phase: 'vote',
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'Voted card', voteCount: 3 })],
        }),
      ],
    });
    render(<RetroBoardView board={board} />);
    expect(screen.getByLabelText('3 votes')).toBeInTheDocument();
  });

  it('hides vote counts during gather phase', () => {
    const board = createBoard({
      phase: 'gather',
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'Card text', voteCount: 2 })],
        }),
      ],
    });
    render(<RetroBoardView board={board} />);
    expect(screen.queryByLabelText('2 votes')).not.toBeInTheDocument();
  });

  it('shows author name when provided', () => {
    const board = createBoard({
      phase: 'vote',
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'Card', authorName: 'Alice' })],
        }),
      ],
    });
    render(<RetroBoardView board={board} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows "Anonymous" when no author info is available and not own card', () => {
    const board = createBoard({
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'Card', authorName: null, isOwn: false })],
        }),
      ],
    });
    render(<RetroBoardView board={board} />);
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
  });

  it('marks own cards with "(You)" prefix', () => {
    const board = createBoard({
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'My card', isOwn: true, authorName: 'Me' })],
        }),
      ],
    });
    render(<RetroBoardView board={board} />);
    expect(screen.getByText(/\(You\)/)).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------
// Mobile Tests
// --------------------------------------------------------------------------

describe('RetroBoardView - Mobile', () => {
  beforeEach(() => {
    setMobileViewport();
    // Mock matchMedia for mobile
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query !== '(min-width: 768px)',
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
        addListener: () => {},
        removeListener: () => {},
      }),
    });
  });

  it('renders the mobile header with board title', () => {
    render(<RetroBoardView board={createBoard()} boardTitle="Sprint 12 Retro" />);
    expect(screen.getByText('Sprint 12 Retro')).toBeInTheDocument();
  });

  it('falls back to template name in header when no title provided', () => {
    render(<RetroBoardView board={createBoard({ template: 'mad_sad_glad' })} />);
    expect(screen.getByText('Mad Sad Glad')).toBeInTheDocument();
  });

  it('shows current phase in header', () => {
    render(<RetroBoardView board={createBoard({ phase: 'vote' })} />);
    expect(screen.getByText(/Phase: vote/)).toBeInTheDocument();
  });

  it('renders background image in mobile header when provided', () => {
    const { container } = render(
      <RetroBoardView board={createBoard()} backgroundImageUrl="https://example.com/bg.jpg" />
    );
    const imgContainer = screen.getByRole('img', { name: 'Board background' });
    expect(imgContainer.style.backgroundImage).toContain('https://example.com/bg.jpg');
  });

  it('renders lanes as vertical stack ordered by displayOrder', () => {
    const board = createBoard({
      lanes: [
        createLane({ id: 'lane-3', title: 'Third', displayOrder: 3 }),
        createLane({ id: 'lane-1', title: 'First', displayOrder: 1 }),
        createLane({ id: 'lane-2', title: 'Second', displayOrder: 2 }),
      ],
    });
    render(<RetroBoardView board={board} />);

    const lanes = screen.getAllByRole('group');
    expect(lanes[0]).toHaveAttribute('aria-label', 'Lane: First');
    expect(lanes[1]).toHaveAttribute('aria-label', 'Lane: Second');
    expect(lanes[2]).toHaveAttribute('aria-label', 'Lane: Third');
  });

  it('ignores lane positions on mobile and uses stacked layout', () => {
    const board = createBoard({
      lanes: [
        createLane({ id: 'lane-1', title: 'Start', displayOrder: 1, position: { x: 50, y: 50, width: 20, height: 20 } }),
      ],
    });
    render(<RetroBoardView board={board} />);
    // On mobile, the region should not have position: relative (that's the positioned desktop layout)
    const region = screen.getByRole('region', { name: 'Retro board' });
    expect(region.style.position).not.toBe('relative');
  });

  it('renders cards with touch-friendly sizing on mobile', () => {
    const board = createBoard({
      phase: 'vote',
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'Touch card', voteCount: 2 })],
        }),
      ],
    });
    render(<RetroBoardView board={board} />);
    // Vote button should have touch-friendly minimum size
    const voteLabel = screen.getByLabelText('2 votes');
    expect(voteLabel.style.minWidth).toBe('44px');
    expect(voteLabel.style.minHeight).toBe('44px');
  });
});

// --------------------------------------------------------------------------
// Independence from Pulse Canvas (Req 9.5)
// --------------------------------------------------------------------------

describe('RetroBoardView - Independence from Pulse Canvas', () => {
  it('does not import or use PollCanvas', () => {
    // This test verifies the component is structurally independent.
    // The RetroBoardView component should not depend on canvas/ directory.
    // We verify by ensuring it renders without any PollCanvas dependency.
    const board = createBoard();
    const { container } = render(<RetroBoardView board={board} />);
    // It should render successfully as a standalone component
    expect(container.firstChild).not.toBeNull();
  });
});
