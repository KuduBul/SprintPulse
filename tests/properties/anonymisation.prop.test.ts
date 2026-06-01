import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: shoprite-x-polling-app
 * Property 13: Anonymisation replaces all participant names
 *
 * For any set of responses with participant names, when anonymisation is enabled,
 * the rendered results SHALL contain zero occurrences of any real participant name
 * and SHALL instead use sequential labels "Participant 1", "Participant 2", etc.
 *
 * **Validates: Requirements 5.5, 7.5**
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

/**
 * Generates a participant name that is non-empty, distinct, and does NOT match
 * the "Participant N" pattern (to avoid false positives in assertions).
 */
const participantNameArb = fc
  .string({ minLength: 3, maxLength: 30 })
  .filter((s) => s.trim().length >= 3 && !/^Participant \d+$/.test(s.trim()));

/** Generates a list of predefined options (2–6 items) */
const optionsArb = fc
  .array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 2, maxLength: 6 })
  .filter((opts) => new Set(opts).size === opts.length);

/** Generates a free-text string (non-empty) */
const freeTextArb = fc.string({ minLength: 1, maxLength: 200 });

// ─── Property 13: Anonymisation replaces all participant names ───────────────

describe('Property 13: Anonymisation replaces all participant names', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('when anonymisation is enabled, results contain zero occurrences of any real participant name and use sequential "Participant N" labels', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        questionIdArb,
        optionsArb,
        fc.array(
          fc.record({
            name: participantNameArb,
            text: freeTextArb,
            sessionToken: sessionTokenArb,
          }),
          { minLength: 2, maxLength: 15 },
        ),
        async (pollId, questionId, options, participants) => {
          // Ensure unique session tokens and unique names
          const seenTokens = new Set<string>();
          const seenNames = new Set<string>();
          const uniqueParticipants = participants
            .filter((p) => {
              const name = p.name.trim();
              if (seenTokens.has(p.sessionToken)) return false;
              if (seenNames.has(name)) return false;
              seenTokens.add(p.sessionToken);
              seenNames.add(name);
              return true;
            })
            // Make custom text unique per participant so the text-based matching
            // below is unambiguous (two participants may otherwise generate
            // identical free-text).
            .map((p) => ({ ...p, text: `${p.sessionToken}::${p.text}` }));
          fc.pre(uniqueParticipants.length >= 2);

          store = createMockStore();

          store.questions.push({
            id: questionId,
            pollId,
            text: 'Anonymisation Test Question',
            options,
            allowCustom: true,
            position: null,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Create responses with real participant names and custom text
          const responses: MockResponse[] = uniqueParticipants.map((p, i) => ({
            id: crypto.randomUUID(),
            pollId,
            questionId,
            participantName: p.name,
            sessionToken: p.sessionToken,
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

          // Collect all participant labels from the results
          const allLabels: string[] = [];
          for (const qResult of results.questions) {
            for (const cr of qResult.customResponses) {
              allLabels.push(cr.participantLabel);
            }
          }

          // 1. No real participant name should appear in any participantLabel
          for (const cr of allLabels) {
            for (const p of uniqueParticipants) {
              expect(cr).not.toBe(p.name);
            }
          }

          // 2. All participant labels should match the "Participant N" pattern
          for (const label of allLabels) {
            expect(label).toMatch(/^Participant \d+$/);
          }

          // 3. Labels should be sequential starting from 1
          //    (each unique session token gets a unique number)
          const labelNumbers = allLabels.map((l) => parseInt(l.replace('Participant ', ''), 10));
          for (const num of labelNumbers) {
            expect(num).toBeGreaterThanOrEqual(1);
            expect(num).toBeLessThanOrEqual(uniqueParticipants.length);
          }

          // 4. Different session tokens should get different participant numbers
          const tokenToLabel = new Map<string, string>();
          for (const qResult of results.questions) {
            for (let i = 0; i < qResult.customResponses.length; i++) {
              const cr = qResult.customResponses[i];
              // Find the response that matches this custom response text
              const matchingResponse = responses.find((r) => r.customText === cr.text);
              if (matchingResponse) {
                const existingLabel = tokenToLabel.get(matchingResponse.sessionToken);
                if (existingLabel) {
                  // Same token should always get the same label
                  expect(cr.participantLabel).toBe(existingLabel);
                } else {
                  tokenToLabel.set(matchingResponse.sessionToken, cr.participantLabel);
                }
              }
            }
          }

          // Verify all assigned labels are unique per token
          const assignedLabels = Array.from(tokenToLabel.values());
          expect(new Set(assignedLabels).size).toBe(assignedLabels.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('anonymisation works correctly across multiple questions', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        fc.array(questionIdArb, { minLength: 2, maxLength: 4 }),
        optionsArb,
        fc.array(
          fc.record({
            name: participantNameArb,
            text: freeTextArb,
            sessionToken: sessionTokenArb,
          }),
          { minLength: 2, maxLength: 10 },
        ),
        async (pollId, questionIds, options, participants) => {
          // Ensure unique question IDs
          const uniqueQuestionIds = [...new Set(questionIds)];
          fc.pre(uniqueQuestionIds.length >= 2);

          // Ensure unique session tokens and names
          const seenTokens = new Set<string>();
          const seenNames = new Set<string>();
          const uniqueParticipants = participants
            .filter((p) => {
              const name = p.name.trim();
              if (seenTokens.has(p.sessionToken)) return false;
              if (seenNames.has(name)) return false;
              seenTokens.add(p.sessionToken);
              seenNames.add(name);
              return true;
            })
            // Make custom text unique per participant so the text-based matching
            // below is unambiguous (two participants may otherwise generate
            // identical free-text).
            .map((p) => ({ ...p, text: `${p.sessionToken}::${p.text}` }));
          fc.pre(uniqueParticipants.length >= 2);

          store = createMockStore();

          // Create multiple questions
          for (let qi = 0; qi < uniqueQuestionIds.length; qi++) {
            store.questions.push({
              id: uniqueQuestionIds[qi],
              pollId,
              text: `Question ${qi + 1}`,
              options,
              allowCustom: true,
              position: null,
              displayOrder: qi,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Create responses for each participant across all questions
          const responses: MockResponse[] = [];
          for (const p of uniqueParticipants) {
            for (let qi = 0; qi < uniqueQuestionIds.length; qi++) {
              responses.push({
                id: crypto.randomUUID(),
                pollId,
                questionId: uniqueQuestionIds[qi],
                participantName: p.name,
                sessionToken: p.sessionToken,
                selectedOption: options[qi % options.length],
                customText: p.text,
                isTest: false,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }
          store.responses = responses;

          const service = createResponseService();
          const results = await service.getResults(pollId, {
            includeTest: false,
            revealStage: 'DETAILS',
            anonymise: true,
          });

          // Verify across all questions
          expect(results.questions.length).toBe(uniqueQuestionIds.length);

          // Collect all labels across all questions
          const allLabels: string[] = [];
          for (const qResult of results.questions) {
            for (const cr of qResult.customResponses) {
              allLabels.push(cr.participantLabel);

              // No real name should appear
              for (const p of uniqueParticipants) {
                expect(cr.participantLabel).not.toBe(p.name);
              }

              // Must match "Participant N" pattern
              expect(cr.participantLabel).toMatch(/^Participant \d+$/);
            }
          }

          // Same participant (session token) should get the same label across questions
          const tokenLabelMap = new Map<string, string>();
          for (const qResult of results.questions) {
            for (const cr of qResult.customResponses) {
              const matchingResponse = responses.find(
                (r) => r.customText === cr.text && r.questionId === qResult.questionId,
              );
              if (matchingResponse) {
                const existing = tokenLabelMap.get(matchingResponse.sessionToken);
                if (existing) {
                  expect(cr.participantLabel).toBe(existing);
                } else {
                  tokenLabelMap.set(matchingResponse.sessionToken, cr.participantLabel);
                }
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
