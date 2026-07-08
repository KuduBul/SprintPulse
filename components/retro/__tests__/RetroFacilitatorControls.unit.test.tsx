import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { RetroFacilitatorControls } from '../RetroFacilitatorControls';
import { BoardView } from '@/lib/services/retroService';

// --------------------------------------------------------------------------
// Mocks
// --------------------------------------------------------------------------

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('@/lib/hooks/useApi', () => ({
  useApi: () => ({
    get: mockGet,
    post: mockPost,
    patch: vi.fn(),
    del: vi.fn(),
    request: vi.fn(),
    isLoaded: true,
  }),
}));

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function createBoardView(overrides: Partial<BoardView> = {}): BoardView {
  return {
    id: 'board-1',
    pollId: 'poll-1',
    template: 'start_stop_continue',
    phase: 'gather',
    votesPerUser: 3,
    backgroundImage: null,
    lanes: [
      {
        id: 'lane-1',
        title: 'Went Well',
        displayOrder: 1,
        position: null,
        icon: null,
        color: null,
        cardCount: 2,
        cards: [
          {
            id: 'card-1',
            laneId: 'lane-1',
            text: 'Good teamwork',
            authorToken: 'participant-1',
            authorName: 'Alice',
            isOwn: false,
            voteCount: 1,
            createdAt: new Date('2024-01-01T10:00:00Z'),
          },
          {
            id: 'card-2',
            laneId: 'lane-1',
            text: 'Fast delivery',
            authorToken: 'participant-2',
            authorName: 'Bob',
            isOwn: false,
            voteCount: 3,
            createdAt: new Date('2024-01-01T10:01:00Z'),
          },
        ],
      },
      {
        id: 'lane-2',
        title: 'Needs Improvement',
        displayOrder: 2,
        position: null,
        icon: null,
        color: null,
        cardCount: 1,
        cards: [
          {
            id: 'card-3',
            laneId: 'lane-2',
            text: 'Too many meetings',
            authorToken: 'participant-1',
            authorName: 'Alice',
            isOwn: false,
            voteCount: 0,
            createdAt: new Date('2024-01-01T10:02:00Z'),
          },
        ],
      },
    ],
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('RetroFacilitatorControls', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGet.mockReset();
    mockPost.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading state initially', () => {
    mockGet.mockResolvedValue({ data: null, status: 200 });
    render(
      <RetroFacilitatorControls
        boardId="board-1"
        pollTitle="Sprint 42 Retro"
      />
    );
    expect(screen.getByText('Loading retro facilitator controls...')).toBeInTheDocument();
  });

  it('renders the header with poll title', async () => {
    mockGet.mockResolvedValue({ data: createBoardView(), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls
          boardId="board-1"
          pollTitle="Sprint 42 Retro"
        />
      );
    });
    expect(screen.getByText('Facilitate Retro: Sprint 42 Retro')).toBeInTheDocument();
  });

  it('displays the current phase indicator with Gather active', async () => {
    mockGet.mockResolvedValue({ data: createBoardView({ phase: 'gather' }), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });
    // The "Gather" step should be visually active (aria-current="step")
    const gatherStep = screen.getByText('Gather');
    expect(gatherStep).toHaveAttribute('aria-current', 'step');
  });

  it('displays the current phase indicator with Vote active', async () => {
    mockGet.mockResolvedValue({ data: createBoardView({ phase: 'vote' }), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });
    const voteStep = screen.getByText('Vote');
    expect(voteStep).toHaveAttribute('aria-current', 'step');
  });

  it('shows "Next Phase → Vote" button during gather', async () => {
    mockGet.mockResolvedValue({ data: createBoardView({ phase: 'gather' }), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });
    expect(
      screen.getByRole('button', { name: /Advance to Vote phase/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Next Phase → Vote/)).toBeInTheDocument();
  });

  it('shows "Next Phase → Closed" button during vote', async () => {
    mockGet.mockResolvedValue({ data: createBoardView({ phase: 'vote' }), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });
    expect(
      screen.getByRole('button', { name: /Advance to Closed phase/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Next Phase → Closed/)).toBeInTheDocument();
  });

  it('shows disabled "Board Closed" button when phase is closed', async () => {
    mockGet.mockResolvedValue({ data: createBoardView({ phase: 'closed' }), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });
    const btn = screen.getByRole('button', { name: 'Board closed' });
    expect(btn).toBeDisabled();
  });

  it('advances phase when clicking the advance button', async () => {
    mockGet.mockResolvedValue({ data: createBoardView({ phase: 'gather' }), status: 200 });
    mockPost.mockResolvedValue({ data: createBoardView({ phase: 'vote' }), status: 200 });

    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });

    const advanceBtn = screen.getByRole('button', { name: /Advance to Vote phase/ });
    await act(async () => {
      fireEvent.click(advanceBtn);
    });

    expect(mockPost).toHaveBeenCalledWith('/api/retro/board-1/phase', { phase: 'vote' });
  });

  it('displays the reveal/anonymise toggle', async () => {
    mockGet.mockResolvedValue({ data: createBoardView(), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });
    const toggle = screen.getByRole('button', { name: /Hide author names|Show author names/ });
    expect(toggle).toBeInTheDocument();
    // Initially anonymous
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles author visibility when clicking reveal button', async () => {
    mockGet.mockResolvedValue({ data: createBoardView(), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });

    // Initially shows "Anonymous" for all cards
    const anonElements = screen.getAllByText('Anonymous');
    expect(anonElements.length).toBe(3); // 3 cards, all anonymous

    // Click reveal
    const toggle = screen.getByRole('button', { name: /Show author names/ });
    await act(async () => {
      fireEvent.click(toggle);
    });

    // Now shows author names instead of Anonymous
    const aliceElements = screen.getAllByText('Alice');
    expect(aliceElements.length).toBe(2); // Alice authored 2 cards
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // Anonymous should no longer appear
    expect(screen.queryByText('Anonymous')).not.toBeInTheDocument();
  });

  it('displays the export button', async () => {
    mockGet.mockResolvedValue({ data: createBoardView(), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });
    expect(screen.getByRole('button', { name: 'Export board' })).toBeInTheDocument();
  });

  it('displays board statistics (lanes, cards, votes)', async () => {
    mockGet.mockResolvedValue({ data: createBoardView(), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });
    // Check statistics section exists with correct labels
    const statsSection = screen.getByLabelText('Retro statistics');
    expect(statsSection).toBeInTheDocument();
    expect(within(statsSection).getByText('Lanes')).toBeInTheDocument();
    expect(within(statsSection).getByText('Cards')).toBeInTheDocument();
    expect(within(statsSection).getByText('Votes')).toBeInTheDocument();
  });

  it('displays the board overview with lanes and cards', async () => {
    mockGet.mockResolvedValue({ data: createBoardView(), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });
    const overviewSection = screen.getByLabelText('Retro board overview');
    expect(overviewSection).toBeInTheDocument();
    expect(within(overviewSection).getByText('Went Well')).toBeInTheDocument();
    expect(within(overviewSection).getByText('Needs Improvement')).toBeInTheDocument();
    // Cards section renders below the overview — verify lane card counts are shown
    expect(within(overviewSection).getByLabelText('Edit lane: Went Well')).toBeInTheDocument();
    expect(within(overviewSection).getByLabelText('Edit lane: Needs Improvement')).toBeInTheDocument();
  });

  it('shows vote counts per card', async () => {
    mockGet.mockResolvedValue({ data: createBoardView(), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });
    expect(screen.getByText('1 vote')).toBeInTheDocument();
    expect(screen.getByText('3 votes')).toBeInTheDocument();
    expect(screen.getByText('0 votes')).toBeInTheDocument();
  });

  it('uses polling refresh to update board state', async () => {
    mockGet.mockResolvedValue({ data: createBoardView(), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });

    // Initial fetch
    expect(mockGet).toHaveBeenCalledTimes(1);

    // Advance time by 3 seconds
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Should have polled again
    expect(mockGet).toHaveBeenCalledTimes(2);

    // Advance another 3 seconds
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it('displays error state when fetch fails', async () => {
    mockGet.mockResolvedValue({
      data: null,
      error: { code: 'NOT_FOUND', message: 'Board not found' },
      status: 404,
    });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });
    expect(screen.getByText('Board not found')).toBeInTheDocument();
  });

  it('shows share URL when accessToken is provided', async () => {
    mockGet.mockResolvedValue({ data: createBoardView(), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls
          boardId="board-1"
          pollTitle="Retro"
          accessToken="test-token-123"
        />
      );
    });
    expect(screen.getByText('Share Retro')).toBeInTheDocument();
    expect(screen.getByText(/test-token-123/)).toBeInTheDocument();
  });

  it('does not show share section when no accessToken', async () => {
    mockGet.mockResolvedValue({ data: createBoardView(), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });
    expect(screen.queryByText('Share Retro')).not.toBeInTheDocument();
  });

  it('shows phase description for each phase', async () => {
    mockGet.mockResolvedValue({ data: createBoardView({ phase: 'gather' }), status: 200 });
    await act(async () => {
      render(
        <RetroFacilitatorControls boardId="board-1" pollTitle="Retro" />
      );
    });
    expect(screen.getByText('Participants are adding cards to lanes')).toBeInTheDocument();
  });
});
