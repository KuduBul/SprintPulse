import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: shoprite-x-polling-app
 * Property 14: Facilitator state persistence round-trip
 * Property 15: Last-write-wins for concurrent state updates
 *
 * Validates: Requirements 5.6, 5.8
 */

// ─── Mock Prisma Client ──────────────────────────────────────────────────────

interface MockPoll {
  id: string;
  facilitatorState: unknown;
}

let mockPolls: MockPoll[];
let mockAuditLogs: any[];

function resetStore() {
  mockPolls = [];
  mockAuditLogs = [];
}

vi.mock('@/lib/db/client', () => {
  return {
    prisma: {
      poll: {
        findFirstOrThrow: vi.fn(async ({ where, select }: any) => {
          const poll = mockPolls.find((p) => p.id === where.id);
          if (!poll) throw new Error(`Poll not found: ${where.id}`);
          if (select?.facilitatorState) {
            return { facilitatorState: poll.facilitatorState };
          }
          return poll;
        }),
      },
      $transaction: vi.fn(async (fn: any) => {
        const tx = {
          poll: {
            findFirstOrThrow: vi.fn(async ({ where, select }: any) => {
              const poll = mockPolls.find((p) => p.id === where.id);
              if (!poll) throw new Error(`Poll not found: ${where.id}`);
              if (select?.facilitatorState) {
                return { facilitatorState: poll.facilitatorState };
              }
              return poll;
            }),
            update: vi.fn(async ({ where, data }: any) => {
              const poll = mockPolls.find((p) => p.id === where.id);
              if (!poll) throw new Error(`Poll not found: ${where.id}`);
              if (data.facilitatorState !== undefined) {
                poll.facilitatorState = data.facilitatorState;
              }
              return poll;
            }),
          },
          auditLog: {
            create: vi.fn(async ({ data }: any) => {
              const entry = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
              mockAuditLogs.push(entry);
              return entry;
            }),
          },
        };
        return fn(tx);
      }),
    },
  };
});

vi.mock('@/lib/services/auditLogger', () => ({
  auditLogger: {
    log: vi.fn(async (_entry: any, _tx: any) => {}),
  },
}));

// Import after mocks
import { createFacilitatorService, type FacilitatorState, type RevealStage } from '@/lib/services/facilitatorService';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a valid RevealStage value */
const revealStageArb: fc.Arbitrary<RevealStage> = fc.constantFrom('HIDDEN', 'COUNTS', 'DETAILS');

/** Generates a valid FacilitatorState */
const facilitatorStateArb: fc.Arbitrary<FacilitatorState> = fc.record({
  votingOpen: fc.boolean(),
  liveResults: fc.boolean(),
  anonymise: fc.boolean(),
  revealStage: revealStageArb,
});

/** Generates a partial FacilitatorState (for patches) */
const facilitatorStatePatchArb: fc.Arbitrary<Partial<FacilitatorState>> = fc.record(
  {
    votingOpen: fc.boolean(),
    liveResults: fc.boolean(),
    anonymise: fc.boolean(),
    revealStage: revealStageArb,
  },
  { requiredKeys: [] }
);

/** Generates a valid poll ID (UUID) */
const pollIdArb = fc.uuid();

// ─── Property 14: Facilitator state persistence round-trip ───────────────────

/**
 * Feature: shoprite-x-polling-app, Property 14: Facilitator state persistence round-trip
 *
 * For any valid facilitator state (any combination of votingOpen, liveResults, anonymise,
 * revealStage), saving and then retrieving the state SHALL return an equivalent state.
 *
 * **Validates: Requirements 5.6**
 */
describe('Property 14: Facilitator state persistence round-trip', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('saving a full facilitator state and retrieving it returns an equivalent state', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        facilitatorStateArb,
        async (pollId, state) => {
          resetStore();

          // Seed a poll with default state
          mockPolls.push({
            id: pollId,
            facilitatorState: {
              _v: 1,
              votingOpen: false,
              liveResults: false,
              anonymise: true,
              revealStage: 'HIDDEN',
            },
          });

          const service = createFacilitatorService();

          // Update with the full state
          await service.updateState(pollId, state);

          // Retrieve the state
          const retrieved = await service.getState(pollId);

          // Verify round-trip equivalence
          expect(retrieved.votingOpen).toBe(state.votingOpen);
          expect(retrieved.liveResults).toBe(state.liveResults);
          expect(retrieved.anonymise).toBe(state.anonymise);
          expect(retrieved.revealStage).toBe(state.revealStage);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('saving a partial facilitator state and retrieving it returns the merged state', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        facilitatorStateArb,
        facilitatorStatePatchArb,
        async (pollId, initialState, patch) => {
          resetStore();

          // Seed a poll with the initial state
          mockPolls.push({
            id: pollId,
            facilitatorState: {
              _v: 1,
              ...initialState,
            },
          });

          const service = createFacilitatorService();

          // Apply partial update
          await service.updateState(pollId, patch);

          // Retrieve the state
          const retrieved = await service.getState(pollId);

          // The retrieved state should be the initial state merged with the patch
          const expected: FacilitatorState = {
            votingOpen: patch.votingOpen !== undefined ? patch.votingOpen : initialState.votingOpen,
            liveResults: patch.liveResults !== undefined ? patch.liveResults : initialState.liveResults,
            anonymise: patch.anonymise !== undefined ? patch.anonymise : initialState.anonymise,
            revealStage: patch.revealStage !== undefined ? patch.revealStage : initialState.revealStage,
          };

          expect(retrieved.votingOpen).toBe(expected.votingOpen);
          expect(retrieved.liveResults).toBe(expected.liveResults);
          expect(retrieved.anonymise).toBe(expected.anonymise);
          expect(retrieved.revealStage).toBe(expected.revealStage);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('retrieved state does not include internal _v key', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        facilitatorStateArb,
        async (pollId, state) => {
          resetStore();

          mockPolls.push({
            id: pollId,
            facilitatorState: {
              _v: 1,
              ...state,
            },
          });

          const service = createFacilitatorService();
          const retrieved = await service.getState(pollId);

          // The public state should not expose the _v key
          expect('_v' in retrieved).toBe(false);
          // Should only have the 4 expected keys
          const keys = Object.keys(retrieved).sort();
          expect(keys).toEqual(['anonymise', 'liveResults', 'revealStage', 'votingOpen']);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 15: Last-write-wins for concurrent state updates ───────────────

/**
 * Feature: shoprite-x-polling-app, Property 15: Last-write-wins for concurrent state updates
 *
 * For any two facilitator state updates applied sequentially, the persisted state SHALL
 * equal the last update applied.
 *
 * **Validates: Requirements 5.8**
 */
describe('Property 15: Last-write-wins for concurrent state updates', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('two sequential full state updates result in the last update being persisted', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        facilitatorStateArb,
        facilitatorStateArb,
        async (pollId, firstUpdate, secondUpdate) => {
          resetStore();

          // Seed a poll with default state
          mockPolls.push({
            id: pollId,
            facilitatorState: {
              _v: 1,
              votingOpen: false,
              liveResults: false,
              anonymise: true,
              revealStage: 'HIDDEN',
            },
          });

          const service = createFacilitatorService();

          // Apply first update
          await service.updateState(pollId, firstUpdate);

          // Apply second update (last-write-wins)
          await service.updateState(pollId, secondUpdate);

          // Retrieve the state
          const retrieved = await service.getState(pollId);

          // The persisted state should equal the second (last) update
          expect(retrieved.votingOpen).toBe(secondUpdate.votingOpen);
          expect(retrieved.liveResults).toBe(secondUpdate.liveResults);
          expect(retrieved.anonymise).toBe(secondUpdate.anonymise);
          expect(retrieved.revealStage).toBe(secondUpdate.revealStage);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('two sequential partial updates result in the merged state with last-write-wins per field', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        facilitatorStatePatchArb,
        facilitatorStatePatchArb,
        async (pollId, firstPatch, secondPatch) => {
          resetStore();

          const initialState: FacilitatorState = {
            votingOpen: false,
            liveResults: false,
            anonymise: true,
            revealStage: 'HIDDEN',
          };

          // Seed a poll with default state
          mockPolls.push({
            id: pollId,
            facilitatorState: {
              _v: 1,
              ...initialState,
            },
          });

          const service = createFacilitatorService();

          // Apply first partial update
          await service.updateState(pollId, firstPatch);

          // Apply second partial update
          await service.updateState(pollId, secondPatch);

          // Retrieve the state
          const retrieved = await service.getState(pollId);

          // Compute expected state: initial → first patch → second patch
          // Each field takes the last value written to it
          const afterFirst: FacilitatorState = {
            votingOpen: firstPatch.votingOpen !== undefined ? firstPatch.votingOpen : initialState.votingOpen,
            liveResults: firstPatch.liveResults !== undefined ? firstPatch.liveResults : initialState.liveResults,
            anonymise: firstPatch.anonymise !== undefined ? firstPatch.anonymise : initialState.anonymise,
            revealStage: firstPatch.revealStage !== undefined ? firstPatch.revealStage : initialState.revealStage,
          };

          const expected: FacilitatorState = {
            votingOpen: secondPatch.votingOpen !== undefined ? secondPatch.votingOpen : afterFirst.votingOpen,
            liveResults: secondPatch.liveResults !== undefined ? secondPatch.liveResults : afterFirst.liveResults,
            anonymise: secondPatch.anonymise !== undefined ? secondPatch.anonymise : afterFirst.anonymise,
            revealStage: secondPatch.revealStage !== undefined ? secondPatch.revealStage : afterFirst.revealStage,
          };

          expect(retrieved.votingOpen).toBe(expected.votingOpen);
          expect(retrieved.liveResults).toBe(expected.liveResults);
          expect(retrieved.anonymise).toBe(expected.anonymise);
          expect(retrieved.revealStage).toBe(expected.revealStage);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('N sequential full updates result in the last update being persisted', async () => {
    await fc.assert(
      fc.asyncProperty(
        pollIdArb,
        fc.array(facilitatorStateArb, { minLength: 2, maxLength: 10 }),
        async (pollId, updates) => {
          resetStore();

          mockPolls.push({
            id: pollId,
            facilitatorState: {
              _v: 1,
              votingOpen: false,
              liveResults: false,
              anonymise: true,
              revealStage: 'HIDDEN',
            },
          });

          const service = createFacilitatorService();

          // Apply all updates sequentially
          for (const update of updates) {
            await service.updateState(pollId, update);
          }

          // Retrieve the state
          const retrieved = await service.getState(pollId);

          // The final state should equal the last update
          const lastUpdate = updates[updates.length - 1];
          expect(retrieved.votingOpen).toBe(lastUpdate.votingOpen);
          expect(retrieved.liveResults).toBe(lastUpdate.liveResults);
          expect(retrieved.anonymise).toBe(lastUpdate.anonymise);
          expect(retrieved.revealStage).toBe(lastUpdate.revealStage);
        }
      ),
      { numRuns: 100 }
    );
  });
});
