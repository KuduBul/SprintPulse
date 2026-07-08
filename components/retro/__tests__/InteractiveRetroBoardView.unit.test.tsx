import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { InteractiveRetroBoardView } from '../InteractiveRetroBoardView';
import { BoardView, BoardLaneView, BoardCardView } from '@/lib/services/retroService';

// --------------------------------------------------------------------------
// Mocks
// --------------------------------------------------------------------------

const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockRequest = vi.fn();

vi.mock('@/lib/hooks/useApi', () => ({
  useApi: () => ({
    post: mockPost,
    patch: mockPatch,
    request: mockRequest,
    get: vi.fn(),
    del: vi.fn(),
    isLoaded: true,
  }),
}));

const mockGetParticipant = vi.fn();
vi.mock('@/lib/hooks/useParticipantToken', () => ({
  useParticipantToken: () => ({
    getParticipant: mockGetParticipant,
    createParticipant: vi.fn(),
    hasParticipant: vi.fn(),
    updateName: vi.fn(),
    getToken: vi.fn(),
  }),
}));

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
}

// --------------------------------------------------------------------------
// Tests: Gather Phase — Card Add/Edit/Delete
// --------------------------------------------------------------------------

describe('InteractiveRetroBoardView - Gather Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDesktopViewport();
    mockGetParticipant.mockReturnValue({ name: 'Alice', token: 'tok-alice' });
    mockPost.mockResolvedValue({ status: 201, data: { id: 'new-card' } });
    mockPatch.mockResolvedValue({ status: 200, data: {} });
    mockRequest.mockResolvedValue({ status: 204 });
  });

  it('shows "Add card" button per lane during gather phase', () => {
    render(
      <InteractiveRetroBoardView board={createBoard()} boardId="board-1" />
    );
    const addButtons = screen.getAllByRole('button', { name: /Add card to/ });
    expect(addButtons).toHaveLength(3);
  });

  it('does not show "Add card" button when participant token is missing', () => {
    mockGetParticipant.mockReturnValue(null);
    render(
      <InteractiveRetroBoardView board={createBoard()} boardId="board-1" />
    );
    expect(screen.queryByRole('button', { name: /Add card to/ })).not.toBeInTheDocument();
  });

  it('opens add card form when clicking "Add card" button', () => {
    render(
      <InteractiveRetroBoardView board={createBoard()} boardId="board-1" />
    );
    const addBtn = screen.getAllByRole('button', { name: /Add card to/ })[0];
    fireEvent.click(addBtn);
    expect(screen.getByLabelText('New card text')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit card' })).toBeInTheDocument();
  });

  it('submits a new card with optimistic update', async () => {
    const onMutate = vi.fn();
    render(
      <InteractiveRetroBoardView board={createBoard()} boardId="board-1" onMutate={onMutate} />
    );

    // Open the add form
    fireEvent.click(screen.getAllByRole('button', { name: /Add card to/ })[0]);

    // Type card text
    const textarea = screen.getByLabelText('New card text');
    fireEvent.change(textarea, { target: { value: 'My new card' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Submit card' }));

    // The card should appear optimistically
    expect(screen.getByText('My new card')).toBeInTheDocument();

    // API should be called
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/retro/board-1/cards', {
        laneId: 'lane-1',
        authorToken: 'tok-alice',
        authorName: 'Alice',
        text: 'My new card',
      });
    });

    await waitFor(() => {
      expect(onMutate).toHaveBeenCalled();
    });
  });

  it('rolls back optimistic add on API error', async () => {
    mockPost.mockResolvedValue({ status: 409, error: { code: 'WRONG_PHASE', message: 'Wrong phase' } });

    render(
      <InteractiveRetroBoardView board={createBoard()} boardId="board-1" />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Add card to/ })[0]);
    const textarea = screen.getByLabelText('New card text');
    fireEvent.change(textarea, { target: { value: 'Will fail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit card' }));

    // Card appears optimistically
    expect(screen.getByText('Will fail')).toBeInTheDocument();

    // After API error, card is rolled back
    await waitFor(() => {
      expect(screen.queryByText('Will fail')).not.toBeInTheDocument();
    });
  });

  it('shows edit and delete buttons on own cards during gather phase', () => {
    const board = createBoard({
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'My card', isOwn: true, authorToken: 'tok-alice', authorName: 'Alice' })],
        }),
      ],
    });
    render(
      <InteractiveRetroBoardView board={board} boardId="board-1" />
    );
    expect(screen.getByRole('button', { name: 'Edit card' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete card' })).toBeInTheDocument();
  });

  it('does not show edit/delete buttons on other people cards', () => {
    const board = createBoard({
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'Their card', isOwn: false, authorToken: 'other', authorName: null })],
        }),
      ],
    });
    render(
      <InteractiveRetroBoardView board={board} boardId="board-1" />
    );
    expect(screen.queryByRole('button', { name: 'Edit card' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete card' })).not.toBeInTheDocument();
  });

  it('opens edit form and saves edited card', async () => {
    const board = createBoard({
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'Original text', isOwn: true, authorToken: 'tok-alice', authorName: 'Alice' })],
        }),
      ],
    });
    render(
      <InteractiveRetroBoardView board={board} boardId="board-1" />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit card' }));
    const editTextarea = screen.getByLabelText('Edit card text');
    fireEvent.change(editTextarea, { target: { value: 'Updated text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save edit' }));

    // Optimistic update shows new text
    expect(screen.getByText('Updated text')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/api/retro/board-1/cards/c1', {
        authorToken: 'tok-alice',
        text: 'Updated text',
      });
    });
  });

  it('deletes a card optimistically', async () => {
    const board = createBoard({
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'To delete', isOwn: true, authorToken: 'tok-alice', authorName: 'Alice' })],
        }),
      ],
    });
    render(
      <InteractiveRetroBoardView board={board} boardId="board-1" />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete card' }));

    // Card is removed optimistically
    expect(screen.queryByText('To delete')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/retro/board-1/cards/c1',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ authorToken: 'tok-alice' }),
        })
      );
    });
  });
});

// --------------------------------------------------------------------------
// Tests: Vote Phase
// --------------------------------------------------------------------------

describe('InteractiveRetroBoardView - Vote Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDesktopViewport();
    mockGetParticipant.mockReturnValue({ name: 'Alice', token: 'tok-alice' });
    mockPost.mockResolvedValue({ status: 204 });
    mockRequest.mockResolvedValue({ status: 204 });
  });

  it('shows vote button on cards during vote phase', () => {
    const board = createBoard({
      phase: 'vote',
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'Voteable card', voteCount: 0 })],
        }),
      ],
    });
    render(
      <InteractiveRetroBoardView board={board} boardId="board-1" />
    );
    expect(screen.getByRole('button', { name: 'Vote for this card' })).toBeInTheDocument();
  });

  it('does not show add card button during vote phase', () => {
    const board = createBoard({ phase: 'vote' });
    render(
      <InteractiveRetroBoardView board={board} boardId="board-1" />
    );
    expect(screen.queryByRole('button', { name: /Add card to/ })).not.toBeInTheDocument();
  });

  it('optimistically increments vote count on vote', async () => {
    const board = createBoard({
      phase: 'vote',
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'Card to vote', voteCount: 2 })],
        }),
      ],
    });
    render(
      <InteractiveRetroBoardView board={board} boardId="board-1" />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Vote for this card' }));

    // Vote count should increase optimistically
    expect(screen.getByLabelText('3 votes')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/retro/board-1/votes', {
        cardId: 'c1',
        voterToken: 'tok-alice',
      });
    });
  });

  it('shows vote budget indicator during vote phase', () => {
    const board = createBoard({
      phase: 'vote',
      votesPerUser: 5,
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'Card', voteCount: 0 })],
        }),
      ],
    });
    render(
      <InteractiveRetroBoardView board={board} boardId="board-1" />
    );
    expect(screen.getByText(/Votes used: 0 \/ 5/)).toBeInTheDocument();
  });

  it('shows disabled vote button when at cap', async () => {
    const board = createBoard({
      phase: 'vote',
      votesPerUser: 1,
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 2,
          cards: [
            createCard({ id: 'c1', text: 'Card 1', voteCount: 1 }),
            createCard({ id: 'c2', text: 'Card 2', voteCount: 0 }),
          ],
        }),
      ],
    });
    const { rerender } = render(
      <InteractiveRetroBoardView board={board} boardId="board-1" />
    );

    // Vote on the first card (uses the 1 vote budget)
    fireEvent.click(screen.getAllByRole('button', { name: 'Vote for this card' })[0]);

    // After voting, the second card should show disabled vote
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Vote limit reached' })).toBeInTheDocument();
    });
  });
});

// --------------------------------------------------------------------------
// Tests: Closed Phase — Read Only
// --------------------------------------------------------------------------

describe('InteractiveRetroBoardView - Closed Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDesktopViewport();
    mockGetParticipant.mockReturnValue({ name: 'Alice', token: 'tok-alice' });
  });

  it('does not show add card button during closed phase', () => {
    const board = createBoard({ phase: 'closed' });
    render(
      <InteractiveRetroBoardView board={board} boardId="board-1" />
    );
    expect(screen.queryByRole('button', { name: /Add card to/ })).not.toBeInTheDocument();
  });

  it('does not show edit/delete buttons during closed phase even for own cards', () => {
    const board = createBoard({
      phase: 'closed',
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'My card', isOwn: true, authorToken: 'tok-alice' })],
        }),
      ],
    });
    render(
      <InteractiveRetroBoardView board={board} boardId="board-1" />
    );
    expect(screen.queryByRole('button', { name: 'Edit card' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete card' })).not.toBeInTheDocument();
  });

  it('does not show vote buttons during closed phase', () => {
    const board = createBoard({
      phase: 'closed',
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'Card', voteCount: 5 })],
        }),
      ],
    });
    render(
      <InteractiveRetroBoardView board={board} boardId="board-1" />
    );
    expect(screen.queryByRole('button', { name: 'Vote for this card' })).not.toBeInTheDocument();
    // But vote count should still be displayed
    expect(screen.getByLabelText('5 votes')).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------
// Tests: Touch Targets (Mobile Friendliness)
// --------------------------------------------------------------------------

describe('InteractiveRetroBoardView - Touch Targets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDesktopViewport();
    mockGetParticipant.mockReturnValue({ name: 'Alice', token: 'tok-alice' });
  });

  it('all action buttons have minimum 44px touch target', () => {
    const board = createBoard({
      phase: 'gather',
      lanes: [
        createLane({
          id: 'lane-1',
          title: 'Start',
          displayOrder: 1,
          cardCount: 1,
          cards: [createCard({ id: 'c1', text: 'My card', isOwn: true, authorToken: 'tok-alice' })],
        }),
      ],
    });
    render(
      <InteractiveRetroBoardView board={board} boardId="board-1" />
    );

    const editBtn = screen.getByRole('button', { name: 'Edit card' });
    const deleteBtn = screen.getByRole('button', { name: 'Delete card' });
    const addBtn = screen.getByRole('button', { name: /Add card to/ });

    expect(editBtn.style.minHeight).toBe('44px');
    expect(editBtn.style.minWidth).toBe('44px');
    expect(deleteBtn.style.minHeight).toBe('44px');
    expect(deleteBtn.style.minWidth).toBe('44px');
    expect(addBtn.style.minHeight).toBe('44px');
  });
});
