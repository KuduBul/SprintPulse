import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: shoprite-x-polling-app
 * Property 1: Poll creation round-trip
 * Property 3: Poll reset removes all responses
 * Property 4: Clone produces identical questions with zero responses and preserves original
 * Property 5: Soft-deleted polls are hidden from views but retained in database
 * Property 12: Facilitator state defaults
 *
 * Validates: Requirements 1.1, 1.6, 1.7, 1.8, 1.9, 1.10, 5.1
 */

// ─── Mock Prisma Client ──────────────────────────────────────────────────────

// In-memory store for mocked database
interface MockStore {
  polls: any[];
  questions: any[];
  responses: any[];
  auditLogs: any[];
}

let store: MockStore;

function createMockStore(): MockStore {
  return {
    polls: [],
    questions: [],
    responses: [],
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
          facilitatorState: data.facilitatorState,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.polls.push(poll);
        return poll;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const poll = store.polls.find((p) => p.id === where.id);
        if (poll) {
          Object.assign(poll, data, { updatedAt: new Date() });
        }
        return poll;
      }),
      findFirst: vi.fn(async ({ where, include }: any) => {
        const poll = store.polls.find((p) => {
          let match = true;
          if (where.id) match = match && p.id === where.id;
          if (where.userId) match = match && p.userId === where.userId;
          if (where.isDeleted !== undefined) match = match && p.isDeleted === where.isDeleted;
          return match;
        });
        if (!poll) return null;
        if (include?.questions) {
          return { ...poll, questions: store.questions.filter((q) => q.pollId === poll.id) };
        }
        return poll;
      }),
      findMany: vi.fn(async ({ where, orderBy }: any) => {
        let results = store.polls.filter((p) => {
          let match = true;
          if (where.userId) match = match && p.userId === where.userId;
          if (where.isDeleted !== undefined) match = match && p.isDeleted === where.isDeleted;
          return match;
        });
        if (orderBy?.createdAt === 'desc') {
          results.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return results;
      }),
    },
    question: {
      createMany: vi.fn(async ({ data }: any) => {
        for (const q of data) {
          store.questions.push({
            id: crypto.randomUUID(),
            ...q,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        return { count: data.length };
      }),
    },
    response: {
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = store.responses.length;
        store.responses = store.responses.filter((r) => r.pollId !== where.pollId);
        return { count: before - store.responses.length };
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: any) => {
        const entry = {
          id: crypto.randomUUID(),
          ...data,
          createdAt: new Date(),
        };
        store.auditLogs.push(entry);
        return entry;
      }),
    },
  };
}

// Mock the prisma module
vi.mock('@/lib/db/client', () => {
  return {
    prisma: {
      $transaction: vi.fn(async (fn: any) => {
        const tx = createMockTx();
        return fn(tx);
      }),
      poll: {
        findFirst: vi.fn(async ({ where, include }: any) => {
          const poll = store.polls.find((p: any) => {
            let match = true;
            if (where.id) match = match && p.id === where.id;
            if (where.userId) match = match && p.userId === where.userId;
            if (where.isDeleted !== undefined) match = match && p.isDeleted === where.isDeleted;
            return match;
          });
          if (!poll) return null;
          if (include?.questions) {
            return { ...poll, questions: store.questions.filter((q: any) => q.pollId === poll.id) };
          }
          return poll;
        }),
        findMany: vi.fn(async ({ where, orderBy }: any) => {
          let results = store.polls.filter((p: any) => {
            let match = true;
            if (where.userId) match = match && p.userId === where.userId;
            if (where.isDeleted !== undefined) match = match && p.isDeleted === where.isDeleted;
            return match;
          });
          if (orderBy?.createdAt === 'desc') {
            results.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
          }
          return results;
        }),
      },
    },
  };
});

// Mock the audit logger
vi.mock('@/lib/services/auditLogger', () => ({
  auditLogger: {
    log: vi.fn(async () => {}),
  },
  createAuditLogger: vi.fn(() => ({
    log: vi.fn(async () => {}),
  })),
}));

// Import after mocks are set up
import { createPollService } from '@/lib/services/pollService';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a valid poll title (1–200 characters) */
const titleArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

/** Generates a valid optional description (0–1000 characters) */
const descriptionArb = fc.option(fc.string({ minLength: 0, maxLength: 1000 }), { nil: undefined });

/** Generates a valid userId (UUID) */
const userIdArb = fc.uuid();

/** Generates a valid teamId (UUID) */
const teamIdArb = fc.uuid();

/** Generates a question-like object */
const questionArb = fc.record({
  text: fc.string({ minLength: 1, maxLength: 500 }),
  options: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 10 }),
  allowCustom: fc.boolean(),
  position: fc.option(
    fc.record({
      x: fc.double({ min: 0, max: 100, noNaN: true }),
      y: fc.double({ min: 0, max: 100, noNaN: true }),
      width: fc.double({ min: 0, max: 100, noNaN: true }),
      height: fc.double({ min: 0, max: 100, noNaN: true }),
    }),
    { nil: null }
  ),
  displayOrder: fc.nat({ max: 100 }),
});

/** Generates a response-like object */
const responseArb = (pollId: string, questionId: string) =>
  fc.record({
    id: fc.uuid(),
    pollId: fc.constant(pollId),
    questionId: fc.constant(questionId),
    participantName: fc.string({ minLength: 2, maxLength: 50 }),
    sessionToken: fc.uuid(),
    selectedOption: fc.string({ minLength: 1, maxLength: 100 }),
    customText: fc.option(fc.string({ minLength: 1, maxLength: 2000 }), { nil: null }),
    isTest: fc.boolean(),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
    updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  });

// ─── Property 1: Poll creation round-trip ────────────────────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 1: Poll creation round-trip
 *
 * For any valid poll title (1–200 characters) and optional description (0–1000 characters),
 * creating a poll and then listing all polls SHALL return a list containing a poll with
 * that exact title and description.
 *
 * **Validates: Requirements 1.1**
 */
describe('Property 1: Poll creation round-trip', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('creating a poll and listing polls returns the created poll with exact title and description', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        descriptionArb,
        userIdArb,
        teamIdArb,
        async (title, description, userId, teamId) => {
          store = createMockStore();

          const service = createPollService();
          const created = await service.createPoll(
            { title, description, teamId },
            userId
          );

          // Verify the created poll has the correct title and description
          expect(created.title).toBe(title);
          expect(created.description).toBe(description ?? null);

          // Verify listing polls returns the created poll
          const polls = await service.listPolls(userId);
          const found = polls.find((p) => p.id === created.id);
          expect(found).toBeDefined();
          expect(found!.title).toBe(title);
          expect(found!.description).toBe(description ?? null);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('created poll appears in the list with matching title regardless of description', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        userIdArb,
        teamIdArb,
        async (title, userId, teamId) => {
          store = createMockStore();

          const service = createPollService();
          await service.createPoll({ title, teamId }, userId);

          const polls = await service.listPolls(userId);
          const matchingPolls = polls.filter((p) => p.title === title);
          expect(matchingPolls.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 3: Poll reset removes all responses ────────────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 3: Poll reset removes all responses
 *
 * For any poll with N responses (where N ≥ 0), resetting the poll SHALL result in
 * zero responses remaining for that poll.
 *
 * **Validates: Requirements 1.6**
 */
describe('Property 3: Poll reset removes all responses', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('resetting a poll removes all responses for that poll', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        teamIdArb,
        userIdArb,
        fc.nat({ max: 50 }),
        async (title, teamId, userId, responseCount) => {
          store = createMockStore();

          const service = createPollService();
          const poll = await service.createPoll({ title, teamId }, userId);

          // Add a question to the poll
          const questionId = crypto.randomUUID();
          store.questions.push({
            id: questionId,
            pollId: poll.id,
            text: 'Test question',
            options: ['A', 'B'],
            allowCustom: false,
            position: null,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Seed N responses for this poll
          for (let i = 0; i < responseCount; i++) {
            store.responses.push({
              id: crypto.randomUUID(),
              pollId: poll.id,
              questionId,
              participantName: `Participant ${i}`,
              sessionToken: crypto.randomUUID(),
              selectedOption: 'A',
              customText: null,
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Verify responses exist before reset
          expect(store.responses.filter((r) => r.pollId === poll.id).length).toBe(responseCount);

          // Reset responses
          const result = await service.resetResponses(poll.id, userId);
          expect(result).toBe(true);

          // Verify zero responses remain for this poll
          const remaining = store.responses.filter((r) => r.pollId === poll.id);
          expect(remaining.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('resetting a poll does not affect responses for other polls', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        titleArb,
        teamIdArb,
        userIdArb,
        fc.nat({ max: 20 }),
        fc.nat({ max: 20 }),
        async (title1, title2, teamId, userId, count1, count2) => {
          store = createMockStore();

          const service = createPollService();
          const poll1 = await service.createPoll({ title: title1, teamId }, userId);
          const poll2 = await service.createPoll({ title: title2, teamId }, userId);

          const q1Id = crypto.randomUUID();
          const q2Id = crypto.randomUUID();

          // Add responses to both polls
          for (let i = 0; i < count1; i++) {
            store.responses.push({
              id: crypto.randomUUID(),
              pollId: poll1.id,
              questionId: q1Id,
              participantName: `P${i}`,
              sessionToken: crypto.randomUUID(),
              selectedOption: 'A',
              customText: null,
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          for (let i = 0; i < count2; i++) {
            store.responses.push({
              id: crypto.randomUUID(),
              pollId: poll2.id,
              questionId: q2Id,
              participantName: `P${i}`,
              sessionToken: crypto.randomUUID(),
              selectedOption: 'B',
              customText: null,
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Reset poll1 only
          await service.resetResponses(poll1.id, userId);

          // Poll1 should have zero responses
          expect(store.responses.filter((r) => r.pollId === poll1.id).length).toBe(0);
          // Poll2 should still have its responses
          expect(store.responses.filter((r) => r.pollId === poll2.id).length).toBe(count2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 4: Clone produces identical questions with zero responses and preserves original ─

/**
 * Feature: shoprite-x-polling-app, Property 4: Clone produces identical questions with zero responses and preserves original
 *
 * For any poll with questions and responses, cloning SHALL produce a new poll where:
 * (a) the title equals the original title suffixed with " (Copy)",
 * (b) all questions are identical to the original,
 * (c) the new poll has zero responses, and
 * (d) the original poll's questions and responses remain unchanged.
 *
 * **Validates: Requirements 1.7, 1.8**
 */
describe('Property 4: Clone produces identical questions with zero responses and preserves original', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('cloned poll has title suffixed with " (Copy)"', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        teamIdArb,
        userIdArb,
        async (title, teamId, userId) => {
          store = createMockStore();

          const service = createPollService();
          const original = await service.createPoll({ title, teamId }, userId);

          const cloned = await service.clonePoll(original.id, userId);
          expect(cloned).not.toBeNull();
          expect(cloned!.title).toBe(`${title} (Copy)`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cloned poll has identical questions to the original', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        teamIdArb,
        userIdArb,
        fc.array(questionArb, { minLength: 1, maxLength: 10 }),
        async (title, teamId, userId, questions) => {
          store = createMockStore();

          const service = createPollService();
          const original = await service.createPoll({ title, teamId }, userId);

          // Add questions to the original poll
          for (const q of questions) {
            store.questions.push({
              id: crypto.randomUUID(),
              pollId: original.id,
              text: q.text,
              options: q.options,
              allowCustom: q.allowCustom,
              position: q.position,
              displayOrder: q.displayOrder,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          const cloned = await service.clonePoll(original.id, userId);
          expect(cloned).not.toBeNull();

          // Get questions for the cloned poll
          const clonedQuestions = store.questions.filter((q) => q.pollId === cloned!.id);
          const originalQuestions = store.questions.filter((q) => q.pollId === original.id);

          // Same number of questions
          expect(clonedQuestions.length).toBe(originalQuestions.length);

          // Each cloned question matches the original in content
          for (let i = 0; i < originalQuestions.length; i++) {
            const origQ = originalQuestions[i];
            const cloneQ = clonedQuestions.find((q) => q.displayOrder === origQ.displayOrder && q.text === origQ.text);
            expect(cloneQ).toBeDefined();
            expect(cloneQ!.text).toBe(origQ.text);
            expect(cloneQ!.options).toEqual(origQ.options);
            expect(cloneQ!.allowCustom).toBe(origQ.allowCustom);
            expect(cloneQ!.displayOrder).toBe(origQ.displayOrder);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cloned poll has zero responses', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        teamIdArb,
        userIdArb,
        fc.nat({ max: 20 }),
        async (title, teamId, userId, responseCount) => {
          store = createMockStore();

          const service = createPollService();
          const original = await service.createPoll({ title, teamId }, userId);

          const questionId = crypto.randomUUID();
          store.questions.push({
            id: questionId,
            pollId: original.id,
            text: 'Q1',
            options: ['A', 'B'],
            allowCustom: false,
            position: null,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Add responses to original
          for (let i = 0; i < responseCount; i++) {
            store.responses.push({
              id: crypto.randomUUID(),
              pollId: original.id,
              questionId,
              participantName: `P${i}`,
              sessionToken: crypto.randomUUID(),
              selectedOption: 'A',
              customText: null,
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          const cloned = await service.clonePoll(original.id, userId);
          expect(cloned).not.toBeNull();

          // Cloned poll should have zero responses
          const clonedResponses = store.responses.filter((r) => r.pollId === cloned!.id);
          expect(clonedResponses.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('original poll questions and responses remain unchanged after cloning', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        teamIdArb,
        userIdArb,
        fc.array(questionArb, { minLength: 1, maxLength: 5 }),
        fc.nat({ max: 10 }),
        async (title, teamId, userId, questions, responseCount) => {
          store = createMockStore();

          const service = createPollService();
          const original = await service.createPoll({ title, teamId }, userId);

          // Add questions
          const questionIds: string[] = [];
          for (const q of questions) {
            const qId = crypto.randomUUID();
            questionIds.push(qId);
            store.questions.push({
              id: qId,
              pollId: original.id,
              text: q.text,
              options: q.options,
              allowCustom: q.allowCustom,
              position: q.position,
              displayOrder: q.displayOrder,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Add responses
          for (let i = 0; i < responseCount; i++) {
            store.responses.push({
              id: crypto.randomUUID(),
              pollId: original.id,
              questionId: questionIds[0],
              participantName: `P${i}`,
              sessionToken: crypto.randomUUID(),
              selectedOption: 'A',
              customText: null,
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Snapshot original state
          const originalQuestionsBefore = store.questions
            .filter((q) => q.pollId === original.id)
            .map((q) => ({ ...q }));
          const originalResponsesBefore = store.responses
            .filter((r) => r.pollId === original.id)
            .map((r) => ({ ...r }));

          // Clone
          await service.clonePoll(original.id, userId);

          // Verify original questions unchanged
          const originalQuestionsAfter = store.questions.filter((q) => q.pollId === original.id);
          expect(originalQuestionsAfter.length).toBe(originalQuestionsBefore.length);
          for (const qBefore of originalQuestionsBefore) {
            const qAfter = originalQuestionsAfter.find((q) => q.id === qBefore.id);
            expect(qAfter).toBeDefined();
            expect(qAfter!.text).toBe(qBefore.text);
            expect(qAfter!.options).toEqual(qBefore.options);
          }

          // Verify original responses unchanged
          const originalResponsesAfter = store.responses.filter((r) => r.pollId === original.id);
          expect(originalResponsesAfter.length).toBe(originalResponsesBefore.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 5: Soft-deleted polls are hidden from views but retained in database ─

/**
 * Feature: shoprite-x-polling-app, Property 5: Soft-deleted polls are hidden from views but retained in database
 *
 * For any poll that is soft-deleted, it SHALL not appear in the admin poll list or public views,
 * but SHALL still exist in the database with isDeleted = true.
 *
 * **Validates: Requirements 1.9, 1.10**
 */
describe('Property 5: Soft-deleted polls are hidden from views but retained in database', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('soft-deleted poll does not appear in listPolls', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        teamIdArb,
        userIdArb,
        async (title, teamId, userId) => {
          store = createMockStore();

          const service = createPollService();
          const poll = await service.createPoll({ title, teamId }, userId);

          // Verify it appears before deletion
          let polls = await service.listPolls(userId);
          expect(polls.find((p) => p.id === poll.id)).toBeDefined();

          // Soft-delete
          const deleted = await service.deletePoll(poll.id, userId);
          expect(deleted).toBe(true);

          // Verify it no longer appears in list
          polls = await service.listPolls(userId);
          expect(polls.find((p) => p.id === poll.id)).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('soft-deleted poll still exists in database with isDeleted = true', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        teamIdArb,
        userIdArb,
        async (title, teamId, userId) => {
          store = createMockStore();

          const service = createPollService();
          const poll = await service.createPoll({ title, teamId }, userId);

          // Soft-delete
          await service.deletePoll(poll.id, userId);

          // Verify the poll still exists in the store with isDeleted = true
          const dbPoll = store.polls.find((p) => p.id === poll.id);
          expect(dbPoll).toBeDefined();
          expect(dbPoll!.isDeleted).toBe(true);
          expect(dbPoll!.title).toBe(title);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('soft-deleted poll is not returned by getPoll', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        teamIdArb,
        userIdArb,
        async (title, teamId, userId) => {
          store = createMockStore();

          const service = createPollService();
          const poll = await service.createPoll({ title, teamId }, userId);

          // Soft-delete
          await service.deletePoll(poll.id, userId);

          // getPoll should return null for soft-deleted polls
          const retrieved = await service.getPoll(poll.id, userId);
          expect(retrieved).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple polls: only non-deleted polls appear in list', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(titleArb, { minLength: 2, maxLength: 10 }),
        teamIdArb,
        userIdArb,
        fc.array(fc.boolean(), { minLength: 2, maxLength: 10 }),
        async (titles, teamId, userId, deleteFlags) => {
          store = createMockStore();
          // Ensure arrays are same length
          const count = Math.min(titles.length, deleteFlags.length);

          const service = createPollService();
          const createdPolls: any[] = [];

          for (let i = 0; i < count; i++) {
            const poll = await service.createPoll({ title: titles[i], teamId }, userId);
            createdPolls.push(poll);
          }

          // Delete some polls
          const deletedIds = new Set<string>();
          for (let i = 0; i < count; i++) {
            if (deleteFlags[i]) {
              await service.deletePoll(createdPolls[i].id, userId);
              deletedIds.add(createdPolls[i].id);
            }
          }

          // List should only contain non-deleted polls
          const polls = await service.listPolls(userId);
          for (const poll of polls) {
            expect(deletedIds.has(poll.id)).toBe(false);
          }

          // All non-deleted polls should be in the list
          const expectedCount = count - deletedIds.size;
          expect(polls.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 12: Facilitator state defaults ─────────────────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 12: Facilitator state defaults
 *
 * For any newly created poll, the facilitator state SHALL have votingOpen = false,
 * liveResults = false, anonymise = true, and revealStage = "HIDDEN".
 *
 * **Validates: Requirements 5.1**
 */
describe('Property 12: Facilitator state defaults', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('newly created poll has correct default facilitator state', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        descriptionArb,
        teamIdArb,
        userIdArb,
        async (title, description, teamId, userId) => {
          store = createMockStore();

          const service = createPollService();
          const poll = await service.createPoll({ title, description, teamId }, userId);

          const state = poll.facilitatorState as Record<string, unknown>;
          expect(state.votingOpen).toBe(false);
          expect(state.liveResults).toBe(false);
          expect(state.anonymise).toBe(true);
          expect(state.revealStage).toBe('HIDDEN');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('facilitator state includes version key _v = 1', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        teamIdArb,
        userIdArb,
        async (title, teamId, userId) => {
          store = createMockStore();

          const service = createPollService();
          const poll = await service.createPoll({ title, teamId }, userId);

          const state = poll.facilitatorState as Record<string, unknown>;
          expect(state._v).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('default facilitator state is consistent regardless of poll title or description', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        descriptionArb,
        titleArb,
        descriptionArb,
        teamIdArb,
        userIdArb,
        async (title1, desc1, title2, desc2, teamId, userId) => {
          store = createMockStore();

          const service = createPollService();
          const poll1 = await service.createPoll({ title: title1, description: desc1, teamId }, userId);
          const poll2 = await service.createPoll({ title: title2, description: desc2, teamId }, userId);

          const state1 = poll1.facilitatorState as Record<string, unknown>;
          const state2 = poll2.facilitatorState as Record<string, unknown>;

          // Both polls should have identical default facilitator state
          expect(state1.votingOpen).toBe(state2.votingOpen);
          expect(state1.liveResults).toBe(state2.liveResults);
          expect(state1.anonymise).toBe(state2.anonymise);
          expect(state1.revealStage).toBe(state2.revealStage);
          expect(state1._v).toBe(state2._v);
        }
      ),
      { numRuns: 100 }
    );
  });
});
