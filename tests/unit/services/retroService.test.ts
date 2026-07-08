import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRetroService } from '@/lib/services/retroService';

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
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  retroCard: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  retroVote: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  retroActionItem: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

describe('RetroService.setPhase', () => {
  let retroService: ReturnType<typeof createRetroService>;
  const BOARD_ID = 'board-1';
  const POLL_ID = 'poll-1';

  beforeEach(() => {
    vi.clearAllMocks();
    retroService = createRetroService();
    // $transaction runs the callback with the mocked prisma client acting as tx.
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  function board(overrides: Record<string, unknown> = {}) {
    return { id: BOARD_ID, pollId: POLL_ID, template: 'start_stop_continue', phase: 'gather', votesPerUser: 3, ...overrides };
  }

  it('advances gather -> vote and persists the new phase', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(board({ phase: 'gather' }));
    mockPrisma.retroBoard.update.mockImplementation((args: any) => ({ ...board(), ...args.data }));

    const updated = await retroService.setPhase(BOARD_ID, 'vote');

    expect(updated.phase).toBe('vote');
    expect(mockPrisma.retroBoard.update).toHaveBeenCalledWith({
      where: { id: BOARD_ID },
      data: { phase: 'vote' },
    });
  });

  it('advances vote -> closed and persists the new phase', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(board({ phase: 'vote' }));
    mockPrisma.retroBoard.update.mockImplementation((args: any) => ({ ...board(), ...args.data }));

    const updated = await retroService.setPhase(BOARD_ID, 'closed');

    expect(updated.phase).toBe('closed');
  });

  it('allows setting the phase to its current value (idempotent)', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(board({ phase: 'vote' }));
    mockPrisma.retroBoard.update.mockImplementation((args: any) => ({ ...board(), ...args.data }));

    const updated = await retroService.setPhase(BOARD_ID, 'vote');

    expect(updated.phase).toBe('vote');
  });

  it('rejects moving the phase backward (closed -> gather)', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(board({ phase: 'closed' }));

    await expect(retroService.setPhase(BOARD_ID, 'gather')).rejects.toMatchObject({
      code: 'INVALID_PHASE_TRANSITION',
    });
    expect(mockPrisma.retroBoard.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown phase value', async () => {
    await expect(retroService.setPhase(BOARD_ID, 'archived' as any)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(mockPrisma.retroBoard.findUnique).not.toHaveBeenCalled();
  });

  it('rejects when the board does not exist', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(null);

    await expect(retroService.setPhase(BOARD_ID, 'vote')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('logs RETRO_PHASE_CHANGED via the audit logger', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(board({ phase: 'gather' }));
    mockPrisma.retroBoard.update.mockImplementation((args: any) => ({ ...board(), ...args.data }));

    await retroService.setPhase(BOARD_ID, 'vote');

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        pollId: POLL_ID,
        action: 'RETRO_PHASE_CHANGED',
        metadata: expect.objectContaining({ boardId: BOARD_ID, fromPhase: 'gather', toPhase: 'vote' }),
      }),
      expect.anything(),
    );
  });
});

describe('RetroService.getBoard anonymity and reveal', () => {
  let retroService: ReturnType<typeof createRetroService>;
  const BOARD_ID = 'board-1';
  const POLL_ID = 'poll-1';
  const LANE_ID = 'lane-1';
  const A_TOKEN = 'token-a';
  const B_TOKEN = 'token-b';

  beforeEach(() => {
    vi.clearAllMocks();
    retroService = createRetroService();
  });

  function board(overrides: Record<string, unknown> = {}) {
    return { id: BOARD_ID, pollId: POLL_ID, template: 'start_stop_continue', phase: 'gather', votesPerUser: 3, ...overrides };
  }

  function lane(overrides: Record<string, unknown> = {}) {
    return { id: LANE_ID, boardId: BOARD_ID, title: 'Lane', displayOrder: 0, position: null, ...overrides };
  }

  function card(overrides: Record<string, unknown> = {}) {
    return {
      id: 'card-x',
      boardId: BOARD_ID,
      laneId: LANE_ID,
      authorToken: A_TOKEN,
      authorName: 'Alice',
      text: 'some text',
      createdAt: new Date(),
      ...overrides,
    };
  }

  function setup(phase: 'gather' | 'vote' | 'closed', cards: any[], votes: any[] = []) {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(board({ phase }));
    mockPrisma.retroLane.findMany.mockResolvedValue([lane()]);
    mockPrisma.retroCard.findMany.mockResolvedValue(cards);
    mockPrisma.retroVote.findMany.mockResolvedValue(votes);
  }

  it('rejects when the board does not exist', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(null);

    await expect(
      retroService.getBoard(POLL_ID, { role: 'participant', participantToken: A_TOKEN }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('gather: a participant sees only their own card content and an aggregate count for others', async () => {
    const aCard = card({ id: 'card-a', authorToken: A_TOKEN, authorName: 'Alice', text: 'a-card-text' });
    const bCard = card({ id: 'card-b', authorToken: B_TOKEN, authorName: 'Bob', text: 'b-secret-text' });
    setup('gather', [aCard, bCard]);

    const view = await retroService.getBoard(POLL_ID, { role: 'participant', participantToken: A_TOKEN });
    const lane0 = view.lanes[0];

    // Aggregate count reflects ALL cards in the lane.
    expect(lane0.cardCount).toBe(2);
    // But A only receives their own card content.
    expect(lane0.cards).toHaveLength(1);
    expect(lane0.cards[0].id).toBe('card-a');
    expect(lane0.cards[0].isOwn).toBe(true);
    expect(lane0.cards[0].text).toBe('a-card-text');

    const serialized = JSON.stringify(view);
    expect(serialized).toContain('a-card-text');
    // B's content and identity never leak to A during gather.
    expect(serialized).not.toContain('b-secret-text');
    expect(serialized).not.toContain(B_TOKEN);
    expect(serialized).not.toContain('Bob');
  });

  it('gather: a participant sees their own card identity so they can manage it', async () => {
    const aCard = card({ id: 'card-a', authorToken: A_TOKEN, authorName: 'Alice', text: 'a-card-text' });
    setup('gather', [aCard]);

    const view = await retroService.getBoard(POLL_ID, { role: 'participant', participantToken: A_TOKEN });
    const own = view.lanes[0].cards[0];

    expect(own.authorToken).toBe(A_TOKEN);
    expect(own.authorName).toBe('Alice');
    expect(own.isOwn).toBe(true);
  });

  it('gather: the facilitator sees all card content and author identity', async () => {
    const aCard = card({ id: 'card-a', authorToken: A_TOKEN, authorName: 'Alice', text: 'a-card-text' });
    const bCard = card({ id: 'card-b', authorToken: B_TOKEN, authorName: 'Bob', text: 'b-secret-text' });
    setup('gather', [aCard, bCard]);

    const view = await retroService.getBoard(POLL_ID, { role: 'facilitator' });
    const lane0 = view.lanes[0];

    expect(lane0.cardCount).toBe(2);
    expect(lane0.cards).toHaveLength(2);
    const serialized = JSON.stringify(view);
    expect(serialized).toContain('Bob');
    expect(serialized).toContain(B_TOKEN);
    expect(serialized).toContain('b-secret-text');
  });

  it('vote: card content is revealed to participants with running vote counts, author identity hidden for others', async () => {
    const bCard = card({ id: 'card-b', authorToken: B_TOKEN, authorName: 'Bob', text: 'b-card-text' });
    setup('vote', [bCard], [
      { id: 'v1', boardId: BOARD_ID, cardId: 'card-b', voterToken: A_TOKEN },
      { id: 'v2', boardId: BOARD_ID, cardId: 'card-b', voterToken: 'token-c' },
    ]);

    const view = await retroService.getBoard(POLL_ID, { role: 'participant', participantToken: A_TOKEN });
    const card0 = view.lanes[0].cards[0];

    // B's card content is visible so A can vote on it.
    expect(card0.text).toBe('b-card-text');
    expect(card0.voteCount).toBe(2);
    // Author identity is still hidden from A.
    expect(card0.authorToken).toBeNull();
    expect(card0.authorName).toBeNull();
    expect(card0.isOwn).toBe(false);

    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain(B_TOKEN);
    expect(serialized).not.toContain('Bob');
  });

  it('closed: card content is visible to participants but author identity stays hidden for others', async () => {
    const bCard = card({ id: 'card-b', authorToken: B_TOKEN, authorName: 'Bob', text: 'b-card-text' });
    setup('closed', [bCard]);

    const view = await retroService.getBoard(POLL_ID, { role: 'participant', participantToken: A_TOKEN });
    const card0 = view.lanes[0].cards[0];

    expect(card0.text).toBe('b-card-text');
    expect(card0.authorToken).toBeNull();
    expect(card0.authorName).toBeNull();

    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain(B_TOKEN);
    expect(serialized).not.toContain('Bob');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Action Items CRUD (Phase 2B — Requirements 7.1–7.7)
// ────────────────────────────────────────────────────────────────────────────

describe('RetroService action items (addActionItem / updateActionItem / deleteActionItem / getActionItems)', () => {
  let retroService: ReturnType<typeof createRetroService>;
  const BOARD_ID = 'board-action-1';

  beforeEach(() => {
    vi.clearAllMocks();
    retroService = createRetroService();
  });

  // --- addActionItem ---

  it('addActionItem succeeds in the vote phase with valid input', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue({
      id: BOARD_ID,
      phase: 'vote',
    });
    mockPrisma.retroActionItem.create.mockImplementation(async (args: any) => ({
      id: 'action-1',
      ...args.data,
      createdAt: new Date(),
    }));

    const result = await retroService.addActionItem(BOARD_ID, {
      text: 'Follow up on deployment',
      owner: 'Alice',
      dueDate: '2025-02-01',
    });

    expect(result.text).toBe('Follow up on deployment');
    expect(result.owner).toBe('Alice');
    expect(result.boardId).toBe(BOARD_ID);
    expect(mockPrisma.retroActionItem.create).toHaveBeenCalledOnce();
  });

  it('addActionItem succeeds in the closed phase', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue({
      id: BOARD_ID,
      phase: 'closed',
    });
    mockPrisma.retroActionItem.create.mockImplementation(async (args: any) => ({
      id: 'action-2',
      ...args.data,
      createdAt: new Date(),
    }));

    const result = await retroService.addActionItem(BOARD_ID, {
      text: 'Schedule follow-up meeting',
    });

    expect(result.text).toBe('Schedule follow-up meeting');
    expect(result.owner).toBeNull();
    expect(result.dueDate).toBeNull();
  });

  it('addActionItem rejects in the gather phase with WRONG_PHASE', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue({
      id: BOARD_ID,
      phase: 'gather',
    });

    await expect(
      retroService.addActionItem(BOARD_ID, { text: 'Some action' }),
    ).rejects.toMatchObject({ code: 'WRONG_PHASE' });
  });

  it('addActionItem rejects when the board does not exist', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(null);

    await expect(
      retroService.addActionItem('nonexistent', { text: 'Some action' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('addActionItem rejects empty text after trimming', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue({
      id: BOARD_ID,
      phase: 'vote',
    });

    await expect(
      retroService.addActionItem(BOARD_ID, { text: '   ' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('addActionItem rejects text longer than 500 characters', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue({
      id: BOARD_ID,
      phase: 'vote',
    });

    const longText = 'a'.repeat(501);
    await expect(
      retroService.addActionItem(BOARD_ID, { text: longText }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('addActionItem accepts text of exactly 500 characters', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue({
      id: BOARD_ID,
      phase: 'vote',
    });
    mockPrisma.retroActionItem.create.mockImplementation(async (args: any) => ({
      id: 'action-3',
      ...args.data,
      createdAt: new Date(),
    }));

    const text500 = 'a'.repeat(500);
    const result = await retroService.addActionItem(BOARD_ID, { text: text500 });
    expect(result.text).toBe(text500);
  });

  it('addActionItem rejects owner longer than 100 characters', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue({
      id: BOARD_ID,
      phase: 'vote',
    });

    const longOwner = 'x'.repeat(101);
    await expect(
      retroService.addActionItem(BOARD_ID, { text: 'Valid text', owner: longOwner }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('addActionItem accepts owner of exactly 100 characters', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue({
      id: BOARD_ID,
      phase: 'vote',
    });
    mockPrisma.retroActionItem.create.mockImplementation(async (args: any) => ({
      id: 'action-4',
      ...args.data,
      createdAt: new Date(),
    }));

    const owner100 = 'y'.repeat(100);
    const result = await retroService.addActionItem(BOARD_ID, { text: 'Task', owner: owner100 });
    expect(result.owner).toBe(owner100);
  });

  it('addActionItem trims text before length validation', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue({
      id: BOARD_ID,
      phase: 'vote',
    });
    mockPrisma.retroActionItem.create.mockImplementation(async (args: any) => ({
      id: 'action-5',
      ...args.data,
      createdAt: new Date(),
    }));

    const result = await retroService.addActionItem(BOARD_ID, { text: '  Trimmed  ' });
    expect(result.text).toBe('Trimmed');
  });

  it('addActionItem rejects invalid due date format', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue({
      id: BOARD_ID,
      phase: 'vote',
    });

    await expect(
      retroService.addActionItem(BOARD_ID, { text: 'Task', dueDate: 'not-a-date' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  // --- updateActionItem ---

  it('updateActionItem updates text for an existing item', async () => {
    mockPrisma.retroActionItem.findUnique.mockResolvedValue({
      id: 'action-1',
      boardId: BOARD_ID,
      text: 'Old text',
      owner: null,
      dueDate: null,
    });
    mockPrisma.retroActionItem.update.mockImplementation(async (args: any) => ({
      id: 'action-1',
      boardId: BOARD_ID,
      text: args.data.text ?? 'Old text',
      owner: args.data.owner ?? null,
      dueDate: args.data.dueDate ?? null,
      createdAt: new Date(),
    }));

    const result = await retroService.updateActionItem('action-1', { text: 'New text' });
    expect(result.text).toBe('New text');
  });

  it('updateActionItem clears owner by setting to null', async () => {
    mockPrisma.retroActionItem.findUnique.mockResolvedValue({
      id: 'action-1',
      boardId: BOARD_ID,
      text: 'Task',
      owner: 'Alice',
      dueDate: null,
    });
    mockPrisma.retroActionItem.update.mockImplementation(async (args: any) => ({
      id: 'action-1',
      boardId: BOARD_ID,
      text: 'Task',
      owner: args.data.owner,
      dueDate: null,
      createdAt: new Date(),
    }));

    const result = await retroService.updateActionItem('action-1', { owner: null });
    expect(result.owner).toBeNull();
  });

  it('updateActionItem clears dueDate by setting to null', async () => {
    mockPrisma.retroActionItem.findUnique.mockResolvedValue({
      id: 'action-1',
      boardId: BOARD_ID,
      text: 'Task',
      owner: null,
      dueDate: new Date('2025-03-01'),
    });
    mockPrisma.retroActionItem.update.mockImplementation(async (args: any) => ({
      id: 'action-1',
      boardId: BOARD_ID,
      text: 'Task',
      owner: null,
      dueDate: args.data.dueDate,
      createdAt: new Date(),
    }));

    const result = await retroService.updateActionItem('action-1', { dueDate: null });
    expect(result.dueDate).toBeNull();
  });

  it('updateActionItem rejects when item does not exist', async () => {
    mockPrisma.retroActionItem.findUnique.mockResolvedValue(null);

    await expect(
      retroService.updateActionItem('nonexistent', { text: 'New' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('updateActionItem rejects empty text after trimming', async () => {
    mockPrisma.retroActionItem.findUnique.mockResolvedValue({
      id: 'action-1',
      boardId: BOARD_ID,
      text: 'Old text',
      owner: null,
      dueDate: null,
    });

    await expect(
      retroService.updateActionItem('action-1', { text: '   ' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('updateActionItem rejects text longer than 500 characters', async () => {
    mockPrisma.retroActionItem.findUnique.mockResolvedValue({
      id: 'action-1',
      boardId: BOARD_ID,
      text: 'Old text',
      owner: null,
      dueDate: null,
    });

    await expect(
      retroService.updateActionItem('action-1', { text: 'b'.repeat(501) }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('updateActionItem rejects owner longer than 100 characters', async () => {
    mockPrisma.retroActionItem.findUnique.mockResolvedValue({
      id: 'action-1',
      boardId: BOARD_ID,
      text: 'Task',
      owner: null,
      dueDate: null,
    });

    await expect(
      retroService.updateActionItem('action-1', { owner: 'z'.repeat(101) }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('updateActionItem rejects invalid due date format', async () => {
    mockPrisma.retroActionItem.findUnique.mockResolvedValue({
      id: 'action-1',
      boardId: BOARD_ID,
      text: 'Task',
      owner: null,
      dueDate: null,
    });

    await expect(
      retroService.updateActionItem('action-1', { dueDate: 'invalid-date' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  // --- deleteActionItem ---

  it('deleteActionItem removes an existing item', async () => {
    mockPrisma.retroActionItem.findUnique.mockResolvedValue({
      id: 'action-1',
      boardId: BOARD_ID,
      text: 'Task',
    });
    mockPrisma.retroActionItem.delete.mockResolvedValue(undefined);

    await retroService.deleteActionItem('action-1');
    expect(mockPrisma.retroActionItem.delete).toHaveBeenCalledWith({
      where: { id: 'action-1' },
    });
  });

  it('deleteActionItem rejects when item does not exist', async () => {
    mockPrisma.retroActionItem.findUnique.mockResolvedValue(null);

    await expect(
      retroService.deleteActionItem('nonexistent'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  // --- getActionItems ---

  it('getActionItems returns all items for a board ordered by createdAt', async () => {
    const items = [
      { id: 'action-1', boardId: BOARD_ID, text: 'First', owner: null, dueDate: null, createdAt: new Date('2025-01-01') },
      { id: 'action-2', boardId: BOARD_ID, text: 'Second', owner: 'Bob', dueDate: new Date('2025-03-01'), createdAt: new Date('2025-01-02') },
    ];
    mockPrisma.retroActionItem.findMany.mockResolvedValue(items);

    const result = await retroService.getActionItems(BOARD_ID);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('First');
    expect(result[1].text).toBe('Second');
    expect(mockPrisma.retroActionItem.findMany).toHaveBeenCalledWith({
      where: { boardId: BOARD_ID },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('getActionItems returns empty array when no items exist', async () => {
    mockPrisma.retroActionItem.findMany.mockResolvedValue([]);

    const result = await retroService.getActionItems(BOARD_ID);
    expect(result).toHaveLength(0);
  });
});

describe('RetroService lane CRUD (addLane / updateLane / deleteLane / reorderLanes)', () => {
  let retroService: ReturnType<typeof createRetroService>;
  const BOARD_ID = 'board-1';
  const LANE_ID = 'lane-1';

  beforeEach(() => {
    vi.clearAllMocks();
    retroService = createRetroService();
    // $transaction runs the callback with the mocked prisma client acting as tx.
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      if (typeof fn === 'function') {
        return fn(mockPrisma);
      }
      // Array of promises (used by reorderLanes)
      return Promise.all(fn);
    });
  });

  function board(overrides: Record<string, unknown> = {}) {
    return { id: BOARD_ID, pollId: 'poll-1', template: 'start_stop_continue', phase: 'gather', votesPerUser: 3, ...overrides };
  }

  function lane(overrides: Record<string, unknown> = {}) {
    return { id: LANE_ID, boardId: BOARD_ID, title: 'Lane 1', displayOrder: 0, position: null, icon: null, color: null, ...overrides };
  }

  // ── addLane ─────────────────────────────────────────────────────────────────

  it('addLane creates a lane with the next displayOrder', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
    mockPrisma.retroLane.count.mockResolvedValue(3);
    mockPrisma.retroLane.create.mockImplementation((args: any) => ({ id: 'lane-new', ...args.data }));

    const newLane = await retroService.addLane(BOARD_ID, { title: 'New Lane', icon: '🎯', color: '#FF0000' });

    expect(newLane.title).toBe('New Lane');
    expect(newLane.displayOrder).toBe(3);
    expect(newLane.icon).toBe('🎯');
    expect(newLane.color).toBe('#FF0000');
    expect(mockPrisma.retroLane.create).toHaveBeenCalledWith({
      data: { boardId: BOARD_ID, title: 'New Lane', displayOrder: 3, icon: '🎯', color: '#FF0000' },
    });
  });

  it('addLane trims whitespace from the title', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
    mockPrisma.retroLane.count.mockResolvedValue(0);
    mockPrisma.retroLane.create.mockImplementation((args: any) => ({ id: 'lane-new', ...args.data }));

    const newLane = await retroService.addLane(BOARD_ID, { title: '  Trimmed  ' });

    expect(newLane.title).toBe('Trimmed');
  });

  it('addLane sets icon and color to null when not provided', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
    mockPrisma.retroLane.count.mockResolvedValue(0);
    mockPrisma.retroLane.create.mockImplementation((args: any) => ({ id: 'lane-new', ...args.data }));

    const newLane = await retroService.addLane(BOARD_ID, { title: 'No extras' });

    expect(newLane.icon).toBeNull();
    expect(newLane.color).toBeNull();
  });

  it('addLane rejects when the board has 8 lanes (LANE_LIMIT_EXCEEDED)', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
    mockPrisma.retroLane.count.mockResolvedValue(8);

    await expect(
      retroService.addLane(BOARD_ID, { title: 'Ninth lane' }),
    ).rejects.toMatchObject({ code: 'LANE_LIMIT_EXCEEDED' });
    expect(mockPrisma.retroLane.create).not.toHaveBeenCalled();
  });

  it('addLane rejects an empty title', async () => {
    await expect(
      retroService.addLane(BOARD_ID, { title: '   ' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockPrisma.retroBoard.findUnique).not.toHaveBeenCalled();
  });

  it('addLane rejects a title longer than 100 characters', async () => {
    await expect(
      retroService.addLane(BOARD_ID, { title: 'a'.repeat(101) }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockPrisma.retroBoard.findUnique).not.toHaveBeenCalled();
  });

  it('addLane rejects when the board does not exist', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(null);

    await expect(
      retroService.addLane(BOARD_ID, { title: 'Valid Title' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  // ── updateLane ──────────────────────────────────────────────────────────────

  it('updateLane updates the title, icon, and color', async () => {
    mockPrisma.retroLane.findUnique.mockResolvedValue(lane());
    mockPrisma.retroLane.update.mockImplementation((args: any) => ({ ...lane(), ...args.data }));

    const updated = await retroService.updateLane(LANE_ID, { title: 'Updated', icon: '🔥', color: '#00FF00' });

    expect(updated.title).toBe('Updated');
    expect(updated.icon).toBe('🔥');
    expect(updated.color).toBe('#00FF00');
  });

  it('updateLane allows partial updates (only title)', async () => {
    mockPrisma.retroLane.findUnique.mockResolvedValue(lane({ icon: '🎯', color: '#FF0000' }));
    mockPrisma.retroLane.update.mockImplementation((args: any) => ({ ...lane(), ...args.data }));

    await retroService.updateLane(LANE_ID, { title: 'Only Title' });

    expect(mockPrisma.retroLane.update).toHaveBeenCalledWith({
      where: { id: LANE_ID },
      data: { title: 'Only Title' },
    });
  });

  it('updateLane clears icon when set to null', async () => {
    mockPrisma.retroLane.findUnique.mockResolvedValue(lane({ icon: '🎯' }));
    mockPrisma.retroLane.update.mockImplementation((args: any) => ({ ...lane(), ...args.data }));

    await retroService.updateLane(LANE_ID, { icon: null });

    expect(mockPrisma.retroLane.update).toHaveBeenCalledWith({
      where: { id: LANE_ID },
      data: { icon: null },
    });
  });

  it('updateLane clears color when set to null', async () => {
    mockPrisma.retroLane.findUnique.mockResolvedValue(lane({ color: '#FF0000' }));
    mockPrisma.retroLane.update.mockImplementation((args: any) => ({ ...lane(), ...args.data }));

    await retroService.updateLane(LANE_ID, { color: null });

    expect(mockPrisma.retroLane.update).toHaveBeenCalledWith({
      where: { id: LANE_ID },
      data: { color: null },
    });
  });

  it('updateLane rejects an empty title', async () => {
    mockPrisma.retroLane.findUnique.mockResolvedValue(lane());

    await expect(
      retroService.updateLane(LANE_ID, { title: '   ' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockPrisma.retroLane.update).not.toHaveBeenCalled();
  });

  it('updateLane rejects a title longer than 100 characters', async () => {
    mockPrisma.retroLane.findUnique.mockResolvedValue(lane());

    await expect(
      retroService.updateLane(LANE_ID, { title: 'a'.repeat(101) }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockPrisma.retroLane.update).not.toHaveBeenCalled();
  });

  it('updateLane rejects when the lane does not exist', async () => {
    mockPrisma.retroLane.findUnique.mockResolvedValue(null);

    await expect(
      retroService.updateLane('missing', { title: 'Valid' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  // ── deleteLane ──────────────────────────────────────────────────────────────

  it('deleteLane removes the lane and cascades to its cards', async () => {
    mockPrisma.retroLane.findUnique.mockResolvedValue(lane());
    mockPrisma.retroLane.count.mockResolvedValue(3);
    mockPrisma.retroCard.findMany.mockResolvedValue([{ id: 'card-1' }, { id: 'card-2' }]);
    mockPrisma.retroVote.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.retroCard.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.retroLane.delete.mockResolvedValue(lane());

    await retroService.deleteLane(LANE_ID);

    expect(mockPrisma.retroVote.deleteMany).toHaveBeenCalledWith({
      where: { cardId: { in: ['card-1', 'card-2'] } },
    });
    expect(mockPrisma.retroCard.deleteMany).toHaveBeenCalledWith({
      where: { laneId: LANE_ID },
    });
    expect(mockPrisma.retroLane.delete).toHaveBeenCalledWith({
      where: { id: LANE_ID },
    });
  });

  it('deleteLane handles lanes with no cards', async () => {
    mockPrisma.retroLane.findUnique.mockResolvedValue(lane());
    mockPrisma.retroLane.count.mockResolvedValue(2);
    mockPrisma.retroCard.findMany.mockResolvedValue([]);
    mockPrisma.retroCard.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.retroLane.delete.mockResolvedValue(lane());

    await retroService.deleteLane(LANE_ID);

    // No votes to delete when no cards
    expect(mockPrisma.retroVote.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.retroCard.deleteMany).toHaveBeenCalledWith({ where: { laneId: LANE_ID } });
    expect(mockPrisma.retroLane.delete).toHaveBeenCalledWith({ where: { id: LANE_ID } });
  });

  it('deleteLane rejects when it is the last lane (MIN_LANES_REQUIRED)', async () => {
    mockPrisma.retroLane.findUnique.mockResolvedValue(lane());
    mockPrisma.retroLane.count.mockResolvedValue(1);

    await expect(retroService.deleteLane(LANE_ID)).rejects.toMatchObject({
      code: 'MIN_LANES_REQUIRED',
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('deleteLane rejects when the lane does not exist', async () => {
    mockPrisma.retroLane.findUnique.mockResolvedValue(null);

    await expect(retroService.deleteLane('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  // ── reorderLanes ────────────────────────────────────────────────────────────

  it('reorderLanes updates displayOrder for all lanes based on the input array', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
    mockPrisma.retroLane.findMany.mockResolvedValue([
      { id: 'lane-a' },
      { id: 'lane-b' },
      { id: 'lane-c' },
    ]);
    mockPrisma.retroLane.update.mockResolvedValue({});

    await retroService.reorderLanes(BOARD_ID, { laneIds: ['lane-c', 'lane-a', 'lane-b'] });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    // The transaction receives an array of update promises
    const transactionArg = mockPrisma.$transaction.mock.calls[0][0];
    expect(transactionArg).toHaveLength(3);
  });

  it('reorderLanes rejects when a lane ID does not belong to the board', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
    mockPrisma.retroLane.findMany.mockResolvedValue([
      { id: 'lane-a' },
      { id: 'lane-b' },
    ]);

    await expect(
      retroService.reorderLanes(BOARD_ID, { laneIds: ['lane-a', 'lane-unknown'] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('reorderLanes rejects when the input does not include all board lanes', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(board());
    mockPrisma.retroLane.findMany.mockResolvedValue([
      { id: 'lane-a' },
      { id: 'lane-b' },
      { id: 'lane-c' },
    ]);

    await expect(
      retroService.reorderLanes(BOARD_ID, { laneIds: ['lane-a', 'lane-b'] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('reorderLanes rejects when the board does not exist', async () => {
    mockPrisma.retroBoard.findUnique.mockResolvedValue(null);

    await expect(
      retroService.reorderLanes(BOARD_ID, { laneIds: ['lane-a'] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
