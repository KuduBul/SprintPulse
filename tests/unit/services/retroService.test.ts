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
  },
  retroVote: {
    findMany: vi.fn(),
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
