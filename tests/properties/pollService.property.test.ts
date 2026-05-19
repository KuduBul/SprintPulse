import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: multi-tenant-facilitator-auth, Property 3: Poll creation records ownership
 *
 * For any valid poll creation input and any authenticated facilitator user ID,
 * calling `createPoll(input, userId)` SHALL produce a poll record where
 * `poll.userId` equals the provided user ID.
 *
 * Validates: Requirements 5.1
 */

// ─── Mock Store ──────────────────────────────────────────────────────────────

interface MockStore {
  polls: any[];
  auditLogs: any[];
}

let store: MockStore;

function createMockStore(): MockStore {
  return {
    polls: [],
    auditLogs: [],
  };
}

function createMockTx() {
  return {
    poll: {
      create: vi.fn(async ({ data }: any) => {
        const poll = {
          id: crypto.randomUUID(),
          title: data.title,
          description: data.description ?? null,
          backgroundImageUrl: data.backgroundImageUrl ?? null,
          userId: data.userId,
          teamId: data.teamId ?? null,
          accessToken: data.accessToken ?? crypto.randomUUID(),
          facilitatorState: data.facilitatorState,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.polls.push(poll);
        return poll;
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: any) => {
        const entry = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        store.auditLogs.push(entry);
        return entry;
      }),
    },
  };
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: vi.fn(async (fn: any) => {
      const tx = createMockTx();
      return fn(tx);
    }),
    poll: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
    },
  },
}));

vi.mock('@/lib/services/auditLogger', () => ({
  auditLogger: {
    log: vi.fn(async () => {}),
  },
}));

vi.mock('@/lib/services/tokenService', () => ({
  tokenService: {
    generateToken: vi.fn(() => 'mock-access-token-' + crypto.randomUUID().slice(0, 16)),
  },
}));

// Import after mocks
import { createPollService } from '@/lib/services/pollService';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a valid poll title (1–200 characters, non-empty after trim) */
const arbTitle = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

/** Generates a valid optional description (0–1000 characters) */
const arbDescription = fc.option(fc.string({ minLength: 0, maxLength: 1000 }), { nil: undefined });

/** Generates a valid optional teamId (UUID) */
const arbTeamId = fc.option(fc.uuid(), { nil: undefined });

/** Generates a valid CreatePollInput */
const arbCreatePollInput = fc.record({
  title: arbTitle,
  description: arbDescription,
  teamId: arbTeamId,
});

/** Generates a valid user ID (UUID) */
const arbUserId = fc.uuid();

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Feature: multi-tenant-facilitator-auth, Property 3: Poll creation records ownership', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 5.1**
   *
   * For any random poll input and any random user ID, the created poll
   * SHALL always have its `userId` field equal to the provided user ID.
   */
  it('created poll always has userId equal to the provided user ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbCreatePollInput,
        arbUserId,
        async (input, userId) => {
          store = createMockStore();

          const service = createPollService();
          const poll = await service.createPoll(input, userId);

          expect(poll.userId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.1**
   *
   * For any two different user IDs creating polls with the same input,
   * each poll SHALL record its respective creator's user ID.
   */
  it('different users creating identical polls get their own userId recorded', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbCreatePollInput,
        arbUserId,
        arbUserId.filter((id) => id.length > 0),
        async (input, userIdA, userIdB) => {
          // Skip if UUIDs happen to be the same (extremely unlikely but possible)
          fc.pre(userIdA !== userIdB);

          store = createMockStore();

          const service = createPollService();
          const pollA = await service.createPoll(input, userIdA);
          const pollB = await service.createPoll(input, userIdB);

          expect(pollA.userId).toBe(userIdA);
          expect(pollB.userId).toBe(userIdB);
          expect(pollA.userId).not.toBe(pollB.userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.1**
   *
   * For any user ID, the userId on the created poll is never null,
   * undefined, or an empty string — it is always the exact provided value.
   */
  it('userId is never null, undefined, or empty on created poll', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbCreatePollInput,
        arbUserId,
        async (input, userId) => {
          store = createMockStore();

          const service = createPollService();
          const poll = await service.createPoll(input, userId);

          expect(poll.userId).not.toBeNull();
          expect(poll.userId).not.toBeUndefined();
          expect(poll.userId).not.toBe('');
          expect(typeof poll.userId).toBe('string');
          expect(poll.userId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: multi-tenant-facilitator-auth, Property 4: Poll listing isolation
 *
 * For any set of polls in the database with various owner user IDs,
 * calling `listPolls(userId)` SHALL return only polls where
 * `poll.userId === userId` and `poll.isDeleted === false`,
 * and SHALL never include polls owned by a different user.
 *
 * Validates: Requirements 5.2
 */

// ─── Mocks for listPolls ─────────────────────────────────────────────────────

import { prisma } from '@/lib/db/client';

/** Generates a mock poll record */
const arbPollRecord = (userId: string, overrides?: { isDeleted?: boolean }) =>
  ({
    id: crypto.randomUUID(),
    title: 'Test Poll',
    description: null,
    backgroundImageUrl: null,
    userId,
    teamId: null,
    accessToken: crypto.randomUUID(),
    facilitatorState: { _v: 1, votingOpen: false, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
    isDeleted: overrides?.isDeleted ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
    tokenExpiresAt: null,
  });

/** Arbitrary for generating a list of polls with mixed owners */
const arbPollSet = fc.record({
  targetUserId: fc.uuid(),
  otherUserIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
  targetPollCount: fc.integer({ min: 0, max: 10 }),
  otherPollCounts: fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 1, maxLength: 5 }),
  deletedTargetPollCount: fc.integer({ min: 0, max: 3 }),
});

// ─── Property 4 Tests ────────────────────────────────────────────────────────

describe('Feature: multi-tenant-facilitator-auth, Property 4: Poll listing isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 5.2**
   *
   * For any random set of polls with mixed owner UUIDs,
   * listPolls(userId) SHALL return only polls where poll.userId === userId
   * and poll.isDeleted === false.
   */
  it('listPolls returns only polls belonging to the specified userId and not deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPollSet,
        async ({ targetUserId, otherUserIds, targetPollCount, otherPollCounts, deletedTargetPollCount }) => {
          // Build the simulated database of polls
          const allPolls: any[] = [];

          // Active polls for the target user
          for (let i = 0; i < targetPollCount; i++) {
            allPolls.push(arbPollRecord(targetUserId));
          }

          // Deleted polls for the target user (should NOT be returned)
          for (let i = 0; i < deletedTargetPollCount; i++) {
            allPolls.push(arbPollRecord(targetUserId, { isDeleted: true }));
          }

          // Polls for other users
          otherUserIds.forEach((otherUserId, idx) => {
            const count = otherPollCounts[idx % otherPollCounts.length] ?? 1;
            for (let i = 0; i < count; i++) {
              allPolls.push(arbPollRecord(otherUserId));
            }
          });

          // Mock prisma.poll.findMany to simulate the WHERE clause
          vi.mocked(prisma.poll.findMany).mockImplementation(async (args: any) => {
            const where = args?.where ?? {};
            return allPolls.filter((poll) => {
              if (where.userId && poll.userId !== where.userId) return false;
              if (where.isDeleted !== undefined && poll.isDeleted !== where.isDeleted) return false;
              return true;
            });
          });

          const service = createPollService();
          const result = await service.listPolls(targetUserId);

          // All returned polls must belong to the target user
          for (const poll of result) {
            expect(poll.userId).toBe(targetUserId);
          }

          // No returned poll should be deleted
          for (const poll of result) {
            expect(poll.isDeleted).toBe(false);
          }

          // The count should match the number of active target user polls
          expect(result.length).toBe(targetPollCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.2**
   *
   * For any two distinct users, listPolls for one user SHALL never
   * include polls owned by the other user.
   */
  it('listPolls never includes polls owned by a different user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        async (userIdA, userIdB, countA, countB) => {
          fc.pre(userIdA !== userIdB);

          const allPolls: any[] = [];

          for (let i = 0; i < countA; i++) {
            allPolls.push(arbPollRecord(userIdA));
          }
          for (let i = 0; i < countB; i++) {
            allPolls.push(arbPollRecord(userIdB));
          }

          vi.mocked(prisma.poll.findMany).mockImplementation(async (args: any) => {
            const where = args?.where ?? {};
            return allPolls.filter((poll) => {
              if (where.userId && poll.userId !== where.userId) return false;
              if (where.isDeleted !== undefined && poll.isDeleted !== where.isDeleted) return false;
              return true;
            });
          });

          const service = createPollService();

          const resultA = await service.listPolls(userIdA);
          const resultB = await service.listPolls(userIdB);

          // User A's listing should never contain User B's polls
          for (const poll of resultA) {
            expect(poll.userId).not.toBe(userIdB);
          }

          // User B's listing should never contain User A's polls
          for (const poll of resultB) {
            expect(poll.userId).not.toBe(userIdA);
          }

          // Counts should match
          expect(resultA.length).toBe(countA);
          expect(resultB.length).toBe(countB);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: multi-tenant-facilitator-auth, Property 5: Non-owner access denied
 *
 * For any poll owned by user A and any user B where A ≠ B,
 * calling `getPoll(pollId, B)`, `updatePoll(pollId, data, B)`,
 * `deletePoll(pollId, B)`, `clonePoll(pollId, B)`, or `resetResponses(pollId, B)`
 * SHALL result in a rejection (null return or ForbiddenError),
 * never returning or modifying the poll data.
 *
 * Validates: Requirements 5.3, 5.4
 */

// ─── Property 5 Tests ────────────────────────────────────────────────────────

describe('Feature: multi-tenant-facilitator-auth, Property 5: Non-owner access denied', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 5.3, 5.4**
   *
   * For any poll owned by user A and any user B (A ≠ B),
   * getPoll(pollId, B) SHALL return null.
   */
  it('getPoll returns null when called by a non-owner', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (ownerUserId, nonOwnerUserId, pollId) => {
          fc.pre(ownerUserId !== nonOwnerUserId);

          // Mock findFirst to simulate ownership check:
          // returns the poll only when userId matches the owner
          vi.mocked(prisma.poll.findFirst).mockImplementation(async (args: any) => {
            const where = args?.where ?? {};
            if (where.id === pollId && where.userId === ownerUserId && where.isDeleted === false) {
              return arbPollRecord(ownerUserId);
            }
            return null;
          });

          const service = createPollService();
          const result = await service.getPoll(pollId, nonOwnerUserId);

          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.3, 5.4**
   *
   * For any poll owned by user A and any user B (A ≠ B),
   * updatePoll(pollId, data, B) SHALL return null (access denied).
   */
  it('updatePoll returns null when called by a non-owner', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (ownerUserId, nonOwnerUserId, pollId) => {
          fc.pre(ownerUserId !== nonOwnerUserId);

          vi.mocked(prisma.poll.findFirst).mockImplementation(async (args: any) => {
            const where = args?.where ?? {};
            if (where.id === pollId && where.userId === ownerUserId && where.isDeleted === false) {
              return arbPollRecord(ownerUserId);
            }
            return null;
          });

          const service = createPollService();
          const result = await service.updatePoll(pollId, { title: 'Hacked Title' }, nonOwnerUserId);

          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.3, 5.4**
   *
   * For any poll owned by user A and any user B (A ≠ B),
   * deletePoll(pollId, B) SHALL return false (access denied).
   */
  it('deletePoll returns false when called by a non-owner', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (ownerUserId, nonOwnerUserId, pollId) => {
          fc.pre(ownerUserId !== nonOwnerUserId);

          vi.mocked(prisma.poll.findFirst).mockImplementation(async (args: any) => {
            const where = args?.where ?? {};
            if (where.id === pollId && where.userId === ownerUserId && where.isDeleted === false) {
              return arbPollRecord(ownerUserId);
            }
            return null;
          });

          const service = createPollService();
          const result = await service.deletePoll(pollId, nonOwnerUserId);

          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.3, 5.4**
   *
   * For any poll owned by user A and any user B (A ≠ B),
   * clonePoll(pollId, B) SHALL return null (access denied).
   */
  it('clonePoll returns null when called by a non-owner', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (ownerUserId, nonOwnerUserId, pollId) => {
          fc.pre(ownerUserId !== nonOwnerUserId);

          vi.mocked(prisma.poll.findFirst).mockImplementation(async (args: any) => {
            const where = args?.where ?? {};
            if (where.id === pollId && where.userId === ownerUserId && where.isDeleted === false) {
              return arbPollRecord(ownerUserId);
            }
            return null;
          });

          const service = createPollService();
          const result = await service.clonePoll(pollId, nonOwnerUserId);

          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.3, 5.4**
   *
   * For any poll owned by user A and any user B (A ≠ B),
   * resetResponses(pollId, B) SHALL return false (access denied).
   */
  it('resetResponses returns false when called by a non-owner', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (ownerUserId, nonOwnerUserId, pollId) => {
          fc.pre(ownerUserId !== nonOwnerUserId);

          vi.mocked(prisma.poll.findFirst).mockImplementation(async (args: any) => {
            const where = args?.where ?? {};
            if (where.id === pollId && where.userId === ownerUserId && where.isDeleted === false) {
              return arbPollRecord(ownerUserId);
            }
            return null;
          });

          const service = createPollService();
          const result = await service.resetResponses(pollId, nonOwnerUserId);

          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.3, 5.4**
   *
   * Combined property: for any poll owned by user A and any user B (A ≠ B),
   * ALL ownership-gated operations SHALL deny access to user B.
   */
  it('all ownership-gated operations deny access to non-owners', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        async (ownerUserId, nonOwnerUserId, pollId) => {
          fc.pre(ownerUserId !== nonOwnerUserId);

          vi.mocked(prisma.poll.findFirst).mockImplementation(async (args: any) => {
            const where = args?.where ?? {};
            if (where.id === pollId && where.userId === ownerUserId && where.isDeleted === false) {
              return { ...arbPollRecord(ownerUserId), id: pollId, questions: [] };
            }
            return null;
          });

          const service = createPollService();

          const getResult = await service.getPoll(pollId, nonOwnerUserId);
          const updateResult = await service.updatePoll(pollId, { title: 'X' }, nonOwnerUserId);
          const deleteResult = await service.deletePoll(pollId, nonOwnerUserId);
          const cloneResult = await service.clonePoll(pollId, nonOwnerUserId);
          const resetResult = await service.resetResponses(pollId, nonOwnerUserId);

          // All operations must deny access
          expect(getResult).toBeNull();
          expect(updateResult).toBeNull();
          expect(deleteResult).toBe(false);
          expect(cloneResult).toBeNull();
          expect(resetResult).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
