import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: shoprite-x-polling-app
 * Property 16: Test responses excluded from public results and participant count
 * Property 17: Clearing test responses preserves real data
 * Property 18: Results aggregation correctness
 * Property 19: Percentage sum invariant
 * Property 20: Free-text verbatim preservation
 * Property 21: Anonymised results contain no real names in output
 * Property 22: Free-text section hidden when no custom entries exist
 *
 * Validates: Requirements 6.2, 6.3, 6.5, 6.7, 7.1–7.8, 5.10
 */

// ─── Mock Store ──────────────────────────────────────────────────────────────

interface MockResponse {
  id: string;
  pollId: string;
  questionId: string;
  participantName: string;
  sessionToken: string;
  selectedOption: string;
  customText: string | null;
  isTest: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MockQuestion {
  id: string;
  pollId: string;
  text: string;
  options: string[];
  allowCustom: boolean;
  position: null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MockStore {
  questions: MockQuestion[];
  responses: MockResponse[];
}

let store: MockStore;

function createMockStore(): MockStore {
  return {
    questions: [],
    responses: [],
  };
}

// ─── Mock Prisma Client ──────────────────────────────────────────────────────

vi.mock('@/lib/db/client', () => {
  return {
    prisma: {
      $transaction: vi.fn(async (fn: any) => {
        return fn({
          poll: { findUniqueOrThrow: vi.fn() },
          response: { findFirst: vi.fn(), createMany: vi.fn() },
          auditLog: { create: vi.fn() },
        });
      }),
      question: {
        findMany: vi.fn(({ where, orderBy }: any) => {
          return store.questions
            .filter((q) => q.pollId === where.pollId)
            .sort((a, b) => a.displayOrder - b.displayOrder);
        }),
      },
      response: {
        findMany: vi.fn(({ where }: any) => {
          return store.responses.filter((r) => {
            let match = r.pollId === where.pollId;
            if (where.isTest !== undefined) {
              match = match && r.isTest === where.isTest;
            }
            return match;
          });
        }),
        deleteMany: vi.fn(({ where }: any) => {
          const before = store.responses.length;
          store.responses = store.responses.filter((r) => {
            if (r.pollId !== where.pollId) return true;
            if (where.isTest !== undefined && r.isTest !== where.isTest) return true;
            return false;
          });
          return { count: before - store.responses.length };
        }),
        findFirst: vi.fn(),
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

const pollIdArb = fc.uuid();
const questionIdArb = fc.uuid();
const sessionTokenArb = fc.uuid();

/** Generates a participant name that is non-empty and distinct */
const participantNameArb = fc
  .string({ minLength: 2, maxLength: 30 })
  .filter((s) => s.trim().length >= 2);

/** Generates a list of predefined options (2–6 items) */
const optionsArb = fc
  .array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 2, maxLength: 6 })
  .filter((opts) => new Set(opts).size === opts.length);

/** Generates a free-text string (non-empty) */
const freeTextArb = fc.string({ minLength: 1, maxLength: 200 });

/**
 * Generates a set of responses for a single question with a mix of test and real.
 */
function responsesForQuestionArb(
  pollId: string,
  questionId: string,
  options: string[],
) {
  return fc
    .array(
      fc.record({
        sessionToken: sessionTokenArb,
        participantName: participantNameArb,
        selectedOption: fc.constantFrom(...options),
        customText: fc.option(freeTextArb, { nil: null }),
        isTest: fc.boolean(),
      }),
      { minLength: 1, maxLength: 20 },
    )
    .map((entries) => {
      // Ensure unique session tokens
      const seen = new Set<string>();
      return entries
        .filter((e) => {
          if (seen.has(e.sessionToken)) return false;
          seen.add(e.sessionToken);
          return true;
        })
        .map((e) => ({
          id: crypto.randomUUID(),
          pollId,
          questionId,
          participantName: e.participantName,
          sessionToken: e.sessionToken,
          selectedOption: e.selectedOption,
          customText: e.customText,
          isTest: e.isTest,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
    });
}

// ─── Property 16: Test responses excluded from public results ────────────────

/**
 * Feature: shoprite-x-polling-app, Property 16: Test responses excluded from public results and participant count
 *
 * For any set of responses containing both test (isTest=true) and real (isTest=false) responses,
 * the public results aggregation SHALL include only real responses in counts, percentages, and participant count.
 *
 * **Validates: Requirements 6.2, 6.3, 6.7, 5.10**
 */
describe('Property 16: Test responses excluded from public results and participant count', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('public results include only real responses in counts, percentages, and participant count', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdArb,
        optionsArb,
        async (pollId, questionId, options) => {
          store = createMockStore();

          // Set up question
          store.questions.push({
            id: questionId,
            pollId,
            text: 'Test Question',
            options,
            allowCustom: true,
            position: null,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Generate responses with a guaranteed mix of test and real
          const realResponses: MockResponse[] = [];
          const testResponses: MockResponse[] = [];

          // At least 1 real and 1 test response
          for (let i = 0; i < 3; i++) {
            realResponses.push({
              id: crypto.randomUUID(),
              pollId,
              questionId,
              participantName: `Real User ${i}`,
              sessionToken: crypto.randomUUID(),
              selectedOption: options[i % options.length],
              customText: null,
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          for (let i = 0; i < 2; i++) {
            testResponses.push({
              id: crypto.randomUUID(),
              pollId,
              questionId,
              participantName: `Test User ${i}`,
              sessionToken: crypto.randomUUID(),
              selectedOption: options[i % options.length],
              customText: null,
              isTest: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          store.responses = [...realResponses, ...testResponses];

          const service = createResponseService();
          const results = await service.getResults(pollId, {
            includeTest: false,
            revealStage: 'DETAILS',
            anonymise: false,
          });

          // Participant count should only count real responses
          const realTokens = new Set(realResponses.map((r) => r.sessionToken));
          expect(results.participantCount).toBe(realTokens.size);

          // Total submission count should only include real responses
          expect(results.submissionCount).toBe(realResponses.length);

          // Per-question counts should only reflect real responses
          for (const qResult of results.questions) {
            const realForQuestion = realResponses.filter((r) => r.questionId === qResult.questionId);
            expect(qResult.totalResponses).toBe(realForQuestion.length);

            // Sum of option counts should equal total real responses for this question
            const totalOptionCount = qResult.options.reduce((sum, o) => sum + o.count, 0);
            expect(totalOptionCount).toBe(realForQuestion.length);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 17: Clearing test responses preserves real data ────────────────

/**
 * Feature: shoprite-x-polling-app, Property 17: Clearing test responses preserves real data
 *
 * For any poll with a mix of test and real responses, clearing test responses SHALL remove
 * all test-flagged responses while leaving all real responses unchanged.
 *
 * **Validates: Requirements 6.5**
 */
describe('Property 17: Clearing test responses preserves real data', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('clearing test responses removes all test-flagged responses and leaves real responses unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdArb,
        optionsArb,
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        async (pollId, questionId, options, realCount, testCount) => {
          store = createMockStore();

          // Create real responses
          const realResponses: MockResponse[] = [];
          for (let i = 0; i < realCount; i++) {
            realResponses.push({
              id: crypto.randomUUID(),
              pollId,
              questionId,
              participantName: `Real User ${i}`,
              sessionToken: crypto.randomUUID(),
              selectedOption: options[i % options.length],
              customText: null,
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Create test responses
          const testResponsesList: MockResponse[] = [];
          for (let i = 0; i < testCount; i++) {
            testResponsesList.push({
              id: crypto.randomUUID(),
              pollId,
              questionId,
              participantName: `Test User ${i}`,
              sessionToken: crypto.randomUUID(),
              selectedOption: options[i % options.length],
              customText: null,
              isTest: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          store.responses = [...realResponses, ...testResponsesList];

          // Snapshot real responses before clearing
          const realResponsesBefore = realResponses.map((r) => ({ ...r }));

          const service = createResponseService();
          await service.clearTestResponses(pollId);

          // All test responses should be removed
          const remainingTest = store.responses.filter((r) => r.pollId === pollId && r.isTest === true);
          expect(remainingTest.length).toBe(0);

          // All real responses should remain unchanged
          const remainingReal = store.responses.filter((r) => r.pollId === pollId && r.isTest === false);
          expect(remainingReal.length).toBe(realResponsesBefore.length);

          // Verify each real response is intact
          for (const original of realResponsesBefore) {
            const found = remainingReal.find((r) => r.id === original.id);
            expect(found).toBeDefined();
            expect(found!.participantName).toBe(original.participantName);
            expect(found!.selectedOption).toBe(original.selectedOption);
            expect(found!.sessionToken).toBe(original.sessionToken);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 18: Results aggregation correctness ────────────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 18: Results aggregation correctness
 *
 * For any set of responses to a question, the computed count for each option SHALL equal
 * the number of responses selecting that option, and the percentage SHALL equal (count / total) × 100.
 *
 * **Validates: Requirements 7.1, 7.2**
 */
describe('Property 18: Results aggregation correctness', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('computed count equals actual count and percentage equals (count/total)*100 rounded', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdArb,
        optionsArb,
        fc.integer({ min: 1, max: 30 }),
        async (pollId, questionId, options, responseCount) => {
          store = createMockStore();

          store.questions.push({
            id: questionId,
            pollId,
            text: 'Aggregation Question',
            options,
            allowCustom: false,
            position: null,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Generate responses selecting from available options
          const responses: MockResponse[] = [];
          for (let i = 0; i < responseCount; i++) {
            responses.push({
              id: crypto.randomUUID(),
              pollId,
              questionId,
              participantName: `User ${i}`,
              sessionToken: crypto.randomUUID(),
              selectedOption: options[i % options.length],
              customText: null,
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          store.responses = responses;

          const service = createResponseService();
          const results = await service.getResults(pollId, {
            includeTest: false,
            revealStage: 'COUNTS',
            anonymise: false,
          });

          expect(results.questions.length).toBe(1);
          const qResult = results.questions[0];

          // Verify counts
          for (const optResult of qResult.options) {
            const expectedCount = responses.filter(
              (r) => r.selectedOption === optResult.label,
            ).length;
            expect(optResult.count).toBe(expectedCount);

            // Verify percentage is within 1% of the true value (count / total) × 100
            // The service uses largest-remainder rounding to ensure sum stays within 99-101%
            const truePercentage =
              responseCount > 0 ? (expectedCount / responseCount) * 100 : 0;
            expect(optResult.percentage).toBeGreaterThanOrEqual(Math.floor(truePercentage));
            expect(optResult.percentage).toBeLessThanOrEqual(Math.ceil(truePercentage));
          }

          // Total responses should match
          expect(qResult.totalResponses).toBe(responseCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 19: Percentage sum invariant ───────────────────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 19: Percentage sum invariant
 *
 * For any question with at least one response, the sum of all option percentages SHALL be
 * between 99% and 101% (inclusive).
 *
 * **Validates: Requirements 7.3**
 */
describe('Property 19: Percentage sum invariant', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('sum of all option percentages is between 99 and 101 inclusive', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdArb,
        optionsArb,
        fc.integer({ min: 1, max: 50 }),
        async (pollId, questionId, options, responseCount) => {
          store = createMockStore();

          store.questions.push({
            id: questionId,
            pollId,
            text: 'Percentage Question',
            options,
            allowCustom: false,
            position: null,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Generate responses distributed across options
          const responses: MockResponse[] = [];
          for (let i = 0; i < responseCount; i++) {
            responses.push({
              id: crypto.randomUUID(),
              pollId,
              questionId,
              participantName: `User ${i}`,
              sessionToken: crypto.randomUUID(),
              selectedOption: options[i % options.length],
              customText: null,
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          store.responses = responses;

          const service = createResponseService();
          const results = await service.getResults(pollId, {
            includeTest: false,
            revealStage: 'COUNTS',
            anonymise: false,
          });

          expect(results.questions.length).toBe(1);
          const qResult = results.questions[0];

          // Sum of percentages should be between 99 and 101
          const percentageSum = qResult.options.reduce((sum, o) => sum + o.percentage, 0);
          expect(percentageSum).toBeGreaterThanOrEqual(99);
          expect(percentageSum).toBeLessThanOrEqual(101);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 20: Free-text verbatim preservation ────────────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 20: Free-text verbatim preservation
 *
 * For any free-text response string, the displayed result SHALL contain the exact submitted
 * text without truncation.
 *
 * **Validates: Requirements 7.4**
 */
describe('Property 20: Free-text verbatim preservation', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('free-text responses are returned verbatim without truncation', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdArb,
        optionsArb,
        fc.array(freeTextArb, { minLength: 1, maxLength: 10 }),
        async (pollId, questionId, options, freeTexts) => {
          store = createMockStore();

          store.questions.push({
            id: questionId,
            pollId,
            text: 'Free Text Question',
            options,
            allowCustom: true,
            position: null,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Create responses with custom text
          const responses: MockResponse[] = freeTexts.map((text, i) => ({
            id: crypto.randomUUID(),
            pollId,
            questionId,
            participantName: `User ${i}`,
            sessionToken: crypto.randomUUID(),
            selectedOption: options[0],
            customText: text,
            isTest: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));
          store.responses = responses;

          const service = createResponseService();
          const results = await service.getResults(pollId, {
            includeTest: false,
            revealStage: 'DETAILS',
            anonymise: false,
          });

          expect(results.questions.length).toBe(1);
          const qResult = results.questions[0];

          // Each free-text response should be preserved verbatim
          expect(qResult.customResponses.length).toBe(freeTexts.length);
          for (let i = 0; i < freeTexts.length; i++) {
            const found = qResult.customResponses.find((cr) => cr.text === freeTexts[i]);
            expect(found).toBeDefined();
            // Verify no truncation
            expect(found!.text.length).toBe(freeTexts[i].length);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 21: Anonymised results contain no real names ───────────────────

/**
 * Feature: shoprite-x-polling-app, Property 21: Anonymised results contain no real names in output
 *
 * For any set of responses where anonymisation is enabled, the complete rendered results output
 * SHALL contain zero occurrences of any real participant name string.
 *
 * **Validates: Requirements 7.5**
 */
describe('Property 21: Anonymised results contain no real names in output', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('anonymised results contain no real participant names', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdArb,
        optionsArb,
        fc.array(
          fc.record({
            name: fc.string({ minLength: 3, maxLength: 30 }).filter((s) => s.trim().length >= 3),
            text: freeTextArb,
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (pollId, questionId, options, participants) => {
          // Ensure participant names are unique and don't match "Participant N" pattern
          const uniqueNames = new Set<string>();
          const filteredParticipants = participants.filter((p) => {
            const name = p.name.trim();
            if (uniqueNames.has(name)) return false;
            if (/^Participant \d+$/.test(name)) return false;
            uniqueNames.add(name);
            return true;
          });
          fc.pre(filteredParticipants.length >= 1);

          store = createMockStore();

          store.questions.push({
            id: questionId,
            pollId,
            text: 'Anonymised Question',
            options,
            allowCustom: true,
            position: null,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Create responses with real participant names and custom text
          const responses: MockResponse[] = filteredParticipants.map((p, i) => ({
            id: crypto.randomUUID(),
            pollId,
            questionId,
            participantName: p.name,
            sessionToken: crypto.randomUUID(),
            selectedOption: options[i % options.length],
            customText: p.text,
            isTest: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));
          store.responses = responses;

          const service = createResponseService();
          const results = await service.getResults(pollId, {
            includeTest: false,
            revealStage: 'DETAILS',
            anonymise: true,
          });

          // No real participant name should appear in any participantLabel field
          for (const qResult of results.questions) {
            for (const cr of qResult.customResponses) {
              for (const p of filteredParticipants) {
                expect(cr.participantLabel).not.toBe(p.name);
              }
              // All participant labels should be "Participant N" format
              expect(cr.participantLabel).toMatch(/^Participant \d+$/);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 22: Free-text section hidden when no custom entries ────────────

/**
 * Feature: shoprite-x-polling-app, Property 22: Free-text section hidden when no custom entries exist
 *
 * For any question where no responses selected the custom option, the results output SHALL
 * not include a free-text/custom section for that question.
 *
 * **Validates: Requirements 7.8**
 */
describe('Property 22: Free-text section hidden when no custom entries exist', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('results have empty customResponses array when no responses have custom text', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdArb,
        optionsArb,
        fc.integer({ min: 1, max: 20 }),
        async (pollId, questionId, options, responseCount) => {
          store = createMockStore();

          store.questions.push({
            id: questionId,
            pollId,
            text: 'No Custom Question',
            options,
            allowCustom: true,
            position: null,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Create responses with NO custom text (all null)
          const responses: MockResponse[] = [];
          for (let i = 0; i < responseCount; i++) {
            responses.push({
              id: crypto.randomUUID(),
              pollId,
              questionId,
              participantName: `User ${i}`,
              sessionToken: crypto.randomUUID(),
              selectedOption: options[i % options.length],
              customText: null,
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          store.responses = responses;

          const service = createResponseService();
          const results = await service.getResults(pollId, {
            includeTest: false,
            revealStage: 'DETAILS',
            anonymise: false,
          });

          expect(results.questions.length).toBe(1);
          const qResult = results.questions[0];

          // Free-text section should be empty (hidden)
          expect(qResult.customResponses.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('results have empty customResponses when all customText fields are empty strings', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdArb,
        optionsArb,
        fc.integer({ min: 1, max: 20 }),
        async (pollId, questionId, options, responseCount) => {
          store = createMockStore();

          store.questions.push({
            id: questionId,
            pollId,
            text: 'Empty Custom Question',
            options,
            allowCustom: true,
            position: null,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Create responses with empty string custom text
          const responses: MockResponse[] = [];
          for (let i = 0; i < responseCount; i++) {
            responses.push({
              id: crypto.randomUUID(),
              pollId,
              questionId,
              participantName: `User ${i}`,
              sessionToken: crypto.randomUUID(),
              selectedOption: options[i % options.length],
              customText: '',
              isTest: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          store.responses = responses;

          const service = createResponseService();
          const results = await service.getResults(pollId, {
            includeTest: false,
            revealStage: 'DETAILS',
            anonymise: false,
          });

          expect(results.questions.length).toBe(1);
          const qResult = results.questions[0];

          // Free-text section should be empty (hidden) since all customText are empty strings
          expect(qResult.customResponses.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
