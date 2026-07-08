import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRetroService } from '@/lib/services/retroService';

/**
 * Unit tests for retroService.exportBoard — the structured export of a retro
 * board's lanes, cards, vote counts, and author names.
 *
 * Validates: Requirements 10.1, 10.2
 */

// Define mocks before vi.mock hoisting.
const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  retroBoard: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  retroLane: {
    createMany: vi.fn(),
    findMany: vi.fn(),
  },
  retroCard: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  retroVote: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('@/lib/db/client', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/services/auditLogger', () => ({
  auditLogger: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('RetroService.exportBoard', () => {
  let retroService: ReturnType<typeof createRetroService>;
  const BOARD_ID = 'board-1';
  const POLL_ID = 'poll-1';

  beforeEach(() => {
    vi.clearAllMocks();
    retroService = createRetroService();
  });

  function board(overrides: Record<string, unknown> = {}) {
    return {
      id: BOARD_ID,
      pollId: POLL_ID,
      template: 'start_stop_continue',
      phase: 'closed',
      votesPerUser: 3,
      createdAt: new Date('2024-01-15T10:00:00Z'),
      ...overrides,
    };
  }

  function lane(id: string, title: string, order: number) {
    return { id, boardId: BOARD_ID, title, displayOrder: order, position: null };
  }

  function card(id: string, laneId: string, text: string, authorName: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      boardId: BOARD_ID,
      laneId,
      authorToken: `token-${authorName.toLowerCase()}`,
      authorName,
      text,
      createdAt: new Date('2024-01-15T11:00:00Z'),
      ...overrides,
    };
  }

  function vote(cardId: string, voterToken: string) {
    return { id: `vote-${cardId}-${voterToken}`, boardId: BOARD_ID, cardId, voterToken };
  }

  // ─── JSON Export ────────────────────────────────────────────────────────────

  describe('JSON format', () => {
    it('produces the correct structure: { board, lanes: [{ title, cards: [{ text, author, voteCount }] }] }', async () => {
      const lanes = [
        lane('lane-1', 'Start', 0),
        lane('lane-2', 'Stop', 1),
        lane('lane-3', 'Continue', 2),
      ];
      const cards = [
        card('card-1', 'lane-1', 'Do more testing', 'Alice'),
        card('card-2', 'lane-1', 'Pair programming', 'Bob'),
        card('card-3', 'lane-2', 'Long meetings', 'Alice'),
      ];
      const votes = [
        vote('card-1', 'token-bob'),
        vote('card-1', 'token-charlie'),
        vote('card-3', 'token-bob'),
      ];

      mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
      mockPrisma.retroLane.findMany.mockResolvedValue(lanes);
      mockPrisma.retroCard.findMany.mockResolvedValue(cards);
      mockPrisma.retroVote.findMany.mockResolvedValue(votes);

      const result = await retroService.exportBoard(BOARD_ID, 'json');

      expect(result.format).toBe('json');
      const parsed = JSON.parse(result.content);

      // Board metadata
      expect(parsed.board).toBeDefined();
      expect(parsed.board.id).toBe(BOARD_ID);
      expect(parsed.board.pollId).toBe(POLL_ID);
      expect(parsed.board.template).toBe('start_stop_continue');
      expect(parsed.board.phase).toBe('closed');
      expect(parsed.board.votesPerUser).toBe(3);

      // Lanes structure
      expect(parsed.lanes).toHaveLength(3);
      expect(parsed.lanes[0].title).toBe('Start');
      expect(parsed.lanes[1].title).toBe('Stop');
      expect(parsed.lanes[2].title).toBe('Continue');

      // Cards within lanes
      expect(parsed.lanes[0].cards).toHaveLength(2);
      expect(parsed.lanes[0].cards[0]).toMatchObject({
        id: 'card-1',
        text: 'Do more testing',
        author: 'Alice',
        voteCount: 2,
      });
      expect(parsed.lanes[0].cards[1]).toMatchObject({
        id: 'card-2',
        text: 'Pair programming',
        author: 'Bob',
        voteCount: 0,
      });

      // Second lane cards
      expect(parsed.lanes[1].cards).toHaveLength(1);
      expect(parsed.lanes[1].cards[0]).toMatchObject({
        text: 'Long meetings',
        author: 'Alice',
        voteCount: 1,
      });

      // Third lane (empty)
      expect(parsed.lanes[2].cards).toHaveLength(0);
    });

    it('produces valid JSON content', async () => {
      mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
      mockPrisma.retroLane.findMany.mockResolvedValue([lane('lane-1', 'Ideas', 0)]);
      mockPrisma.retroCard.findMany.mockResolvedValue([]);
      mockPrisma.retroVote.findMany.mockResolvedValue([]);

      const result = await retroService.exportBoard(BOARD_ID, 'json');

      expect(() => JSON.parse(result.content)).not.toThrow();
    });

    it('includes vote counts of zero for cards with no votes', async () => {
      mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
      mockPrisma.retroLane.findMany.mockResolvedValue([lane('lane-1', 'Ideas', 0)]);
      mockPrisma.retroCard.findMany.mockResolvedValue([card('card-1', 'lane-1', 'No votes card', 'Alice')]);
      mockPrisma.retroVote.findMany.mockResolvedValue([]);

      const result = await retroService.exportBoard(BOARD_ID, 'json');
      const parsed = JSON.parse(result.content);

      expect(parsed.lanes[0].cards[0].voteCount).toBe(0);
    });
  });

  // ─── CSV Export ─────────────────────────────────────────────────────────────

  describe('CSV format', () => {
    it('produces headers and correct rows', async () => {
      const lanes = [lane('lane-1', 'Start', 0), lane('lane-2', 'Stop', 1)];
      const cards = [
        card('card-1', 'lane-1', 'Great work', 'Alice'),
        card('card-2', 'lane-2', 'Too many meetings', 'Bob'),
      ];
      const votes = [vote('card-1', 'token-bob')];

      mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
      mockPrisma.retroLane.findMany.mockResolvedValue(lanes);
      mockPrisma.retroCard.findMany.mockResolvedValue(cards);
      mockPrisma.retroVote.findMany.mockResolvedValue(votes);

      const result = await retroService.exportBoard(BOARD_ID, 'csv');

      expect(result.format).toBe('csv');

      const rows = result.content.split('\n');
      expect(rows[0]).toBe('Lane,CardText,Author,VoteCount');
      expect(rows).toHaveLength(3); // header + 2 data rows

      // First card row
      expect(rows[1]).toBe('Start,Great work,Alice,1');
      // Second card row
      expect(rows[2]).toBe('Stop,Too many meetings,Bob,0');
    });

    it('properly escapes commas in card text', async () => {
      mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
      mockPrisma.retroLane.findMany.mockResolvedValue([lane('lane-1', 'Ideas', 0)]);
      mockPrisma.retroCard.findMany.mockResolvedValue([
        card('card-1', 'lane-1', 'First, second, third', 'Alice'),
      ]);
      mockPrisma.retroVote.findMany.mockResolvedValue([]);

      const result = await retroService.exportBoard(BOARD_ID, 'csv');
      const rows = result.content.split('\n');

      // Text with commas should be wrapped in double quotes
      expect(rows[1]).toContain('"First, second, third"');
    });

    it('properly escapes double quotes in card text', async () => {
      mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
      mockPrisma.retroLane.findMany.mockResolvedValue([lane('lane-1', 'Ideas', 0)]);
      mockPrisma.retroCard.findMany.mockResolvedValue([
        card('card-1', 'lane-1', 'She said "hello" to me', 'Alice'),
      ]);
      mockPrisma.retroVote.findMany.mockResolvedValue([]);

      const result = await retroService.exportBoard(BOARD_ID, 'csv');
      const rows = result.content.split('\n');

      // Quotes in text should be doubled and the field wrapped in quotes
      expect(rows[1]).toContain('"She said ""hello"" to me"');
    });

    it('properly escapes newlines in card text', async () => {
      mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
      mockPrisma.retroLane.findMany.mockResolvedValue([lane('lane-1', 'Ideas', 0)]);
      mockPrisma.retroCard.findMany.mockResolvedValue([
        card('card-1', 'lane-1', 'Line one\nLine two', 'Alice'),
      ]);
      mockPrisma.retroVote.findMany.mockResolvedValue([]);

      const result = await retroService.exportBoard(BOARD_ID, 'csv');

      // The field with newline should be quoted
      expect(result.content).toContain('"Line one\nLine two"');
    });

    it('escapes commas in lane titles', async () => {
      mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
      mockPrisma.retroLane.findMany.mockResolvedValue([lane('lane-1', 'Good, Bad, Ugly', 0)]);
      mockPrisma.retroCard.findMany.mockResolvedValue([
        card('card-1', 'lane-1', 'Simple text', 'Alice'),
      ]);
      mockPrisma.retroVote.findMany.mockResolvedValue([]);

      const result = await retroService.exportBoard(BOARD_ID, 'csv');
      const rows = result.content.split('\n');

      expect(rows[1]).toContain('"Good, Bad, Ugly"');
    });
  });

  // ─── NOT_FOUND ──────────────────────────────────────────────────────────────

  describe('Error handling', () => {
    it('throws NOT_FOUND when the board does not exist', async () => {
      mockPrisma.retroBoard.findUnique.mockResolvedValue(null);

      await expect(retroService.exportBoard(BOARD_ID, 'json')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });
});
