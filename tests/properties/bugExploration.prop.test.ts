import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Bug Condition Exploration Tests - E2E Test Bugfixes
 *
 * Property 1: Bug Condition - E2E Test Bugfixes (Bugs 1, 2, 4, 5, 6)
 *
 * These tests encode the EXPECTED (correct) behavior for each bug.
 * They are written BEFORE implementing fixes and are EXPECTED TO FAIL
 * on unfixed code — failure confirms the bugs exist.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10**
 */

// ─── Mock Store for Service Tests (Bugs 4, 5, 6) ────────────────────────────

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

// Mock the prisma module
vi.mock('@/lib/db/client', () => {
  return {
    prisma: {
      $transaction: vi.fn(async (fn: any) => {
        const tx = {
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
              const entry = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
              store.auditLogs.push(entry);
              return entry;
            }),
          },
        };
        return fn(tx);
      }),
      question: {
        findMany: vi.fn(async ({ where, orderBy }: any) => {
          return store.questions
            .filter((q) => q.pollId === where.pollId)
            .sort((a: any, b: any) => a.displayOrder - b.displayOrder);
        }),
      },
      response: {
        findMany: vi.fn(async ({ where }: any) => {
          return store.responses.filter((r) => {
            let match = true;
            if (where.pollId) match = match && r.pollId === where.pollId;
            if (where.isTest !== undefined) match = match && r.isTest === where.isTest;
            return match;
          });
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          return store.responses.find((r) => {
            let match = true;
            if (where.pollId) match = match && r.pollId === where.pollId;
            if (where.sessionToken) match = match && r.sessionToken === where.sessionToken;
            return match;
          }) ?? null;
        }),
        deleteMany: vi.fn(async ({ where }: any) => {
          const before = store.responses.length;
          store.responses = store.responses.filter((r) => {
            if (where.pollId && r.pollId !== where.pollId) return true;
            if (where.isTest !== undefined && r.isTest !== where.isTest) return true;
            return false;
          });
          return { count: before - store.responses.length };
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

// Mock the sanitise utility
vi.mock('@/lib/utils', () => ({
  sanitise: vi.fn((text: string) => text),
}));

// Import after mocks
import { createResponseService } from '@/lib/services/responseService';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const pollIdArb = fc.uuid();
const questionIdArb = fc.uuid();
const participantNameArb = fc.string({ minLength: 2, maxLength: 30 }).filter((s) => s.trim().length >= 2);
const sessionTokenArb = fc.uuid();
const optionLabelArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length >= 1);

// ─── Bug 4: Test Responses Tab Shows All Data ────────────────────────────────

/**
 * Bug 4 Exploration: Test Responses Tab Shows Only Test Data
 *
 * Bug Condition: tab == test_responses AND responseFilter.includesRealResponses == true
 *
 * Expected behavior: When requesting test-only results (testOnly=true or equivalent),
 * the system SHALL return ONLY responses where isTest=true.
 *
 * On UNFIXED code: The API uses includeTest=true which returns ALL responses (test + real).
 * There is no testOnly filter, so this test SHOULD FAIL on unfixed code.
 *
 * **Validates: Requirements 1.5, 1.6**
 */
describe('Bug 4 Exploration: Test Responses Tab should show ONLY test data', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('getResults with includeTest=true should return ONLY test responses (not real ones)', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdArb,
        fc.array(participantNameArb, { minLength: 1, maxLength: 5 }),
        fc.array(participantNameArb, { minLength: 1, maxLength: 5 }),
        async (pollId, questionId, realParticipants, testParticipants) => {
          store = createMockStore();

          // Set up poll and question
          store.polls.push({
            id: pollId,
            title: 'Test Poll',
            facilitatorState: { _v: 1, votingOpen: true, liveResults: false, anonymise: false, revealStage: 'COUNTS' },
          });
          store.questions.push({
            id: questionId,
            pollId,
            text: 'Test Question',
            options: ['Option A', 'Option B'],
            allowCustom: false,
            position: null,
            displayOrder: 0,
          });

          // Add real responses (isTest=false)
          for (let i = 0; i < realParticipants.length; i++) {
            store.responses.push({
              id: crypto.randomUUID(),
              pollId,
              questionId,
              participantName: realParticipants[i],
              sessionToken: `real-${i}-${crypto.randomUUID()}`,
              selectedOption: 'Option A',
              customText: null,
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Add test responses (isTest=true)
          for (let i = 0; i < testParticipants.length; i++) {
            store.responses.push({
              id: crypto.randomUUID(),
              pollId,
              questionId,
              participantName: testParticipants[i],
              sessionToken: `test-${i}-${crypto.randomUUID()}`,
              selectedOption: 'Option B',
              customText: null,
              isTest: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          const service = createResponseService();

          // Call with testOnly=true (the fixed API for test tab)
          // On UNFIXED code, there was no testOnly option - includeTest=true returned ALL responses
          // Expected behavior: should return ONLY test responses
          const results = await service.getResults(pollId, {
            includeTest: false,
            testOnly: true,
            revealStage: 'COUNTS',
            anonymise: false,
          });

          // The total submission count should equal ONLY the test responses
          // Bug: On unfixed code, submissionCount includes real responses too
          expect(results.submissionCount).toBe(testParticipants.length);

          // The question results should reflect only test response counts
          if (results.questions.length > 0) {
            const q = results.questions[0];
            expect(q.totalResponses).toBe(testParticipants.length);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─── Bug 5: Names Visible Only Shows Names for Custom Responses ──────────────

/**
 * Bug 5 Exploration: Names Visible Shows All Participant Names
 *
 * Bug Condition: revealStage == DETAILS AND anonymise == false AND responseType == predefined_option
 *               AND NOT participantNameShownForOption()
 *
 * Expected behavior: When revealStage='DETAILS' and anonymise=false, OptionResult
 * SHALL include a participants array showing which participants selected each option.
 *
 * On UNFIXED code: OptionResult only has label, count, percentage — no participants field.
 *
 * **Validates: Requirements 1.7, 1.8**
 */
describe('Bug 5 Exploration: Names Visible should show participants for predefined options', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('getResults with DETAILS + non-anonymised should include participant names per option', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdArb,
        fc.array(participantNameArb, { minLength: 2, maxLength: 5 }),
        async (pollId, questionId, participants) => {
          store = createMockStore();

          const options = ['Agree', 'Disagree', 'Neutral'];

          // Set up poll and question
          store.polls.push({
            id: pollId,
            title: 'Test Poll',
            facilitatorState: { _v: 1, votingOpen: true, liveResults: false, anonymise: false, revealStage: 'DETAILS' },
          });
          store.questions.push({
            id: questionId,
            pollId,
            text: 'Do you agree?',
            options,
            allowCustom: true,
            position: null,
            displayOrder: 0,
          });

          // Add responses - participants select predefined options
          for (let i = 0; i < participants.length; i++) {
            const selectedOption = options[i % options.length];
            store.responses.push({
              id: crypto.randomUUID(),
              pollId,
              questionId,
              participantName: participants[i],
              sessionToken: `session-${i}-${crypto.randomUUID()}`,
              selectedOption,
              customText: null,
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          const service = createResponseService();

          const results = await service.getResults(pollId, {
            includeTest: false,
            revealStage: 'DETAILS',
            anonymise: false,
          });

          // Expected: Each option with votes should have a participants array
          // Bug: On unfixed code, OptionResult has no participants field
          expect(results.questions.length).toBeGreaterThan(0);
          const q = results.questions[0];

          // At least one option should have participants listed
          const optionsWithVotes = q.options.filter((o) => o.count > 0);
          expect(optionsWithVotes.length).toBeGreaterThan(0);

          for (const opt of optionsWithVotes) {
            // The option should have a participants array with names
            expect((opt as any).participants).toBeDefined();
            expect(Array.isArray((opt as any).participants)).toBe(true);
            expect((opt as any).participants.length).toBe(opt.count);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─── Bug 6: Percentage Shows 1% for Zero-Vote Options ───────────────────────

/**
 * Bug 6 Exploration: Zero-Vote Options Show 0%
 *
 * Bug Condition: hasCustomResponses == true AND optionVoteCount == 0 AND displayedPercentage > 0
 *
 * Expected behavior: When a predefined option has zero votes, it SHALL display exactly 0%
 * regardless of whether custom responses exist.
 *
 * On UNFIXED code: The largest-remainder method distributes extra points to zero-vote options,
 * causing them to show 1% instead of 0%.
 *
 * **Validates: Requirements 1.9, 1.10**
 */
describe('Bug 6 Exploration: Zero-vote options should always show 0%', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('options with 0 votes show exactly 0% even when custom responses exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdArb,
        // Number of participants who select a predefined option
        fc.integer({ min: 1, max: 10 }),
        // Number of participants who submit custom text
        fc.integer({ min: 1, max: 10 }),
        async (pollId, questionId, predefinedVoters, customVoters) => {
          store = createMockStore();

          // Options: Option A gets votes, Option B gets 0 votes
          const options = ['Option A', 'Option B'];

          store.polls.push({
            id: pollId,
            title: 'Test Poll',
            facilitatorState: { _v: 1, votingOpen: true, liveResults: false, anonymise: false, revealStage: 'COUNTS' },
          });
          store.questions.push({
            id: questionId,
            pollId,
            text: 'Pick one',
            options,
            allowCustom: true,
            position: null,
            displayOrder: 0,
          });

          // Add responses for Option A
          for (let i = 0; i < predefinedVoters; i++) {
            store.responses.push({
              id: crypto.randomUUID(),
              pollId,
              questionId,
              participantName: `Voter ${i}`,
              sessionToken: `voter-${i}-${crypto.randomUUID()}`,
              selectedOption: 'Option A',
              customText: null,
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Add custom text responses (these inflate totalResponses but don't vote for any option)
          for (let i = 0; i < customVoters; i++) {
            store.responses.push({
              id: crypto.randomUUID(),
              pollId,
              questionId,
              participantName: `Custom ${i}`,
              sessionToken: `custom-${i}-${crypto.randomUUID()}`,
              selectedOption: '', // No predefined option selected
              customText: `My custom response ${i}`,
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          const service = createResponseService();

          const results = await service.getResults(pollId, {
            includeTest: false,
            revealStage: 'COUNTS',
            anonymise: false,
          });

          expect(results.questions.length).toBe(1);
          const q = results.questions[0];

          // Find Option B which has 0 votes
          const optionB = q.options.find((o) => o.label === 'Option B');
          expect(optionB).toBeDefined();
          expect(optionB!.count).toBe(0);

          // Bug: On unfixed code, optionB.percentage may be 1 due to remainder distribution
          // Expected: Zero-vote options MUST show exactly 0%
          expect(optionB!.percentage).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});
