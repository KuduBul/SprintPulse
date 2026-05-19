import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: shoprite-x-polling-app
 * Property 23: Audit log completeness
 *
 * For any auditable action (poll CRUD, question CRUD, response submission,
 * response reset, facilitator state change, voting toggle, reveal stage change, purge),
 * executing the action SHALL produce a corresponding audit log entry with the correct
 * action type, poll ID, and actor.
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12**
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


// Captured audit log calls
let auditLogCalls: any[] = [];

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
      findFirstOrThrow: vi.fn(async ({ where, select }: any) => {
        const poll = store.polls.find((p) => {
          let match = true;
          if (where.id) match = match && p.id === where.id;
          return match;
        });
        if (!poll) throw new Error('Not found');
        if (select?.facilitatorState) {
          return { facilitatorState: poll.facilitatorState };
        }
        return poll;
      }),
      findUniqueOrThrow: vi.fn(async ({ where, include }: any) => {
        const poll = store.polls.find((p) => p.id === where.id);
        if (!poll) throw new Error('Not found');
        if (include?.questions) {
          return { ...poll, questions: store.questions.filter((q) => q.pollId === poll.id) };
        }
        return poll;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return store.polls.filter((p) => {
          let match = true;
          if (where?.isDeleted !== undefined) match = match && p.isDeleted === where.isDeleted;
          if (where?.updatedAt?.lt) match = match && p.updatedAt < where.updatedAt.lt;
          return match;
        });
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = store.polls.length;
        if (where?.id?.in) {
          store.polls = store.polls.filter((p) => !where.id.in.includes(p.id));
        }
        return { count: before - store.polls.length };
      }),
    },
    question: {
      create: vi.fn(async ({ data }: any) => {
        const question = {
          id: crypto.randomUUID(),
          pollId: data.pollId,
          text: data.text,
          options: data.options,
          allowCustom: data.allowCustom ?? false,
          position: data.position ?? null,
          displayOrder: data.displayOrder ?? 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.questions.push(question);
        return question;
      }),
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
      update: vi.fn(async ({ where, data }: any) => {
        const question = store.questions.find((q) => q.id === where.id);
        if (question) {
          Object.assign(question, data, { updatedAt: new Date() });
        }
        return question;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = store.questions.findIndex((q) => q.id === where.id);
        if (idx === -1) throw new Error('Not found');
        const [question] = store.questions.splice(idx, 1);
        return question;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = store.questions.length;
        if (where?.pollId?.in) {
          store.questions = store.questions.filter((q) => !where.pollId.in.includes(q.pollId));
        }
        return { count: before - store.questions.length };
      }),
    },
    response: {
      createMany: vi.fn(async ({ data }: any) => {
        for (const r of data) {
          store.responses.push({
            id: crypto.randomUUID(),
            ...r,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        return { count: data.length };
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return store.responses.find((r) => {
          let match = true;
          if (where.pollId) match = match && r.pollId === where.pollId;
          if (where.sessionToken) match = match && r.sessionToken === where.sessionToken;
          return match;
        }) || null;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = store.responses.length;
        if (where?.pollId) {
          store.responses = store.responses.filter((r) => r.pollId !== where.pollId);
        } else if (where?.createdAt?.lt) {
          store.responses = store.responses.filter((r) => !(r.createdAt < where.createdAt.lt));
        } else if (where?.pollId?.in) {
          store.responses = store.responses.filter((r) => !where.pollId.in.includes(r.pollId));
        }
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
        auditLogCalls.push(entry);
        return entry;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = store.auditLogs.length;
        if (where?.createdAt?.lt) {
          store.auditLogs = store.auditLogs.filter((a) => !(a.createdAt < where.createdAt.lt));
        } else if (where?.pollId?.in) {
          store.auditLogs = store.auditLogs.filter((a) => !where.pollId.in.includes(a.pollId));
        }
        return { count: before - store.auditLogs.length };
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
        findMany: vi.fn(async ({ where }: any) => {
          return store.polls.filter((p: any) => {
            let match = true;
            if (where?.userId) match = match && p.userId === where.userId;
            if (where?.isDeleted !== undefined) match = match && p.isDeleted === where.isDeleted;
            if (where?.updatedAt?.lt) match = match && p.updatedAt < where.updatedAt.lt;
            return match;
          });
        }),
        deleteMany: vi.fn(async ({ where }: any) => {
          const before = store.polls.length;
          if (where?.id?.in) {
            store.polls = store.polls.filter((p: any) => !where.id.in.includes(p.id));
          }
          return { count: before - store.polls.length };
        }),
      },
      question: {
        deleteMany: vi.fn(async ({ where }: any) => {
          const before = store.questions.length;
          if (where?.pollId?.in) {
            store.questions = store.questions.filter((q: any) => !where.pollId.in.includes(q.pollId));
          }
          return { count: before - store.questions.length };
        }),
      },
      response: {
        deleteMany: vi.fn(async ({ where }: any) => {
          const before = store.responses.length;
          if (where?.createdAt?.lt) {
            store.responses = store.responses.filter((r: any) => !(r.createdAt < where.createdAt.lt));
          } else if (where?.pollId?.in) {
            store.responses = store.responses.filter((r: any) => !where.pollId.in.includes(r.pollId));
          }
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
          auditLogCalls.push(entry);
          return entry;
        }),
        deleteMany: vi.fn(async ({ where }: any) => {
          const before = store.auditLogs.length;
          if (where?.createdAt?.lt) {
            store.auditLogs = store.auditLogs.filter((a: any) => !(a.createdAt < where.createdAt.lt));
          } else if (where?.pollId?.in) {
            store.auditLogs = store.auditLogs.filter((a: any) => !where.pollId.in.includes(a.pollId));
          }
          return { count: before - store.auditLogs.length };
        }),
      },
    },
  };
});

// Mock the sanitise utility
vi.mock('@/lib/utils', () => ({
  sanitise: (text: string) => text,
}));

// Mock the config module (needed by retentionService)
vi.mock('@/lib/config', () => ({
  config: {
    RETENTION_RESPONSES_DAYS: 90,
    RETENTION_AUDIT_DAYS: 365,
  },
}));

// Import after mocks are set up
import { createPollService } from '@/lib/services/pollService';
import { createQuestionService } from '@/lib/services/questionService';
import { createResponseService } from '@/lib/services/responseService';
import { createFacilitatorService } from '@/lib/services/facilitatorService';
import { createRetentionService } from '@/lib/services/retentionService';
import { createAuditLogger } from '@/lib/services/auditLogger';


// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a valid poll title (1–200 characters) */
const titleArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

/** Generates a valid optional description (0–1000 characters) */
const descriptionArb = fc.option(fc.string({ minLength: 0, maxLength: 1000 }), { nil: undefined });

/** Generates a valid userId (UUID-like string) */
const userIdArb = fc.uuid();

/** Generates a valid teamId (UUID) */
const teamIdArb = fc.uuid();

/** Generates a valid participant name (2–50 characters) */
const participantNameArb = fc.string({ minLength: 2, maxLength: 50 }).filter((s) => s.trim().length >= 2);

/** Generates a valid question text (1–500 characters) */
const questionTextArb = fc.string({ minLength: 1, maxLength: 500 }).filter((s) => s.trim().length > 0);

/** Generates valid options (2–10 items) */
const optionsArb = fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 10 });

// ─── Helper: seed a poll in the store ────────────────────────────────────────

function seedPoll(userId: string, teamId?: string, overrides?: Partial<any>): any {
  const poll = {
    id: crypto.randomUUID(),
    title: 'Test Poll',
    description: null,
    backgroundImageUrl: null,
    userId,
    teamId: teamId ?? null,
    facilitatorState: {
      _v: 1,
      votingOpen: false,
      liveResults: false,
      anonymise: true,
      revealStage: 'HIDDEN',
    },
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  store.polls.push(poll);
  return poll;
}

function seedQuestion(pollId: string, overrides?: Partial<any>): any {
  const question = {
    id: crypto.randomUUID(),
    pollId,
    text: 'Test Question',
    options: ['Option A', 'Option B'],
    allowCustom: false,
    position: null,
    displayOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  store.questions.push(question);
  return question;
}


// ─── Property 23: Audit log completeness ─────────────────────────────────────

describe('Property 23: Audit log completeness', () => {
  beforeEach(() => {
    store = createMockStore();
    auditLogCalls = [];
    vi.clearAllMocks();
  });

  /**
   * Feature: shoprite-x-polling-app, Property 23: Audit log completeness
   *
   * POLL_CREATED: Creating a poll SHALL produce a POLL_CREATED audit entry
   * with the correct poll ID and actor.
   *
   * **Validates: Requirements 8.1**
   */
  it('POLL_CREATED: creating a poll produces a POLL_CREATED audit entry with correct pollId and actor', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        descriptionArb,
        userIdArb,
        teamIdArb,
        async (title, description, userId, teamId) => {
          store = createMockStore();
          auditLogCalls = [];

          const service = createPollService();
          const poll = await service.createPoll({ title, description, teamId }, userId);

          const entry = auditLogCalls.find((e) => e.action === 'POLL_CREATED');
          expect(entry).toBeDefined();
          expect(entry.pollId).toBe(poll.id);
          expect(entry.actor).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: shoprite-x-polling-app, Property 23: Audit log completeness
   *
   * POLL_UPDATED: Updating a poll SHALL produce a POLL_UPDATED audit entry
   * with the correct poll ID and actor.
   *
   * **Validates: Requirements 8.2**
   */
  it('POLL_UPDATED: updating a poll produces a POLL_UPDATED audit entry with correct pollId and actor', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        userIdArb,
        teamIdArb,
        titleArb,
        async (originalTitle, userId, teamId, newTitle) => {
          store = createMockStore();
          auditLogCalls = [];

          const poll = seedPoll(userId, teamId, { title: originalTitle });

          const service = createPollService();
          await service.updatePoll(poll.id, { title: newTitle }, userId);

          const entry = auditLogCalls.find((e) => e.action === 'POLL_UPDATED');
          expect(entry).toBeDefined();
          expect(entry.pollId).toBe(poll.id);
          expect(entry.actor).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: shoprite-x-polling-app, Property 23: Audit log completeness
   *
   * POLL_DELETED: Soft-deleting a poll SHALL produce a POLL_DELETED audit entry
   * with the correct poll ID and actor.
   *
   * **Validates: Requirements 8.3**
   */
  it('POLL_DELETED: soft-deleting a poll produces a POLL_DELETED audit entry with correct pollId and actor', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        userIdArb,
        teamIdArb,
        async (title, userId, teamId) => {
          store = createMockStore();
          auditLogCalls = [];

          const poll = seedPoll(userId, teamId, { title });

          const service = createPollService();
          await service.deletePoll(poll.id, userId);

          const entry = auditLogCalls.find((e) => e.action === 'POLL_DELETED');
          expect(entry).toBeDefined();
          expect(entry.pollId).toBe(poll.id);
          expect(entry.actor).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: shoprite-x-polling-app, Property 23: Audit log completeness
   *
   * POLL_CLONED: Cloning a poll SHALL produce a POLL_CLONED audit entry
   * with the new poll ID and actor.
   *
   * **Validates: Requirements 8.4**
   */
  it('POLL_CLONED: cloning a poll produces a POLL_CLONED audit entry with correct pollId and actor', async () => {
    await fc.assert(
      fc.asyncProperty(
        titleArb,
        userIdArb,
        teamIdArb,
        async (title, userId, teamId) => {
          store = createMockStore();
          auditLogCalls = [];

          const poll = seedPoll(userId, teamId, { title });

          const service = createPollService();
          const cloned = await service.clonePoll(poll.id, userId);

          const entry = auditLogCalls.find((e) => e.action === 'POLL_CLONED');
          expect(entry).toBeDefined();
          expect(entry.pollId).toBe(cloned!.id);
          expect(entry.actor).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Feature: shoprite-x-polling-app, Property 23: Audit log completeness
   *
   * QUESTION_CREATED: Creating a question SHALL produce a QUESTION_CREATED audit entry
   * with the correct poll ID and actor.
   *
   * **Validates: Requirements 8.5**
   */
  it('QUESTION_CREATED: creating a question produces a QUESTION_CREATED audit entry with correct pollId and actor', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        teamIdArb,
        questionTextArb,
        optionsArb,
        async (userId, teamId, text, options) => {
          store = createMockStore();
          auditLogCalls = [];

          const poll = seedPoll(userId, teamId);

          const service = createQuestionService();
          await service.createQuestion(
            poll.id,
            { text, options, allowCustom: false, position: null, displayOrder: 0 },
            userId
          );

          const entry = auditLogCalls.find((e) => e.action === 'QUESTION_CREATED');
          expect(entry).toBeDefined();
          expect(entry.pollId).toBe(poll.id);
          expect(entry.actor).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: shoprite-x-polling-app, Property 23: Audit log completeness
   *
   * QUESTION_UPDATED: Updating a question SHALL produce a QUESTION_UPDATED audit entry
   * with the correct poll ID and actor.
   *
   * **Validates: Requirements 8.5**
   */
  it('QUESTION_UPDATED: updating a question produces a QUESTION_UPDATED audit entry with correct pollId and actor', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        teamIdArb,
        questionTextArb,
        async (userId, teamId, newText) => {
          store = createMockStore();
          auditLogCalls = [];

          const poll = seedPoll(userId, teamId);
          const question = seedQuestion(poll.id);

          const service = createQuestionService();
          await service.updateQuestion(question.id, { text: newText }, userId);

          const entry = auditLogCalls.find((e) => e.action === 'QUESTION_UPDATED');
          expect(entry).toBeDefined();
          expect(entry.pollId).toBe(poll.id);
          expect(entry.actor).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: shoprite-x-polling-app, Property 23: Audit log completeness
   *
   * QUESTION_DELETED: Deleting a question SHALL produce a QUESTION_DELETED audit entry
   * with the correct poll ID and actor.
   *
   * **Validates: Requirements 8.5**
   */
  it('QUESTION_DELETED: deleting a question produces a QUESTION_DELETED audit entry with correct pollId and actor', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        teamIdArb,
        async (userId, teamId) => {
          store = createMockStore();
          auditLogCalls = [];

          const poll = seedPoll(userId, teamId);
          const question = seedQuestion(poll.id);

          const service = createQuestionService();
          await service.deleteQuestion(question.id, userId);

          const entry = auditLogCalls.find((e) => e.action === 'QUESTION_DELETED');
          expect(entry).toBeDefined();
          expect(entry.pollId).toBe(poll.id);
          expect(entry.actor).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Feature: shoprite-x-polling-app, Property 23: Audit log completeness
   *
   * RESPONSES_SUBMITTED: Submitting responses SHALL produce a RESPONSES_SUBMITTED audit entry
   * with the correct poll ID and actor (participant name).
   *
   * **Validates: Requirements 8.6**
   */
  it('RESPONSES_SUBMITTED: submitting responses produces a RESPONSES_SUBMITTED audit entry with correct pollId and actor', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        teamIdArb,
        participantNameArb,
        async (userId, teamId, participantName) => {
          store = createMockStore();
          auditLogCalls = [];

          const poll = seedPoll(userId, teamId, {
            facilitatorState: {
              _v: 1,
              votingOpen: true,
              liveResults: false,
              anonymise: true,
              revealStage: 'HIDDEN',
            },
          });
          const question = seedQuestion(poll.id);

          const service = createResponseService();
          const sessionToken = crypto.randomUUID();

          await service.submitResponses(poll.id, {
            participantName,
            sessionToken,
            answers: [{ questionId: question.id, selectedOption: 'Option A' }],
            isTest: false,
          });

          const entry = auditLogCalls.find((e) => e.action === 'RESPONSES_SUBMITTED');
          expect(entry).toBeDefined();
          expect(entry.pollId).toBe(poll.id);
          expect(entry.actor).toBe(participantName);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: shoprite-x-polling-app, Property 23: Audit log completeness
   *
   * RESPONSES_RESET: Resetting responses SHALL produce a RESPONSES_RESET audit entry
   * with the correct poll ID and actor.
   *
   * **Validates: Requirements 8.7**
   */
  it('RESPONSES_RESET: resetting responses produces a RESPONSES_RESET audit entry with correct pollId and actor', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        teamIdArb,
        async (userId, teamId) => {
          store = createMockStore();
          auditLogCalls = [];

          const poll = seedPoll(userId, teamId);

          const service = createPollService();
          await service.resetResponses(poll.id, userId);

          const entry = auditLogCalls.find((e) => e.action === 'RESPONSES_RESET');
          expect(entry).toBeDefined();
          expect(entry.pollId).toBe(poll.id);
          expect(entry.actor).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Feature: shoprite-x-polling-app, Property 23: Audit log completeness
   *
   * FACILITATOR_STATE_UPDATED: Changing facilitator state SHALL produce a
   * FACILITATOR_STATE_UPDATED audit entry with the correct poll ID and actor.
   *
   * **Validates: Requirements 8.9**
   */
  it('FACILITATOR_STATE_UPDATED: changing facilitator state produces a FACILITATOR_STATE_UPDATED audit entry with correct pollId and actor', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        teamIdArb,
        fc.boolean(),
        async (userId, teamId, liveResults) => {
          store = createMockStore();
          auditLogCalls = [];

          const poll = seedPoll(userId, teamId);

          const service = createFacilitatorService();
          await service.updateState(poll.id, { liveResults }, userId);

          const entry = auditLogCalls.find((e) => e.action === 'FACILITATOR_STATE_UPDATED');
          expect(entry).toBeDefined();
          expect(entry.pollId).toBe(poll.id);
          expect(entry.actor).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: shoprite-x-polling-app, Property 23: Audit log completeness
   *
   * VOTING_OPENED: Opening voting SHALL produce a VOTING_OPENED audit entry
   * with the correct poll ID and actor.
   *
   * **Validates: Requirements 8.11**
   */
  it('VOTING_OPENED: opening voting produces a VOTING_OPENED audit entry with correct pollId and actor', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        teamIdArb,
        async (userId, teamId) => {
          store = createMockStore();
          auditLogCalls = [];

          // Start with voting closed
          const poll = seedPoll(userId, teamId, {
            facilitatorState: {
              _v: 1,
              votingOpen: false,
              liveResults: false,
              anonymise: true,
              revealStage: 'HIDDEN',
            },
          });

          const service = createFacilitatorService();
          await service.updateState(poll.id, { votingOpen: true }, userId);

          const entry = auditLogCalls.find((e) => e.action === 'VOTING_OPENED');
          expect(entry).toBeDefined();
          expect(entry.pollId).toBe(poll.id);
          expect(entry.actor).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: shoprite-x-polling-app, Property 23: Audit log completeness
   *
   * VOTING_CLOSED: Closing voting SHALL produce a VOTING_CLOSED audit entry
   * with the correct poll ID and actor.
   *
   * **Validates: Requirements 8.11**
   */
  it('VOTING_CLOSED: closing voting produces a VOTING_CLOSED audit entry with correct pollId and actor', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        teamIdArb,
        async (userId, teamId) => {
          store = createMockStore();
          auditLogCalls = [];

          // Start with voting open
          const poll = seedPoll(userId, teamId, {
            facilitatorState: {
              _v: 1,
              votingOpen: true,
              liveResults: false,
              anonymise: true,
              revealStage: 'HIDDEN',
            },
          });

          const service = createFacilitatorService();
          await service.updateState(poll.id, { votingOpen: false }, userId);

          const entry = auditLogCalls.find((e) => e.action === 'VOTING_CLOSED');
          expect(entry).toBeDefined();
          expect(entry.pollId).toBe(poll.id);
          expect(entry.actor).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Feature: shoprite-x-polling-app, Property 23: Audit log completeness
   *
   * REVEAL_STAGE_CHANGED: Changing the reveal stage SHALL produce a REVEAL_STAGE_CHANGED
   * audit entry with the correct poll ID and actor.
   *
   * **Validates: Requirements 8.10**
   */
  it('REVEAL_STAGE_CHANGED: changing reveal stage produces a REVEAL_STAGE_CHANGED audit entry with correct pollId and actor', async () => {
    const revealStages = ['HIDDEN', 'COUNTS', 'DETAILS'] as const;

    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        teamIdArb,
        fc.constantFrom(...revealStages),
        fc.constantFrom(...revealStages),
        async (userId, teamId, fromStage, toStage) => {
          // Only test when stages differ (otherwise no REVEAL_STAGE_CHANGED is logged)
          fc.pre(fromStage !== toStage);

          store = createMockStore();
          auditLogCalls = [];

          const poll = seedPoll(userId, teamId, {
            facilitatorState: {
              _v: 1,
              votingOpen: false,
              liveResults: false,
              anonymise: true,
              revealStage: fromStage,
            },
          });

          const service = createFacilitatorService();
          await service.updateState(poll.id, { revealStage: toStage }, userId);

          const entry = auditLogCalls.find((e) => e.action === 'REVEAL_STAGE_CHANGED');
          expect(entry).toBeDefined();
          expect(entry.pollId).toBe(poll.id);
          expect(entry.actor).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: shoprite-x-polling-app, Property 23: Audit log completeness
   *
   * DATA_PURGED: Running the retention purge SHALL produce a DATA_PURGED audit entry
   * with actor 'system'.
   *
   * **Validates: Requirements 8.12**
   */
  it('DATA_PURGED: running retention purge produces a DATA_PURGED audit entry with actor system', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 10 }),
        async (responseCount) => {
          store = createMockStore();
          auditLogCalls = [];

          // Create a mock audit logger that captures calls
          const mockLogger = {
            log: vi.fn(async (entry: any) => {
              const logEntry = {
                id: crypto.randomUUID(),
                pollId: entry.pollId ?? null,
                action: entry.action,
                actor: entry.actor,
                metadata: entry.metadata ?? null,
                createdAt: new Date(),
              };
              store.auditLogs.push(logEntry);
              auditLogCalls.push(logEntry);
            }),
          };

          // Create a mock db that mimics the prisma client
          const mockDb = {
            response: {
              deleteMany: vi.fn(async () => ({ count: 0 })),
            },
            auditLog: {
              deleteMany: vi.fn(async () => ({ count: 0 })),
            },
            poll: {
              findMany: vi.fn(async () => []),
              deleteMany: vi.fn(async () => ({ count: 0 })),
            },
            question: {
              deleteMany: vi.fn(async () => ({ count: 0 })),
            },
          } as any;

          const service = createRetentionService(mockDb, mockLogger);
          await service.purge();

          const entry = auditLogCalls.find((e) => e.action === 'DATA_PURGED');
          expect(entry).toBeDefined();
          expect(entry.actor).toBe('system');
        }
      ),
      { numRuns: 100 }
    );
  });
});
