import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRetentionService } from '@/lib/services/retentionService';

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

describe('RetentionService', () => {
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

  describe('purge', () => {
    it('deletes responses older than RETENTION_RESPONSES_DAYS', async () => {
      mockDb.response.deleteMany.mockResolvedValue({ count: 5 });

      const service = createRetentionService(mockDb, mockLogger);
      const result = await service.purge();

      expect(mockDb.response.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });

      // Verify the cutoff date is approximately 90 days ago
      const call = mockDb.response.deleteMany.mock.calls[0][0];
      const cutoffDate = call.where.createdAt.lt;
      const now = new Date();
      const expectedCutoff = new Date(now);
      expectedCutoff.setDate(expectedCutoff.getDate() - 90);

      // Allow 1 second tolerance
      expect(Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())).toBeLessThan(1000);
      expect(result.responsesDeleted).toBe(5);
    });

    it('deletes audit logs older than RETENTION_AUDIT_DAYS', async () => {
      mockDb.auditLog.deleteMany.mockResolvedValue({ count: 10 });

      const service = createRetentionService(mockDb, mockLogger);
      const result = await service.purge();

      expect(mockDb.auditLog.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });

      // Verify the cutoff date is approximately 365 days ago
      const call = mockDb.auditLog.deleteMany.mock.calls[0][0];
      const cutoffDate = call.where.createdAt.lt;
      const now = new Date();
      const expectedCutoff = new Date(now);
      expectedCutoff.setDate(expectedCutoff.getDate() - 365);

      // Allow 1 second tolerance
      expect(Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())).toBeLessThan(1000);
      expect(result.auditLogsDeleted).toBe(10);
    });

    it('hard-deletes soft-deleted polls older than 30 days', async () => {
      const oldPolls = [
        { id: 'poll-1' },
        { id: 'poll-2' },
      ];
      mockDb.poll.findMany.mockResolvedValue(oldPolls);
      mockDb.poll.deleteMany.mockResolvedValue({ count: 2 });

      const service = createRetentionService(mockDb, mockLogger);
      const result = await service.purge();

      // Verify it queries for soft-deleted polls older than 30 days
      expect(mockDb.poll.findMany).toHaveBeenCalledWith({
        where: {
          isDeleted: true,
          updatedAt: {
            lt: expect.any(Date),
          },
        },
        select: { id: true },
      });

      // Verify the cutoff date is approximately 30 days ago
      const findCall = mockDb.poll.findMany.mock.calls[0][0];
      const cutoffDate = findCall.where.updatedAt.lt;
      const now = new Date();
      const expectedCutoff = new Date(now);
      expectedCutoff.setDate(expectedCutoff.getDate() - 30);
      expect(Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())).toBeLessThan(1000);

      // Verify related records are deleted before polls
      expect(mockDb.response.deleteMany).toHaveBeenCalledWith({
        where: { pollId: { in: ['poll-1', 'poll-2'] } },
      });
      expect(mockDb.auditLog.deleteMany).toHaveBeenCalledWith({
        where: { pollId: { in: ['poll-1', 'poll-2'] } },
      });
      expect(mockDb.question.deleteMany).toHaveBeenCalledWith({
        where: { pollId: { in: ['poll-1', 'poll-2'] } },
      });
      expect(mockDb.poll.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['poll-1', 'poll-2'] } },
      });

      expect(result.pollsHardDeleted).toBe(2);
    });

    it('does not attempt to delete related records when no polls need hard-deletion', async () => {
      mockDb.poll.findMany.mockResolvedValue([]);

      const service = createRetentionService(mockDb, mockLogger);
      await service.purge();

      // response.deleteMany is called once for the retention purge, not for poll cleanup
      expect(mockDb.response.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockDb.question.deleteMany).not.toHaveBeenCalled();
      expect(mockDb.poll.deleteMany).not.toHaveBeenCalled();
    });

    it('logs DATA_PURGED action with counts via AuditLogger', async () => {
      mockDb.response.deleteMany.mockResolvedValue({ count: 3 });
      mockDb.auditLog.deleteMany.mockResolvedValue({ count: 7 });
      mockDb.poll.findMany.mockResolvedValue([{ id: 'poll-x' }]);
      mockDb.poll.deleteMany.mockResolvedValue({ count: 1 });

      const service = createRetentionService(mockDb, mockLogger);
      await service.purge();

      expect(mockLogger.log).toHaveBeenCalledWith({
        action: 'DATA_PURGED',
        actor: 'system',
        metadata: {
          responsesDeleted: 3,
          auditLogsDeleted: 7,
          pollsHardDeleted: 1,
        },
      });
    });

    it('returns a PurgeResult with all counts', async () => {
      mockDb.response.deleteMany.mockResolvedValue({ count: 15 });
      mockDb.auditLog.deleteMany.mockResolvedValue({ count: 20 });
      mockDb.poll.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]);
      mockDb.poll.deleteMany.mockResolvedValue({ count: 3 });

      const service = createRetentionService(mockDb, mockLogger);
      const result = await service.purge();

      expect(result).toEqual({
        responsesDeleted: 15,
        auditLogsDeleted: 20,
        pollsHardDeleted: 3,
      });
    });

    it('returns zero counts when nothing needs purging', async () => {
      const service = createRetentionService(mockDb, mockLogger);
      const result = await service.purge();

      expect(result).toEqual({
        responsesDeleted: 0,
        auditLogsDeleted: 0,
        pollsHardDeleted: 0,
      });
    });

    it('applies same retention policy to test and real responses (no isTest filter)', async () => {
      mockDb.response.deleteMany.mockResolvedValue({ count: 8 });

      const service = createRetentionService(mockDb, mockLogger);
      await service.purge();

      // Verify the response deletion does NOT filter by isTest
      const call = mockDb.response.deleteMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('isTest');
    });
  });
});
