import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: shoprite-x-polling-app
 * Property 10: Incomplete submissions are rejected
 * Property 11: Duplicate submission prevention (idempotence)
 *
 * Validates: Requirements 4.5, 4.8, 4.10
 */

// ─── Mock Prisma Client ──────────────────────────────────────────────────────

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
      findUniqueOrThrow: vi.fn(async ({ where, include }: any) => {
        const poll = store.polls.find((p) => p.id === where.id);
        if (!poll) throw new Error('Poll not found');
        if (include?.questions) {
          return { ...poll, questions: store.questions.filter((q) => q.pollId === poll.id) };
        }
        return poll;
      }),
    },
    response: {
      findFirst: vi.fn(async ({ where }: any) => {
        return store.responses.find((r) => {
          let match = true;
          if (where.pollId) match = match && r.pollId === where.pollId;
          if (where.sessionToken) match = match && r.sessionToken === where.sessionToken;
          return match;
        }) ?? null;
      }),
      createMany: vi.fn(async ({ data }: any) => {
        for (const item of data) {
          store.responses.push({
            id: crypto.randomUUID(),
            ...item,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        return { count: data.length };
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
      response: {
        findFirst: vi.fn(async ({ where }: any) => {
          return store.responses.find((r) => {
            let match = true;
            if (where.pollId) match = match && r.pollId === where.pollId;
            if (where.sessionToken) match = match && r.sessionToken === where.sessionToken;
            return match;
          }) ?? null;
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

// Mock the sanitise utility (pass-through for these tests)
vi.mock('@/lib/utils', () => ({
  sanitise: vi.fn((text: string) => text),
}));

// Import after mocks are set up
import { createResponseService } from '@/lib/services/responseService';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a valid participant name (2–50 characters) */
const participantNameArb = fc.string({ minLength: 2, maxLength: 50 }).filter((s) => s.trim().length >= 2);

/** Generates a valid session token (UUID) */
const sessionTokenArb = fc.uuid();

/** Generates a valid poll ID (UUID) */
const pollIdArb = fc.uuid();

/** Generates a valid question ID (UUID) */
const questionIdArb = fc.uuid();

/** Generates a valid selected option (non-empty string) */
const selectedOptionArb = fc.string({ minLength: 1, maxLength: 100 });

/** Generates a set of question IDs (1–10 questions) */
const questionIdsArb = fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }).filter(
  (ids) => new Set(ids).size === ids.length // ensure unique IDs
);

// ─── Property 10: Incomplete submissions are rejected ────────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 10: Incomplete submissions are rejected
 *
 * For any submission where at least one question is unanswered, the validator SHALL
 * reject the submission and no responses SHALL be persisted.
 *
 * **Validates: Requirements 4.5, 4.10**
 */
describe('Property 10: Incomplete submissions are rejected', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('submission missing at least one question answer is rejected with no responses persisted', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdsArb,
        participantNameArb,
        sessionTokenArb,
        fc.nat({ max: 9 }),
        async (pollId, questionIds, participantName, sessionToken, skipIndex) => {
          store = createMockStore();

          // Set up a poll with voting open
          store.polls.push({
            id: pollId,
            title: 'Test Poll',
            description: null,
            backgroundImageUrl: null,
            facilitatorState: { _v: 1, votingOpen: true, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Add questions to the poll
          for (let i = 0; i < questionIds.length; i++) {
            store.questions.push({
              id: questionIds[i],
              pollId,
              text: `Question ${i + 1}`,
              options: ['Option A', 'Option B'],
              allowCustom: false,
              position: null,
              displayOrder: i,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Create an incomplete submission: skip at least one question
          const indexToSkip = skipIndex % questionIds.length;
          const answers = questionIds
            .filter((_, i) => i !== indexToSkip)
            .map((qId) => ({
              questionId: qId,
              selectedOption: 'Option A',
            }));

          const service = createResponseService();

          // Attempt to submit incomplete responses
          let errorThrown = false;
          let errorCode = '';
          try {
            await service.submitResponses(pollId, {
              participantName,
              sessionToken,
              answers,
              isTest: false,
            });
          } catch (err: any) {
            errorThrown = true;
            errorCode = err.code;
          }

          // Submission should be rejected
          expect(errorThrown).toBe(true);
          expect(errorCode).toBe('VALIDATION_ERROR');

          // No responses should be persisted
          const persistedResponses = store.responses.filter((r) => r.pollId === pollId);
          expect(persistedResponses.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('submission with extra answers for non-existent questions is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdsArb,
        participantNameArb,
        sessionTokenArb,
        fc.uuid(),
        async (pollId, questionIds, participantName, sessionToken, extraQuestionId) => {
          // Ensure the extra question ID is not in the poll's questions
          fc.pre(!questionIds.includes(extraQuestionId));

          store = createMockStore();

          // Set up a poll with voting open
          store.polls.push({
            id: pollId,
            title: 'Test Poll',
            description: null,
            backgroundImageUrl: null,
            facilitatorState: { _v: 1, votingOpen: true, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Add questions to the poll
          for (let i = 0; i < questionIds.length; i++) {
            store.questions.push({
              id: questionIds[i],
              pollId,
              text: `Question ${i + 1}`,
              options: ['Option A', 'Option B'],
              allowCustom: false,
              position: null,
              displayOrder: i,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Create a submission that answers all poll questions PLUS an extra non-existent one
          const answers = [
            ...questionIds.map((qId) => ({
              questionId: qId,
              selectedOption: 'Option A',
            })),
            {
              questionId: extraQuestionId,
              selectedOption: 'Option B',
            },
          ];

          const service = createResponseService();

          // Attempt to submit
          let errorThrown = false;
          let errorCode = '';
          try {
            await service.submitResponses(pollId, {
              participantName,
              sessionToken,
              answers,
              isTest: false,
            });
          } catch (err: any) {
            errorThrown = true;
            errorCode = err.code;
          }

          // Submission should be rejected (answer count doesn't match question count)
          expect(errorThrown).toBe(true);
          expect(errorCode).toBe('VALIDATION_ERROR');

          // No responses should be persisted
          const persistedResponses = store.responses.filter((r) => r.pollId === pollId);
          expect(persistedResponses.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('complete submission with all questions answered is accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdsArb,
        participantNameArb,
        sessionTokenArb,
        async (pollId, questionIds, participantName, sessionToken) => {
          store = createMockStore();

          // Set up a poll with voting open
          store.polls.push({
            id: pollId,
            title: 'Test Poll',
            description: null,
            backgroundImageUrl: null,
            facilitatorState: { _v: 1, votingOpen: true, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Add questions to the poll
          for (let i = 0; i < questionIds.length; i++) {
            store.questions.push({
              id: questionIds[i],
              pollId,
              text: `Question ${i + 1}`,
              options: ['Option A', 'Option B'],
              allowCustom: false,
              position: null,
              displayOrder: i,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Create a complete submission answering all questions
          const answers = questionIds.map((qId) => ({
            questionId: qId,
            selectedOption: 'Option A',
          }));

          const service = createResponseService();

          // Submit should succeed
          await service.submitResponses(pollId, {
            participantName,
            sessionToken,
            answers,
            isTest: false,
          });

          // Responses should be persisted (one per question)
          const persistedResponses = store.responses.filter((r) => r.pollId === pollId);
          expect(persistedResponses.length).toBe(questionIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 11: Duplicate submission prevention (idempotence) ──────────────

/**
 * Feature: shoprite-x-polling-app, Property 11: Duplicate submission prevention (idempotence)
 *
 * For any valid submission, submitting the same poll with the same session token a second
 * time SHALL be rejected, and the response count SHALL not increase.
 *
 * **Validates: Requirements 4.8**
 */
describe('Property 11: Duplicate submission prevention (idempotence)', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('second submission with same session token is rejected and response count does not increase', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdsArb,
        participantNameArb,
        sessionTokenArb,
        async (pollId, questionIds, participantName, sessionToken) => {
          store = createMockStore();

          // Set up a poll with voting open
          store.polls.push({
            id: pollId,
            title: 'Test Poll',
            description: null,
            backgroundImageUrl: null,
            facilitatorState: { _v: 1, votingOpen: true, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Add questions to the poll
          for (let i = 0; i < questionIds.length; i++) {
            store.questions.push({
              id: questionIds[i],
              pollId,
              text: `Question ${i + 1}`,
              options: ['Option A', 'Option B'],
              allowCustom: false,
              position: null,
              displayOrder: i,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Create a valid submission
          const answers = questionIds.map((qId) => ({
            questionId: qId,
            selectedOption: 'Option A',
          }));

          const service = createResponseService();

          // First submission should succeed
          await service.submitResponses(pollId, {
            participantName,
            sessionToken,
            answers,
            isTest: false,
          });

          // Record response count after first submission
          const countAfterFirst = store.responses.filter((r) => r.pollId === pollId).length;
          expect(countAfterFirst).toBe(questionIds.length);

          // Second submission with same session token should be rejected
          let errorThrown = false;
          let errorCode = '';
          try {
            await service.submitResponses(pollId, {
              participantName,
              sessionToken,
              answers,
              isTest: false,
            });
          } catch (err: any) {
            errorThrown = true;
            errorCode = err.code;
          }

          expect(errorThrown).toBe(true);
          expect(errorCode).toBe('CONFLICT');

          // Response count should not have increased
          const countAfterSecond = store.responses.filter((r) => r.pollId === pollId).length;
          expect(countAfterSecond).toBe(countAfterFirst);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('different session tokens for the same poll are both accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdsArb,
        participantNameArb,
        sessionTokenArb,
        sessionTokenArb,
        async (pollId, questionIds, participantName, sessionToken1, sessionToken2) => {
          // Ensure the two session tokens are different
          fc.pre(sessionToken1 !== sessionToken2);

          store = createMockStore();

          // Set up a poll with voting open
          store.polls.push({
            id: pollId,
            title: 'Test Poll',
            description: null,
            backgroundImageUrl: null,
            facilitatorState: { _v: 1, votingOpen: true, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Add questions to the poll
          for (let i = 0; i < questionIds.length; i++) {
            store.questions.push({
              id: questionIds[i],
              pollId,
              text: `Question ${i + 1}`,
              options: ['Option A', 'Option B'],
              allowCustom: false,
              position: null,
              displayOrder: i,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          const answers = questionIds.map((qId) => ({
            questionId: qId,
            selectedOption: 'Option A',
          }));

          const service = createResponseService();

          // First submission with token 1
          await service.submitResponses(pollId, {
            participantName,
            sessionToken: sessionToken1,
            answers,
            isTest: false,
          });

          // Second submission with token 2 should also succeed
          await service.submitResponses(pollId, {
            participantName,
            sessionToken: sessionToken2,
            answers,
            isTest: false,
          });

          // Both sets of responses should be persisted
          const totalResponses = store.responses.filter((r) => r.pollId === pollId).length;
          expect(totalResponses).toBe(questionIds.length * 2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('duplicate submission does not create additional audit log entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdsArb,
        participantNameArb,
        sessionTokenArb,
        async (pollId, questionIds, participantName, sessionToken) => {
          store = createMockStore();

          // Set up a poll with voting open
          store.polls.push({
            id: pollId,
            title: 'Test Poll',
            description: null,
            backgroundImageUrl: null,
            facilitatorState: { _v: 1, votingOpen: true, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Add questions to the poll
          for (let i = 0; i < questionIds.length; i++) {
            store.questions.push({
              id: questionIds[i],
              pollId,
              text: `Question ${i + 1}`,
              options: ['Option A', 'Option B'],
              allowCustom: false,
              position: null,
              displayOrder: i,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          const answers = questionIds.map((qId) => ({
            questionId: qId,
            selectedOption: 'Option A',
          }));

          const service = createResponseService();

          // First submission
          await service.submitResponses(pollId, {
            participantName,
            sessionToken,
            answers,
            isTest: false,
          });

          const auditCountAfterFirst = store.auditLogs.length;

          // Second submission (should fail)
          try {
            await service.submitResponses(pollId, {
              participantName,
              sessionToken,
              answers,
              isTest: false,
            });
          } catch {
            // Expected to throw
          }

          // No additional audit log entries should be created for the rejected submission
          expect(store.auditLogs.length).toBe(auditCountAfterFirst);
        }
      ),
      { numRuns: 100 }
    );
  });
});
