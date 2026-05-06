import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFacilitatorService } from '@/lib/services/facilitatorService';

// Mock the Prisma client
const mockPrisma = {
  $transaction: vi.fn(),
  poll: {
    findFirstOrThrow: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock('@/lib/db/client', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/services/auditLogger', () => ({
  auditLogger: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import { auditLogger } from '@/lib/services/auditLogger';

describe('FacilitatorService', () => {
  let facilitatorService: ReturnType<typeof createFacilitatorService>;

  beforeEach(() => {
    vi.clearAllMocks();
    facilitatorService = createFacilitatorService();
  });

  describe('getState', () => {
    it('returns parsed facilitator state from poll', async () => {
      mockPrisma.poll.findFirstOrThrow.mockResolvedValue({
        facilitatorState: {
          _v: 1,
          votingOpen: true,
          liveResults: true,
          anonymise: false,
          revealStage: 'COUNTS',
        },
      });

      const result = await facilitatorService.getState('poll-1');

      expect(result).toEqual({
        votingOpen: true,
        liveResults: true,
        anonymise: false,
        revealStage: 'COUNTS',
      });
    });

    it('excludes the _v key from the returned state', async () => {
      mockPrisma.poll.findFirstOrThrow.mockResolvedValue({
        facilitatorState: {
          _v: 1,
          votingOpen: false,
          liveResults: false,
          anonymise: true,
          revealStage: 'HIDDEN',
        },
      });

      const result = await facilitatorService.getState('poll-1');

      expect(result).not.toHaveProperty('_v');
    });

    it('returns defaults when facilitatorState is null', async () => {
      mockPrisma.poll.findFirstOrThrow.mockResolvedValue({
        facilitatorState: null,
      });

      const result = await facilitatorService.getState('poll-1');

      expect(result).toEqual({
        votingOpen: false,
        liveResults: false,
        anonymise: true,
        revealStage: 'HIDDEN',
      });
    });

    it('returns defaults when facilitatorState is empty object', async () => {
      mockPrisma.poll.findFirstOrThrow.mockResolvedValue({
        facilitatorState: {},
      });

      const result = await facilitatorService.getState('poll-1');

      expect(result).toEqual({
        votingOpen: false,
        liveResults: false,
        anonymise: true,
        revealStage: 'HIDDEN',
      });
    });

    it('handles invalid revealStage by defaulting to HIDDEN', async () => {
      mockPrisma.poll.findFirstOrThrow.mockResolvedValue({
        facilitatorState: {
          _v: 1,
          votingOpen: true,
          liveResults: false,
          anonymise: true,
          revealStage: 'INVALID_VALUE',
        },
      });

      const result = await facilitatorService.getState('poll-1');

      expect(result.revealStage).toBe('HIDDEN');
    });

    it('handles missing fields by using defaults', async () => {
      mockPrisma.poll.findFirstOrThrow.mockResolvedValue({
        facilitatorState: {
          _v: 1,
          votingOpen: true,
          // liveResults, anonymise, revealStage missing
        },
      });

      const result = await facilitatorService.getState('poll-1');

      expect(result.votingOpen).toBe(true);
      expect(result.liveResults).toBe(false);
      expect(result.anonymise).toBe(true);
      expect(result.revealStage).toBe('HIDDEN');
    });

    it('queries the correct poll by ID', async () => {
      mockPrisma.poll.findFirstOrThrow.mockResolvedValue({
        facilitatorState: { _v: 1, votingOpen: false, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
      });

      await facilitatorService.getState('my-poll-id');

      expect(mockPrisma.poll.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: 'my-poll-id' },
        select: { facilitatorState: true },
      });
    });
  });

  describe('updateState', () => {
    beforeEach(() => {
      // Default $transaction implementation
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findFirstOrThrow: vi.fn().mockResolvedValue({
              facilitatorState: {
                _v: 1,
                votingOpen: false,
                liveResults: false,
                anonymise: true,
                revealStage: 'HIDDEN',
              },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });
    });

    it('merges partial patch into existing state', async () => {
      const result = await facilitatorService.updateState('poll-1', { votingOpen: true });

      expect(result).toEqual({
        votingOpen: true,
        liveResults: false,
        anonymise: true,
        revealStage: 'HIDDEN',
      });
    });

    it('merges multiple fields in a single patch', async () => {
      const result = await facilitatorService.updateState('poll-1', {
        votingOpen: true,
        liveResults: true,
        revealStage: 'COUNTS',
      });

      expect(result).toEqual({
        votingOpen: true,
        liveResults: true,
        anonymise: true,
        revealStage: 'COUNTS',
      });
    });

    it('persists merged state with _v key preserved', async () => {
      let updateData: any;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findFirstOrThrow: vi.fn().mockResolvedValue({
              facilitatorState: {
                _v: 1,
                votingOpen: false,
                liveResults: false,
                anonymise: true,
                revealStage: 'HIDDEN',
              },
            }),
            update: vi.fn().mockImplementation((args: any) => {
              updateData = args.data;
              return {};
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await facilitatorService.updateState('poll-1', { votingOpen: true });

      expect(updateData.facilitatorState).toEqual({
        _v: 1,
        votingOpen: true,
        liveResults: false,
        anonymise: true,
        revealStage: 'HIDDEN',
      });
    });

    it('logs VOTING_OPENED when votingOpen changes from false to true', async () => {
      await facilitatorService.updateState('poll-1', { votingOpen: true });

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          pollId: 'poll-1',
          action: 'VOTING_OPENED',
          actor: 'admin',
        }),
        expect.anything(),
      );
    });

    it('logs VOTING_CLOSED when votingOpen changes from true to false', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findFirstOrThrow: vi.fn().mockResolvedValue({
              facilitatorState: {
                _v: 1,
                votingOpen: true,
                liveResults: false,
                anonymise: true,
                revealStage: 'HIDDEN',
              },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await facilitatorService.updateState('poll-1', { votingOpen: false });

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          pollId: 'poll-1',
          action: 'VOTING_CLOSED',
          actor: 'admin',
        }),
        expect.anything(),
      );
    });

    it('does not log VOTING_OPENED/CLOSED when votingOpen does not change', async () => {
      // Current state has votingOpen: false, patch also sets false
      await facilitatorService.updateState('poll-1', { votingOpen: false });

      const logCalls = (auditLogger.log as any).mock.calls;
      const votingActions = logCalls.filter(
        (call: any) => call[0].action === 'VOTING_OPENED' || call[0].action === 'VOTING_CLOSED',
      );
      expect(votingActions).toHaveLength(0);
    });

    it('logs REVEAL_STAGE_CHANGED when revealStage changes', async () => {
      await facilitatorService.updateState('poll-1', { revealStage: 'COUNTS' });

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          pollId: 'poll-1',
          action: 'REVEAL_STAGE_CHANGED',
          actor: 'admin',
          metadata: expect.objectContaining({
            from: 'HIDDEN',
            to: 'COUNTS',
          }),
        }),
        expect.anything(),
      );
    });

    it('does not log REVEAL_STAGE_CHANGED when revealStage does not change', async () => {
      // Current state has revealStage: 'HIDDEN', patch also sets 'HIDDEN'
      await facilitatorService.updateState('poll-1', { revealStage: 'HIDDEN' });

      const logCalls = (auditLogger.log as any).mock.calls;
      const revealActions = logCalls.filter(
        (call: any) => call[0].action === 'REVEAL_STAGE_CHANGED',
      );
      expect(revealActions).toHaveLength(0);
    });

    it('always logs FACILITATOR_STATE_UPDATED for any state change', async () => {
      await facilitatorService.updateState('poll-1', { anonymise: false });

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          pollId: 'poll-1',
          action: 'FACILITATOR_STATE_UPDATED',
          actor: 'admin',
          metadata: expect.objectContaining({
            patch: { anonymise: false },
            previousState: {
              votingOpen: false,
              liveResults: false,
              anonymise: true,
              revealStage: 'HIDDEN',
            },
            newState: {
              votingOpen: false,
              liveResults: false,
              anonymise: false,
              revealStage: 'HIDDEN',
            },
          }),
        }),
        expect.anything(),
      );
    });

    it('logs multiple specific actions when multiple fields change', async () => {
      await facilitatorService.updateState('poll-1', {
        votingOpen: true,
        revealStage: 'DETAILS',
      });

      const logCalls = (auditLogger.log as any).mock.calls;
      const actions = logCalls.map((call: any) => call[0].action);

      expect(actions).toContain('VOTING_OPENED');
      expect(actions).toContain('REVEAL_STAGE_CHANGED');
      expect(actions).toContain('FACILITATOR_STATE_UPDATED');
    });

    it('uses last-write-wins strategy (patch overrides current)', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findFirstOrThrow: vi.fn().mockResolvedValue({
              facilitatorState: {
                _v: 1,
                votingOpen: true,
                liveResults: true,
                anonymise: false,
                revealStage: 'DETAILS',
              },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await facilitatorService.updateState('poll-1', {
        votingOpen: false,
        revealStage: 'HIDDEN',
      });

      expect(result).toEqual({
        votingOpen: false,
        liveResults: true,
        anonymise: false,
        revealStage: 'HIDDEN',
      });
    });

    it('does not modify fields not included in the patch', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findFirstOrThrow: vi.fn().mockResolvedValue({
              facilitatorState: {
                _v: 1,
                votingOpen: true,
                liveResults: true,
                anonymise: false,
                revealStage: 'COUNTS',
              },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await facilitatorService.updateState('poll-1', { anonymise: true });

      expect(result.votingOpen).toBe(true);
      expect(result.liveResults).toBe(true);
      expect(result.revealStage).toBe('COUNTS');
      expect(result.anonymise).toBe(true);
    });

    it('persists state to the correct poll', async () => {
      let updateWhere: any;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findFirstOrThrow: vi.fn().mockResolvedValue({
              facilitatorState: { _v: 1, votingOpen: false, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
            }),
            update: vi.fn().mockImplementation((args: any) => {
              updateWhere = args.where;
              return {};
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await facilitatorService.updateState('specific-poll-id', { votingOpen: true });

      expect(updateWhere).toEqual({ id: 'specific-poll-id' });
    });
  });
});
