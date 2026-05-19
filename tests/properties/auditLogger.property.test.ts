import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { createAuditLogger, type AuditAction, type AuditEntry } from '../../lib/services/auditLogger';

/**
 * Feature: multi-tenant-facilitator-auth, Property 7: Audit log records authenticated actor identity
 *
 * For any auditable action performed by an authenticated facilitator with user ID `uid`,
 * the resulting AuditLog record SHALL have its `actor` field set to `uid`
 * (not the string "admin" or any other generic value).
 *
 * Validates: Requirements 10.1, 10.2
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../lib/db/client', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from '../../lib/db/client';

const mockedPrisma = vi.mocked(prisma);

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * All valid audit actions in the system.
 */
const allAuditActions: AuditAction[] = [
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
  'TOKEN_REGENERATED',
  'DATA_PURGED',
];

/**
 * Generates a random audit action from the set of all valid actions.
 */
const arbAuditAction: fc.Arbitrary<AuditAction> = fc.constantFrom(...allAuditActions);

/**
 * Generates optional metadata for audit entries.
 */
const arbMetadata = fc.oneof(
  fc.constant(undefined),
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.oneof(fc.string({ maxLength: 50 }), fc.integer(), fc.boolean())
  )
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Feature: multi-tenant-facilitator-auth, Property 7: Audit log records authenticated actor identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPrisma.auditLog.create.mockResolvedValue({
      id: 'mock-id',
      pollId: null,
      action: '',
      actor: '',
      metadata: null,
      createdAt: new Date(),
    });
  });

  /**
   * **Validates: Requirements 10.1, 10.2**
   *
   * For any random UUID used as the actor (facilitator userId) and any audit action,
   * the audit logger SHALL always record the exact userId as the actor field.
   */
  it('always records the exact userId as the actor field', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        arbAuditAction,
        fc.uuid(),
        arbMetadata,
        async (userId, action, pollId, metadata) => {
          vi.clearAllMocks();
          mockedPrisma.auditLog.create.mockResolvedValue({
            id: 'mock-id',
            pollId,
            action,
            actor: userId,
            metadata: metadata ?? null,
            createdAt: new Date(),
          });

          const logger = createAuditLogger();

          const entry: AuditEntry = {
            pollId,
            action,
            actor: userId,
            metadata,
          };

          await logger.log(entry);

          // Verify prisma.auditLog.create was called with the exact userId as actor
          expect(mockedPrisma.auditLog.create).toHaveBeenCalledTimes(1);
          const createCall = mockedPrisma.auditLog.create.mock.calls[0][0];
          expect(createCall.data.actor).toBe(userId);
          // The actor must NOT be a generic value
          expect(createCall.data.actor).not.toBe('admin');
          expect(createCall.data.actor).not.toBe('system');
          expect(createCall.data.actor).not.toBe('unknown');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 10.1, 10.2**
   *
   * For any random UUID, the actor field is preserved even when using a
   * transaction client — the audit logger never substitutes a generic value.
   */
  it('preserves actor identity when logging within a transaction', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        arbAuditAction,
        async (userId, action) => {
          // Create a mock transaction client
          const mockTx = {
            auditLog: {
              create: vi.fn().mockResolvedValue({
                id: 'mock-id',
                pollId: null,
                action,
                actor: userId,
                metadata: null,
                createdAt: new Date(),
              }),
            },
          } as any;

          const logger = createAuditLogger();

          const entry: AuditEntry = {
            action,
            actor: userId,
          };

          await logger.log(entry, mockTx);

          // Verify the transaction client was used (not the global prisma)
          expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1);
          const createCall = mockTx.auditLog.create.mock.calls[0][0];
          expect(createCall.data.actor).toBe(userId);
          expect(createCall.data.actor).not.toBe('admin');
        }
      ),
      { numRuns: 100 }
    );
  });
});
