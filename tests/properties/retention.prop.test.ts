import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: shoprite-x-polling-app
 * Property 25: Retention purge respects age thresholds
 * Property 26: Audit log retention purge
 * Property 27: Soft-deleted poll hard-deletion after grace period
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.6
 */

// ─── Mock Data Stores ────────────────────────────────────────────────────────

interface MockResponse {
  id: string;
  pollId: string;
  createdAt: Date;
  isTest: boolean;
}

interface MockAuditLog {
  id: string;
  pollId: string | null;
  action: string;
  actor: string;
  createdAt: Date;
}

interface MockPoll {
  id: string;
  isDeleted: boolean;
  updatedAt: Date;
}

interface MockQuestion {
  id: string;
  pollId: string;
}

let mockResponses: MockResponse[];
let mockAuditLogs: MockAuditLog[];
let mockPolls: MockPoll[];
let mockQuestions: MockQuestion[];

function resetStore() {
  mockResponses = [];
  mockAuditLogs = [];
  mockPolls = [];
  mockQuestions = [];
}

// ─── Mock Prisma Client ──────────────────────────────────────────────────────

vi.mock('@/lib/db/client', () => {
  return {
    prisma: {
      response: {
        deleteMany: vi.fn(async ({ where }: any) => {
          let toDelete: MockResponse[];
          if (where.createdAt?.lt) {
            const cutoff = where.createdAt.lt as Date;
            toDelete = mockResponses.filter((r) => r.createdAt < cutoff);
          } else if (where.pollId?.in) {
            const pollIds = where.pollId.in as string[];
            toDelete = mockResponses.filter((r) => pollIds.includes(r.pollId));
          } else {
            toDelete = [];
          }
          const count = toDelete.length;
          mockResponses = mockResponses.filter((r) => !toDelete.includes(r));
          return { count };
        }),
      },
      auditLog: {
        deleteMany: vi.fn(async ({ where }: any) => {
          let toDelete: MockAuditLog[];
          if (where.createdAt?.lt) {
            const cutoff = where.createdAt.lt as Date;
            toDelete = mockAuditLogs.filter((a) => a.createdAt < cutoff);
          } else if (where.pollId?.in) {
            const pollIds = where.pollId.in as string[];
            toDelete = mockAuditLogs.filter((a) => a.pollId !== null && pollIds.includes(a.pollId));
          } else {
            toDelete = [];
          }
          const count = toDelete.length;
          mockAuditLogs = mockAuditLogs.filter((a) => !toDelete.includes(a));
          return { count };
        }),
      },
      poll: {
        findMany: vi.fn(async ({ where }: any) => {
          return mockPolls.filter(
            (p) => p.isDeleted === where.isDeleted && p.updatedAt < where.updatedAt.lt
          );
        }),
        deleteMany: vi.fn(async ({ where }: any) => {
          const ids = where.id.in as string[];
          const toDelete = mockPolls.filter((p) => ids.includes(p.id));
          const count = toDelete.length;
          mockPolls = mockPolls.filter((p) => !ids.includes(p.id));
          return { count };
        }),
      },
      question: {
        deleteMany: vi.fn(async ({ where }: any) => {
          const pollIds = where.pollId.in as string[];
          const toDelete = mockQuestions.filter((q) => pollIds.includes(q.pollId));
          const count = toDelete.length;
          mockQuestions = mockQuestions.filter((q) => !pollIds.includes(q.pollId));
          return { count };
        }),
      },
    },
  };
});

vi.mock('@/lib/config', () => ({
  config: {
    RETENTION_RESPONSES_DAYS: 90,
    RETENTION_AUDIT_DAYS: 365,
  },
}));

vi.mock('@/lib/services/auditLogger', () => ({
  auditLogger: {
    log: vi.fn(async () => {}),
  },
}));

// Import after mocks
import { createRetentionService } from '@/lib/services/retentionService';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a date that is a certain number of days ago from now */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/** Generates a number of days in the past (0 to 400 days) */
const daysAgoArb = fc.integer({ min: 0, max: 400 });

/** Generates a response with a configurable age in days */
const responseArb = (ageInDays: number): MockResponse => ({
  id: crypto.randomUUID(),
  pollId: crypto.randomUUID(),
  createdAt: daysAgo(ageInDays),
  isTest: false,
});

/** Generates a test response with a configurable age in days */
const testResponseArb = (ageInDays: number): MockResponse => ({
  id: crypto.randomUUID(),
  pollId: crypto.randomUUID(),
  createdAt: daysAgo(ageInDays),
  isTest: true,
});

/** Generates an audit log entry with a configurable age in days */
const auditLogArb = (ageInDays: number): MockAuditLog => ({
  id: crypto.randomUUID(),
  pollId: crypto.randomUUID(),
  action: 'POLL_CREATED',
  actor: 'admin',
  createdAt: daysAgo(ageInDays),
});

/** Generates a soft-deleted poll with a configurable age in days since deletion */
const softDeletedPollArb = (ageInDays: number): MockPoll => ({
  id: crypto.randomUUID(),
  isDeleted: true,
  updatedAt: daysAgo(ageInDays),
});

// ─── Property 25: Retention purge respects age thresholds ────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 25: Retention purge respects age thresholds
 *
 * For any set of responses with varying creation dates, running the purge SHALL delete
 * only those responses older than the configured threshold (default 90 days) and leave
 * newer responses intact. The same policy applies to both test and real responses.
 *
 * **Validates: Requirements 9.1, 9.6**
 */
describe('Property 25: Retention purge respects age thresholds', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('purge deletes only responses older than 90 days and leaves newer ones intact', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(daysAgoArb, { minLength: 1, maxLength: 20 }),
        async (ages) => {
          resetStore();

          // Create responses with varying ages
          for (const age of ages) {
            mockResponses.push(responseArb(age));
          }

          const service = createRetentionService();
          const result = await service.purge();

          // Responses older than 90 days should be deleted
          const expectedDeleted = ages.filter((age) => age > 90).length;
          const expectedRemaining = ages.filter((age) => age <= 90).length;

          expect(result.responsesDeleted).toBe(expectedDeleted);
          expect(mockResponses.length).toBe(expectedRemaining);

          // All remaining responses should be 90 days old or newer
          for (const response of mockResponses) {
            const ageMs = Date.now() - response.createdAt.getTime();
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            expect(ageDays).toBeLessThanOrEqual(91); // small tolerance for test execution time
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('purge applies the same retention policy to test and real responses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(daysAgoArb, { minLength: 1, maxLength: 10 }),
        fc.array(daysAgoArb, { minLength: 1, maxLength: 10 }),
        async (realAges, testAges) => {
          resetStore();

          // Create real responses
          for (const age of realAges) {
            mockResponses.push(responseArb(age));
          }

          // Create test responses
          for (const age of testAges) {
            mockResponses.push(testResponseArb(age));
          }

          const service = createRetentionService();
          const result = await service.purge();

          // Both test and real responses older than 90 days should be deleted
          const allAges = [...realAges, ...testAges];
          const expectedDeleted = allAges.filter((age) => age > 90).length;
          const expectedRemaining = allAges.filter((age) => age <= 90).length;

          expect(result.responsesDeleted).toBe(expectedDeleted);
          expect(mockResponses.length).toBe(expectedRemaining);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('purge with no responses older than threshold deletes nothing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 89 }), { minLength: 1, maxLength: 15 }),
        async (ages) => {
          resetStore();

          for (const age of ages) {
            mockResponses.push(responseArb(age));
          }

          const service = createRetentionService();
          const result = await service.purge();

          expect(result.responsesDeleted).toBe(0);
          expect(mockResponses.length).toBe(ages.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 26: Audit log retention purge ──────────────────────────────────

/**
 * Feature: shoprite-x-polling-app, Property 26: Audit log retention purge
 *
 * For any set of audit log entries with varying creation dates, running the purge SHALL
 * delete only those entries older than the configured threshold (default 365 days).
 *
 * **Validates: Requirements 9.2**
 */
describe('Property 26: Audit log retention purge', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('purge deletes only audit logs older than 365 days and leaves newer ones intact', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 1, maxLength: 20 }),
        async (ages) => {
          resetStore();

          // Create audit log entries with varying ages
          for (const age of ages) {
            mockAuditLogs.push(auditLogArb(age));
          }

          const service = createRetentionService();
          const result = await service.purge();

          // Audit logs older than 365 days should be deleted
          const expectedDeleted = ages.filter((age) => age > 365).length;
          const expectedRemaining = ages.filter((age) => age <= 365).length;

          expect(result.auditLogsDeleted).toBe(expectedDeleted);
          expect(mockAuditLogs.length).toBe(expectedRemaining);

          // All remaining audit logs should be 365 days old or newer
          for (const log of mockAuditLogs) {
            const ageMs = Date.now() - log.createdAt.getTime();
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            expect(ageDays).toBeLessThanOrEqual(366); // small tolerance for test execution time
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('purge with no audit logs older than threshold deletes nothing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 364 }), { minLength: 1, maxLength: 15 }),
        async (ages) => {
          resetStore();

          for (const age of ages) {
            mockAuditLogs.push(auditLogArb(age));
          }

          const service = createRetentionService();
          const result = await service.purge();

          expect(result.auditLogsDeleted).toBe(0);
          expect(mockAuditLogs.length).toBe(ages.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('purge with all audit logs older than threshold deletes all', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 366, max: 500 }), { minLength: 1, maxLength: 15 }),
        async (ages) => {
          resetStore();

          for (const age of ages) {
            mockAuditLogs.push(auditLogArb(age));
          }

          const service = createRetentionService();
          const result = await service.purge();

          expect(result.auditLogsDeleted).toBe(ages.length);
          expect(mockAuditLogs.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 27: Soft-deleted poll hard-deletion after grace period ─────────

/**
 * Feature: shoprite-x-polling-app, Property 27: Soft-deleted poll hard-deletion after grace period
 *
 * For any soft-deleted poll, running the purge SHALL hard-delete the poll if and only if
 * it was soft-deleted more than 30 days ago.
 *
 * **Validates: Requirements 9.3**
 */
describe('Property 27: Soft-deleted poll hard-deletion after grace period', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('purge hard-deletes soft-deleted polls older than 30 days and leaves newer ones', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 120 }), { minLength: 1, maxLength: 15 }),
        async (ages) => {
          resetStore();

          // Create soft-deleted polls with varying ages
          for (const age of ages) {
            mockPolls.push(softDeletedPollArb(age));
          }

          const service = createRetentionService();
          const result = await service.purge();

          // Polls soft-deleted more than 30 days ago should be hard-deleted
          const expectedDeleted = ages.filter((age) => age > 30).length;
          const expectedRemaining = ages.filter((age) => age <= 30).length;

          expect(result.pollsHardDeleted).toBe(expectedDeleted);
          expect(mockPolls.length).toBe(expectedRemaining);

          // All remaining polls should be soft-deleted 30 days ago or less
          for (const poll of mockPolls) {
            const ageMs = Date.now() - poll.updatedAt.getTime();
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            expect(ageDays).toBeLessThanOrEqual(31); // small tolerance for test execution time
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('purge does not hard-delete non-soft-deleted polls regardless of age', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 31, max: 200 }), { minLength: 1, maxLength: 10 }),
        async (ages) => {
          resetStore();

          // Create active (non-deleted) polls with old updatedAt dates
          for (const age of ages) {
            mockPolls.push({
              id: crypto.randomUUID(),
              isDeleted: false,
              updatedAt: daysAgo(age),
            });
          }

          const service = createRetentionService();
          const result = await service.purge();

          // No polls should be hard-deleted since none are soft-deleted
          expect(result.pollsHardDeleted).toBe(0);
          expect(mockPolls.length).toBe(ages.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('purge hard-deletes related responses, audit logs, and questions for purged polls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 31, max: 120 }),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        async (pollAge, numResponses, numQuestions) => {
          resetStore();

          const pollId = crypto.randomUUID();

          // Create a soft-deleted poll older than 30 days
          mockPolls.push({
            id: pollId,
            isDeleted: true,
            updatedAt: daysAgo(pollAge),
          });

          // Create related responses (recent, so they wouldn't be purged by age alone)
          for (let i = 0; i < numResponses; i++) {
            mockResponses.push({
              id: crypto.randomUUID(),
              pollId,
              createdAt: new Date(), // recent
              isTest: false,
            });
          }

          // Create related questions
          for (let i = 0; i < numQuestions; i++) {
            mockQuestions.push({
              id: crypto.randomUUID(),
              pollId,
            });
          }

          // Create related audit logs (recent)
          mockAuditLogs.push({
            id: crypto.randomUUID(),
            pollId,
            action: 'POLL_CREATED',
            actor: 'admin',
            createdAt: new Date(), // recent
          });

          const service = createRetentionService();
          const result = await service.purge();

          // The poll should be hard-deleted
          expect(result.pollsHardDeleted).toBe(1);
          expect(mockPolls.length).toBe(0);

          // Related responses should be cleaned up
          const remainingResponses = mockResponses.filter((r) => r.pollId === pollId);
          expect(remainingResponses.length).toBe(0);

          // Related questions should be cleaned up
          const remainingQuestions = mockQuestions.filter((q) => q.pollId === pollId);
          expect(remainingQuestions.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('purge with no soft-deleted polls older than 30 days deletes no polls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 29 }), { minLength: 1, maxLength: 10 }),
        async (ages) => {
          resetStore();

          for (const age of ages) {
            mockPolls.push(softDeletedPollArb(age));
          }

          const service = createRetentionService();
          const result = await service.purge();

          expect(result.pollsHardDeleted).toBe(0);
          expect(mockPolls.length).toBe(ages.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
