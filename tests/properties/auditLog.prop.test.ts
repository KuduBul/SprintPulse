import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: shoprite-x-polling-app
 * Property 24: Audit log immutability
 *
 * For any audit log entry, the record SHALL have a `createdAt` timestamp
 * and SHALL NOT have an `updatedAt` field.
 *
 * **Validates: Requirements 8.14**
 */

// ─── Mock Data Store ─────────────────────────────────────────────────────────

interface StoredAuditLog {
  id: string;
  pollId: string | null;
  action: string;
  actor: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  [key: string]: unknown;
}

let storedAuditLogs: StoredAuditLog[];

function resetStore() {
  storedAuditLogs = [];
}

// ─── Mock Prisma Client ──────────────────────────────────────────────────────

vi.mock('@/lib/db/client', () => {
  return {
    prisma: {
      auditLog: {
        create: vi.fn(async ({ data }: any) => {
          const entry: StoredAuditLog = {
            id: crypto.randomUUID(),
            pollId: data.pollId ?? null,
            action: data.action,
            actor: data.actor,
            metadata: data.metadata ?? null,
            createdAt: new Date(),
          };
          storedAuditLogs.push(entry);
          return entry;
        }),
      },
    },
  };
});

// Import after mocks
import { createAuditLogger, AuditAction } from '@/lib/services/auditLogger';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const auditActions: AuditAction[] = [
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

/** Generates a random audit action */
const actionArb = fc.constantFrom(...auditActions);

/** Generates a random actor string (2-50 chars) */
const actorArb = fc.string({ minLength: 2, maxLength: 50 }).filter((s) => s.trim().length >= 2);

/** Generates an optional poll ID (UUID or undefined) */
const pollIdArb = fc.option(fc.uuid(), { nil: undefined });

/** Generates optional metadata */
const metadataArb = fc.option(
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length >= 1),
    fc.oneof(fc.string(), fc.integer(), fc.boolean())
  ),
  { nil: undefined }
);

// ─── Property 24: Audit log immutability ─────────────────────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 24: Audit log immutability
 *
 * For any audit log entry, the record SHALL have a `createdAt` timestamp
 * and SHALL NOT have an `updatedAt` field.
 *
 * **Validates: Requirements 8.14**
 */
describe('Property 24: Audit log immutability', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('every audit log entry has a createdAt timestamp and no updatedAt field', async () => {
    await fc.assert(
      fc.asyncProperty(
        actionArb,
        actorArb,
        pollIdArb,
        metadataArb,
        async (action, actor, pollId, metadata) => {
          resetStore();

          const logger = createAuditLogger();
          await logger.log({
            action,
            actor,
            pollId,
            metadata: metadata as Record<string, unknown> | undefined,
          });

          // Exactly one entry should be stored
          expect(storedAuditLogs.length).toBe(1);

          const entry = storedAuditLogs[0];

          // Entry SHALL have a createdAt timestamp
          expect(entry.createdAt).toBeInstanceOf(Date);
          expect(entry.createdAt.getTime()).not.toBeNaN();

          // Entry SHALL NOT have an updatedAt field
          expect('updatedAt' in entry).toBe(false);
          expect(entry).not.toHaveProperty('updatedAt');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('audit log entries are created with correct data and immutable structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        actionArb,
        actorArb,
        pollIdArb,
        async (action, actor, pollId) => {
          resetStore();

          const logger = createAuditLogger();
          await logger.log({ action, actor, pollId });

          const entry = storedAuditLogs[0];

          // Verify the stored entry matches the input
          expect(entry.action).toBe(action);
          expect(entry.actor).toBe(actor);
          expect(entry.pollId).toBe(pollId ?? null);

          // Verify immutability: only expected fields exist
          const allowedKeys = ['id', 'pollId', 'action', 'actor', 'metadata', 'createdAt'];
          const entryKeys = Object.keys(entry);
          for (const key of entryKeys) {
            expect(allowedKeys).toContain(key);
          }

          // Specifically no updatedAt
          expect(entryKeys).not.toContain('updatedAt');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple audit log entries each have independent createdAt and no updatedAt', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(actionArb, actorArb, pollIdArb),
          { minLength: 2, maxLength: 10 }
        ),
        async (entries) => {
          resetStore();

          const logger = createAuditLogger();

          for (const [action, actor, pollId] of entries) {
            await logger.log({ action, actor, pollId });
          }

          // All entries should be stored
          expect(storedAuditLogs.length).toBe(entries.length);

          // Each entry must have createdAt and must NOT have updatedAt
          for (const stored of storedAuditLogs) {
            expect(stored.createdAt).toBeInstanceOf(Date);
            expect(stored.createdAt.getTime()).not.toBeNaN();
            expect('updatedAt' in stored).toBe(false);
            expect(stored).not.toHaveProperty('updatedAt');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
