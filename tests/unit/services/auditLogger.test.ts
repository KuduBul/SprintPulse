import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuditLogger, AuditAction, AuditEntry } from '@/lib/services/auditLogger';

// Mock the Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    },
  },
}));

import { prisma } from '@/lib/db/client';

describe('AuditLogger', () => {
  let auditLogger: ReturnType<typeof createAuditLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    auditLogger = createAuditLogger();
  });

  describe('log', () => {
    it('creates an audit log entry with the default prisma client when no tx is provided', async () => {
      const entry: AuditEntry = {
        pollId: 'poll-123',
        action: 'POLL_CREATED',
        actor: 'admin',
        metadata: { title: 'Test Poll' },
      };

      await auditLogger.log(entry);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          pollId: 'poll-123',
          action: 'POLL_CREATED',
          actor: 'admin',
          metadata: { title: 'Test Poll' },
        },
      });
    });

    it('uses the transaction client when tx is provided', async () => {
      const mockTx = {
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'tx-id' }),
        },
      } as any;

      const entry: AuditEntry = {
        pollId: 'poll-456',
        action: 'POLL_UPDATED',
        actor: 'admin',
        metadata: { field: 'title' },
      };

      await auditLogger.log(entry, mockTx);

      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: {
          pollId: 'poll-456',
          action: 'POLL_UPDATED',
          actor: 'admin',
          metadata: { field: 'title' },
        },
      });
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('sets pollId to null when not provided', async () => {
      const entry: AuditEntry = {
        action: 'DATA_PURGED',
        actor: 'system',
        metadata: { responsesDeleted: 10 },
      };

      await auditLogger.log(entry);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          pollId: null,
          action: 'DATA_PURGED',
          actor: 'system',
          metadata: { responsesDeleted: 10 },
        },
      });
    });

    it('handles entries without metadata', async () => {
      const entry: AuditEntry = {
        pollId: 'poll-789',
        action: 'POLL_DELETED',
        actor: 'admin',
      };

      await auditLogger.log(entry);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pollId: 'poll-789',
          action: 'POLL_DELETED',
          actor: 'admin',
        }),
      });
    });

    const allActions: AuditAction[] = [
      'POLL_CREATED',
      'POLL_UPDATED',
      'POLL_DELETED',
      'POLL_CLONED',
      'QUESTION_CREATED',
      'QUESTION_UPDATED',
      'QUESTION_DELETED',
      'RESPONSES_SUBMITTED',
      'RESPONSES_RESET',
      'FACILITATOR_SESSION_STARTED',
      'FACILITATOR_STATE_UPDATED',
      'REVEAL_STAGE_CHANGED',
      'VOTING_OPENED',
      'VOTING_CLOSED',
      'DATA_PURGED',
    ];

    it.each(allActions)('supports action type: %s', async (action) => {
      const entry: AuditEntry = {
        pollId: 'poll-test',
        action,
        actor: 'admin',
      };

      await auditLogger.log(entry);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action,
        }),
      });
    });
  });
});
