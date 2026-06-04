import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRetroService } from '@/lib/services/retroService';

// Define mocks before vi.mock hoisting.
const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  retroBoard: {
    create: vi.fn(),
    findUnique: vi.fn(),
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

import { auditLogger } from '@/lib/services/auditLogger';

describe('RetroService.createBoard', () => {
  let retroService: ReturnType<typeof createRetroService>;
  const POLL_ID = 'poll-retro-1';

  beforeEach(() => {
    vi.clearAllMocks();
    retroService = createRetroService();

    // Default $transaction: run callback with a tx that captures lane creation
    // and echoes the created board back.
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        retroBoard: {
          create: vi.fn().mockImplementation((args: any) => ({
            id: 'board-1',
            ...args.data,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        },
        retroLane: {
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      return fn(tx);
    });
  });

  it('creates a board in the gather phase with the default vote cap', async () => {
    const board = await retroService.createBoard(POLL_ID, { template: 'start_stop_continue' });

    expect(board.phase).toBe('gather');
    expect(board.votesPerUser).toBe(3);
    expect(board.pollId).toBe(POLL_ID);
    expect(board.template).toBe('start_stop_continue');
  });

  it('expands the start_stop_continue template to ordered lanes', async () => {
    let laneData: any;
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        retroBoard: {
          create: vi.fn().mockResolvedValue({
            id: 'board-1',
            pollId: POLL_ID,
            template: 'start_stop_continue',
            phase: 'gather',
            votesPerUser: 3,
          }),
        },
        retroLane: {
          createMany: vi.fn().mockImplementation((args: any) => {
            laneData = args.data;
            return { count: args.data.length };
          }),
        },
      };
      return fn(tx);
    });

    await retroService.createBoard(POLL_ID, { template: 'start_stop_continue' });

    expect(laneData.map((l: any) => l.title)).toEqual(['Start', 'Stop', 'Continue']);
    expect(laneData.map((l: any) => l.displayOrder)).toEqual([0, 1, 2]);
  });

  it('expands the 4ls template to its four named lanes', async () => {
    let laneData: any;
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        retroBoard: { create: vi.fn().mockResolvedValue({ id: 'board-1', pollId: POLL_ID, template: '4ls', phase: 'gather', votesPerUser: 3 }) },
        retroLane: { createMany: vi.fn().mockImplementation((args: any) => { laneData = args.data; return { count: args.data.length }; }) },
      };
      return fn(tx);
    });

    await retroService.createBoard(POLL_ID, { template: '4ls' });

    expect(laneData.map((l: any) => l.title)).toEqual(['Liked', 'Learned', 'Lacked', 'Longed For']);
  });

  it('expands the mad_sad_glad template', async () => {
    let laneData: any;
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        retroBoard: { create: vi.fn().mockResolvedValue({ id: 'board-1', pollId: POLL_ID, template: 'mad_sad_glad', phase: 'gather', votesPerUser: 3 }) },
        retroLane: { createMany: vi.fn().mockImplementation((args: any) => { laneData = args.data; return { count: args.data.length }; }) },
      };
      return fn(tx);
    });

    await retroService.createBoard(POLL_ID, { template: 'mad_sad_glad' });

    expect(laneData.map((l: any) => l.title)).toEqual(['Mad', 'Sad', 'Glad']);
  });

  it('uses caller-supplied lanes for the custom template, trimming titles', async () => {
    let laneData: any;
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        retroBoard: { create: vi.fn().mockResolvedValue({ id: 'board-1', pollId: POLL_ID, template: 'custom', phase: 'gather', votesPerUser: 3 }) },
        retroLane: { createMany: vi.fn().mockImplementation((args: any) => { laneData = args.data; return { count: args.data.length }; }) },
      };
      return fn(tx);
    });

    await retroService.createBoard(POLL_ID, { template: 'custom', lanes: ['  Keep  ', 'Drop'] });

    expect(laneData.map((l: any) => l.title)).toEqual(['Keep', 'Drop']);
  });

  it('applies a valid votesPerUser override', async () => {
    const board = await retroService.createBoard(POLL_ID, {
      template: 'start_stop_continue',
      votesPerUser: 5,
    });

    expect(board.votesPerUser).toBe(5);
  });

  it('logs RETRO_BOARD_CREATED via the audit logger', async () => {
    await retroService.createBoard(POLL_ID, { template: 'mad_sad_glad', createdBy: 'facilitator-1' });

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        pollId: POLL_ID,
        action: 'RETRO_BOARD_CREATED',
        actor: 'facilitator-1',
      }),
      expect.anything(),
    );
  });

  it('rejects a custom board with no lanes', async () => {
    await expect(
      retroService.createBoard(POLL_ID, { template: 'custom' }),
    ).rejects.toThrow(/lane titles/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a custom board with an empty lane title', async () => {
    await expect(
      retroService.createBoard(POLL_ID, { template: 'custom', lanes: ['Keep', '   '] }),
    ).rejects.toThrow(/empty/i);
  });

  it('rejects a custom board with more than 8 lanes', async () => {
    const tooMany = Array.from({ length: 9 }, (_, i) => `Lane ${i}`);
    await expect(
      retroService.createBoard(POLL_ID, { template: 'custom', lanes: tooMany }),
    ).rejects.toThrow(/between 1 and 8/i);
  });

  it('rejects a lane title longer than 100 characters', async () => {
    await expect(
      retroService.createBoard(POLL_ID, { template: 'custom', lanes: ['a'.repeat(101)] }),
    ).rejects.toThrow(/100 characters/i);
  });

  it('rejects a non-positive votesPerUser override', async () => {
    await expect(
      retroService.createBoard(POLL_ID, { template: 'start_stop_continue', votesPerUser: 0 }),
    ).rejects.toThrow(/positive integer/i);
  });
});

describe('RetroService card capture (addCard / editCard / deleteCard)', () => {
  let retroService: ReturnType<typeof createRetroService>;
  const BOARD_ID = 'board-1';
  const LANE_ID = 'lane-1';
  const OWNER_TOKEN = 'owner-token';
  const OTHER_TOKEN = 'other-token';

  beforeEach(() => {
    vi.clearAllMocks();
    retroService = createRetroService();
  });

  function gatherBoard(overrides: Record<string, unknown> = {}) {
    return { id: BOARD_ID, pollId: 'poll-1', template: 'start_stop_continue', phase: 'gather', votesPerUser: 3, ...overrides };
  }

  function ownedCard(overrides: Record<string, unknown> = {}) {
    return { id: 'card-1', boardId: BOARD_ID, laneId: LANE_ID, authorToken: OWNER_TOKEN, authorName: 'Owner', text: 'original', ...overrides };
  }

  // ── addCard ───────────────────────────────────────────────────────────────

  it('addCard creates a card with trimmed text during the gather phase', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(gatherBoard());
    mockPrisma.retroCard.create.mockImplementation((args: any) => ({ id: 'card-1', ...args.data }));

    const card = await retroService.addCard(BOARD_ID, {
      laneId: LANE_ID,
      authorToken: OWNER_TOKEN,
      authorName: 'Owner',
      text: '  hello world  ',
    });

    expect(card.text).toBe('hello world');
    expect(mockPrisma.retroCard.create).toHaveBeenCalledWith({
      data: { boardId: BOARD_ID, laneId: LANE_ID, authorToken: OWNER_TOKEN, authorName: 'Owner', text: 'hello world' },
    });
  });

  it('addCard rejects when the board is not in the gather phase', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(gatherBoard({ phase: 'vote' }));

    await expect(
      retroService.addCard(BOARD_ID, { laneId: LANE_ID, authorToken: OWNER_TOKEN, authorName: 'Owner', text: 'hi' }),
    ).rejects.toMatchObject({ code: 'WRONG_PHASE' });
    expect(mockPrisma.retroCard.create).not.toHaveBeenCalled();
  });

  it('addCard rejects empty text after trimming', async () => {
    await expect(
      retroService.addCard(BOARD_ID, { laneId: LANE_ID, authorToken: OWNER_TOKEN, authorName: 'Owner', text: '   ' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockPrisma.retroBoard.findUnique).not.toHaveBeenCalled();
  });

  it('addCard rejects text longer than 2000 characters after trimming', async () => {
    await expect(
      retroService.addCard(BOARD_ID, { laneId: LANE_ID, authorToken: OWNER_TOKEN, authorName: 'Owner', text: 'a'.repeat(2001) }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('addCard accepts text of exactly 2000 characters', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(gatherBoard());
    mockPrisma.retroCard.create.mockImplementation((args: any) => ({ id: 'card-1', ...args.data }));

    const card = await retroService.addCard(BOARD_ID, {
      laneId: LANE_ID,
      authorToken: OWNER_TOKEN,
      authorName: 'Owner',
      text: 'a'.repeat(2000),
    });

    expect(card.text).toHaveLength(2000);
  });

  it('addCard rejects when the board does not exist', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(null);

    await expect(
      retroService.addCard(BOARD_ID, { laneId: LANE_ID, authorToken: OWNER_TOKEN, authorName: 'Owner', text: 'hi' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  // ── editCard ──────────────────────────────────────────────────────────────

  it('editCard updates the card text for the author during gather', async () => {
    mockPrisma.retroCard.findUnique.mockResolvedValue(ownedCard());
    mockPrisma.retroBoard.findUnique.mockResolvedValue(gatherBoard());
    mockPrisma.retroCard.update.mockImplementation((args: any) => ({ ...ownedCard(), ...args.data }));

    const card = await retroService.editCard('card-1', OWNER_TOKEN, '  updated  ');

    expect(card.text).toBe('updated');
    expect(mockPrisma.retroCard.update).toHaveBeenCalledWith({ where: { id: 'card-1' }, data: { text: 'updated' } });
  });

  it('editCard rejects when the requester is not the author', async () => {
    mockPrisma.retroCard.findUnique.mockResolvedValue(ownedCard());
    mockPrisma.retroBoard.findUnique.mockResolvedValue(gatherBoard());

    await expect(retroService.editCard('card-1', OTHER_TOKEN, 'updated')).rejects.toMatchObject({
      code: 'NOT_CARD_OWNER',
    });
    expect(mockPrisma.retroCard.update).not.toHaveBeenCalled();
  });

  it('editCard rejects when the board is not in the gather phase', async () => {
    mockPrisma.retroCard.findUnique.mockResolvedValue(ownedCard());
    mockPrisma.retroBoard.findUnique.mockResolvedValue(gatherBoard({ phase: 'closed' }));

    await expect(retroService.editCard('card-1', OWNER_TOKEN, 'updated')).rejects.toMatchObject({
      code: 'WRONG_PHASE',
    });
    expect(mockPrisma.retroCard.update).not.toHaveBeenCalled();
  });

  it('editCard rejects invalid (empty) text', async () => {
    await expect(retroService.editCard('card-1', OWNER_TOKEN, '   ')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  // ── deleteCard ──────────────────────────────────────────────────────────────

  it('deleteCard removes the card for the author during gather', async () => {
    mockPrisma.retroCard.findUnique.mockResolvedValue(ownedCard());
    mockPrisma.retroBoard.findUnique.mockResolvedValue(gatherBoard());
    mockPrisma.retroCard.delete.mockResolvedValue(ownedCard());

    await retroService.deleteCard('card-1', OWNER_TOKEN);

    expect(mockPrisma.retroCard.delete).toHaveBeenCalledWith({ where: { id: 'card-1' } });
  });

  it('deleteCard rejects and does not delete when the requester is not the author', async () => {
    mockPrisma.retroCard.findUnique.mockResolvedValue(ownedCard());
    mockPrisma.retroBoard.findUnique.mockResolvedValue(gatherBoard());

    await expect(retroService.deleteCard('card-1', OTHER_TOKEN)).rejects.toMatchObject({
      code: 'NOT_CARD_OWNER',
    });
    expect(mockPrisma.retroCard.delete).not.toHaveBeenCalled();
  });

  it('deleteCard rejects when the board is not in the gather phase', async () => {
    mockPrisma.retroCard.findUnique.mockResolvedValue(ownedCard());
    mockPrisma.retroBoard.findUnique.mockResolvedValue(gatherBoard({ phase: 'vote' }));

    await expect(retroService.deleteCard('card-1', OWNER_TOKEN)).rejects.toMatchObject({
      code: 'WRONG_PHASE',
    });
    expect(mockPrisma.retroCard.delete).not.toHaveBeenCalled();
  });

  it('deleteCard rejects when the card does not exist', async () => {
    mockPrisma.retroCard.findUnique.mockResolvedValue(null);

    await expect(retroService.deleteCard('missing', OWNER_TOKEN)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('RetroService voting (castVote / removeVote)', () => {
  let retroService: ReturnType<typeof createRetroService>;
  const BOARD_ID = 'board-1';
  const CARD_ID = 'card-1';
  const VOTER_TOKEN = 'voter-token';

  beforeEach(() => {
    vi.clearAllMocks();
    retroService = createRetroService();

    // $transaction runs the callback with the mocked prisma client acting as tx.
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  function voteBoard(overrides: Record<string, unknown> = {}) {
    return { id: BOARD_ID, pollId: 'poll-1', template: 'start_stop_continue', phase: 'vote', votesPerUser: 3, ...overrides };
  }

  // ── castVote ────────────────────────────────────────────────────────────────

  it('castVote creates a vote during the vote phase when under the cap', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(voteBoard());
    mockPrisma.retroVote.findFirst.mockResolvedValue(null);
    mockPrisma.retroVote.count.mockResolvedValue(0);
    mockPrisma.retroVote.create.mockResolvedValue({ id: 'vote-1', boardId: BOARD_ID, cardId: CARD_ID, voterToken: VOTER_TOKEN });

    await retroService.castVote(BOARD_ID, CARD_ID, VOTER_TOKEN);

    expect(mockPrisma.retroVote.create).toHaveBeenCalledWith({
      data: { boardId: BOARD_ID, cardId: CARD_ID, voterToken: VOTER_TOKEN },
    });
  });

  it('castVote rejects when the board is not in the vote phase', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(voteBoard({ phase: 'gather' }));

    await expect(retroService.castVote(BOARD_ID, CARD_ID, VOTER_TOKEN)).rejects.toMatchObject({
      code: 'WRONG_PHASE',
    });
    expect(mockPrisma.retroVote.create).not.toHaveBeenCalled();
  });

  it('castVote rejects a new-card vote when the voter is already at the cap', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(voteBoard({ votesPerUser: 3 }));
    mockPrisma.retroVote.findFirst.mockResolvedValue(null);
    mockPrisma.retroVote.count.mockResolvedValue(3);

    await expect(retroService.castVote(BOARD_ID, CARD_ID, VOTER_TOKEN)).rejects.toMatchObject({
      code: 'VOTE_CAP_EXCEEDED',
    });
    expect(mockPrisma.retroVote.create).not.toHaveBeenCalled();
  });

  it('castVote is a no-op when the voter has already voted on the card (no duplicate, no cap consumption)', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(voteBoard());
    mockPrisma.retroVote.findFirst.mockResolvedValue({ id: 'vote-1', boardId: BOARD_ID, cardId: CARD_ID, voterToken: VOTER_TOKEN });

    await retroService.castVote(BOARD_ID, CARD_ID, VOTER_TOKEN);

    expect(mockPrisma.retroVote.count).not.toHaveBeenCalled();
    expect(mockPrisma.retroVote.create).not.toHaveBeenCalled();
  });

  it('castVote treats a concurrent unique-constraint violation (P2002) as a no-op', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(voteBoard());
    mockPrisma.retroVote.findFirst.mockResolvedValue(null);
    mockPrisma.retroVote.count.mockResolvedValue(0);
    const p2002: any = new Error('Unique constraint failed');
    p2002.code = 'P2002';
    mockPrisma.retroVote.create.mockRejectedValue(p2002);

    await expect(retroService.castVote(BOARD_ID, CARD_ID, VOTER_TOKEN)).resolves.toBeUndefined();
  });

  it('castVote rejects when the board does not exist', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(null);

    await expect(retroService.castVote(BOARD_ID, CARD_ID, VOTER_TOKEN)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  // ── removeVote ────────────────────────────────────────────────────────────────

  it('removeVote deletes the voter vote on a card during the vote phase', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(voteBoard());
    mockPrisma.retroVote.deleteMany.mockResolvedValue({ count: 1 });

    await retroService.removeVote(BOARD_ID, CARD_ID, VOTER_TOKEN);

    expect(mockPrisma.retroVote.deleteMany).toHaveBeenCalledWith({
      where: { cardId: CARD_ID, voterToken: VOTER_TOKEN },
    });
  });

  it('removeVote is a no-op when no vote is present', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(voteBoard());
    mockPrisma.retroVote.deleteMany.mockResolvedValue({ count: 0 });

    await expect(retroService.removeVote(BOARD_ID, CARD_ID, VOTER_TOKEN)).resolves.toBeUndefined();
  });

  it('removeVote rejects when the board is not in the vote phase', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(voteBoard({ phase: 'closed' }));

    await expect(retroService.removeVote(BOARD_ID, CARD_ID, VOTER_TOKEN)).rejects.toMatchObject({
      code: 'WRONG_PHASE',
    });
    expect(mockPrisma.retroVote.deleteMany).not.toHaveBeenCalled();
  });
});
