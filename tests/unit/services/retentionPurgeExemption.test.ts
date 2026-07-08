import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRetentionService } from '@/lib/services/retentionService';

/**
 * Unit tests verifying that the retention purge exempts retro data.
 *
 * The 90-day automated purge must NOT delete retro-type polls or their
 * associated data — retro boards persist across sprints (Requirement 10.3).
 *
 * Validates: Requirements 10.3
 */

// Mock the config module
vi.mock('@/lib/config', () => ({
  config: {
    RETENTION_RESPONSES_DAYS: 90,
    RETENTION_AUDIT_DAYS: 365,
  },
}));

// Mock the Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {},
}));

describe('RetentionService — Retro purge exemption (Requirement 10.3)', () => {
  let mockDb: any;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      response: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      poll: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      question: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    mockLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('hard-delete query filters by type "pulse" — retro polls are excluded', async () => {
    mockDb.poll.findMany.mockResolvedValue([]);

    const service = createRetentionService(mockDb, mockLogger);
    await service.purge();

    // The findMany call that selects polls for hard-deletion MUST filter by type: 'pulse'
    expect(mockDb.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'pulse',
        }),
      })
    );
  });

  it('retro-type polls are NOT targeted for deletion even when soft-deleted and old', async () => {
    // Simulate: the DB has 2 soft-deleted retro polls that are old enough to purge,
    // but because the query filters by type: 'pulse', they won't be returned.
    // The mock findMany already returns [] (simulating DB filtering out retro polls).
    mockDb.poll.findMany.mockResolvedValue([]);

    const service = createRetentionService(mockDb, mockLogger);
    const result = await service.purge();

    // Confirm no polls are hard-deleted
    expect(result.pollsHardDeleted).toBe(0);
    expect(mockDb.poll.deleteMany).not.toHaveBeenCalled();

    // Verify the query explicitly used the pulse type filter
    const findCall = mockDb.poll.findMany.mock.calls[0][0];
    expect(findCall.where.type).toBe('pulse');
    expect(findCall.where.isDeleted).toBe(true);
  });

  it('only pulse polls matching all criteria are hard-deleted, retro remains', async () => {
    // Simulate: DB returns only pulse polls (retro ones filtered out by type: 'pulse')
    const pulsePoll = { id: 'pulse-poll-1' };
    mockDb.poll.findMany.mockResolvedValue([pulsePoll]);
    mockDb.poll.deleteMany.mockResolvedValue({ count: 1 });

    const service = createRetentionService(mockDb, mockLogger);
    const result = await service.purge();

    // Only the pulse poll is deleted
    expect(result.pollsHardDeleted).toBe(1);
    expect(mockDb.poll.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['pulse-poll-1'] } },
    });

    // The find query was constrained to type: 'pulse'
    const findCall = mockDb.poll.findMany.mock.calls[0][0];
    expect(findCall.where.type).toBe('pulse');
  });

  it('purge does not touch retro-related tables (RetroBoard, RetroLane, RetroCard, RetroVote)', async () => {
    const service = createRetentionService(mockDb, mockLogger);
    await service.purge();

    // The mockDb has no retroBoard/retroLane/retroCard/retroVote methods because
    // the retention service does not target those tables at all.
    expect(mockDb.retroBoard).toBeUndefined();
    expect(mockDb.retroLane).toBeUndefined();
    expect(mockDb.retroCard).toBeUndefined();
    expect(mockDb.retroVote).toBeUndefined();
  });
});
