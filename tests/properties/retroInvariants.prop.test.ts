import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Retro Board Correctness Properties (Phase 2A)
 *
 * Property-based tests for the retro state machine and its invariants, written
 * BEFORE the service exists (test-first, task 3.1). They target the intended
 * `retroService` interface defined in design.md ("Components and Interfaces")
 * and are EXPECTED TO BE RED until task 4 implements the service. Do not weaken
 * these tests to make them pass; they go green when the real engine lands.
 *
 * Properties (from design.md "Correctness Properties"):
 *   P1 Vote cap            — **Validates: Requirements 7.2**
 *   P2 One-vote-per-card   — **Validates: Requirements 7.3**
 *   P3 Phase gates         — **Validates: Requirements 5.1, 5.6, 7.1, 7.4, 8.3**
 *   P4 Ownership           — **Validates: Requirements 5.3, 5.4**
 *   P5 Anonymity           — **Validates: Requirements 6.2, 6.3, 7.6**
 *   P6 Pulse preservation  — **Validates: Requirements 11.1, 11.3, 11.4** (placeholder; full check in task 9)
 */

// ─── In-memory mock store for the retro tables ──────────────────────────────

interface MockStore {
  polls: any[];
  auditLogs: any[];
  retroBoards: any[];
  retroLanes: any[];
  retroCards: any[];
  retroVotes: any[];
}

let store: MockStore;

function createMockStore(): MockStore {
  return {
    polls: [],
    auditLogs: [],
    retroBoards: [],
    retroLanes: [],
    retroCards: [],
    retroVotes: [],
  };
}

/**
 * Minimal Prisma-style `where` matcher. Supports scalar equality, AND/OR/NOT,
 * and composite-unique keys (e.g. `{ cardId_voterToken: { cardId, voterToken } }`)
 * by matching each sub-field against the row.
 */
function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((c) => matches(row, c));
    if (key === 'OR') return (Array.isArray(value) ? value : [value]).some((c) => matches(row, c));
    if (key === 'NOT') return !matches(row, value);
    if (value !== null && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      // Composite unique key: match each sub-field directly against the row.
      return Object.entries(value).every(([subKey, subVal]) => row[subKey] === subVal);
    }
    return row[key] === value;
  });
}

function sortRows(rows: any[], orderBy: any): any[] {
  if (!orderBy) return rows;
  const [[field, dir]] = Object.entries(orderBy) as [string, 'asc' | 'desc'][];
  return [...rows].sort((a, b) => {
    if (a[field] < b[field]) return dir === 'desc' ? 1 : -1;
    if (a[field] > b[field]) return dir === 'desc' ? -1 : 1;
    return 0;
  });
}

/**
 * Builds a standard Prisma-style delegate over a backing array. `getArr` is
 * evaluated lazily so the delegate always operates on the current `store`.
 */
function makeTable(getArr: () => any[], opts: { enforceUnique?: (row: any, existing: any[]) => boolean } = {}) {
  return {
    findUnique: vi.fn(async ({ where }: any) => getArr().find((r) => matches(r, where)) ?? null),
    findFirst: vi.fn(async ({ where }: any) => getArr().find((r) => matches(r, where)) ?? null),
    findMany: vi.fn(async ({ where, orderBy }: any = {}) => sortRows(getArr().filter((r) => matches(r, where)), orderBy)),
    create: vi.fn(async ({ data }: any) => {
      const arr = getArr();
      if (opts.enforceUnique && opts.enforceUnique(data, arr)) {
        const error: any = new Error('Unique constraint failed');
        error.code = 'P2002';
        throw error;
      }
      const row = { id: data.id ?? crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
      arr.push(row);
      return row;
    }),
    createMany: vi.fn(async ({ data }: any) => {
      const arr = getArr();
      for (const d of data) {
        arr.push({ id: d.id ?? crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...d });
      }
      return { count: data.length };
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const row = getArr().find((r) => matches(r, where));
      if (!row) {
        const error: any = new Error('Record to update not found');
        error.code = 'P2025';
        throw error;
      }
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    }),
    delete: vi.fn(async ({ where }: any) => {
      const arr = getArr();
      const idx = arr.findIndex((r) => matches(r, where));
      if (idx === -1) {
        const error: any = new Error('Record to delete does not exist');
        error.code = 'P2025';
        throw error;
      }
      const [removed] = arr.splice(idx, 1);
      return removed;
    }),
    deleteMany: vi.fn(async ({ where }: any = {}) => {
      const arr = getArr();
      let count = 0;
      for (let i = arr.length - 1; i >= 0; i--) {
        if (matches(arr[i], where)) {
          arr.splice(i, 1);
          count++;
        }
      }
      return { count };
    }),
    count: vi.fn(async ({ where }: any = {}) => getArr().filter((r) => matches(r, where)).length),
  };
}

// Mock the prisma client with the retro tables (mirrors the pulse mock-store style).
vi.mock('@/lib/db/client', () => {
  const buildTables = () => ({
    poll: makeTable(() => store.polls),
    auditLog: makeTable(() => store.auditLogs),
    retroBoard: makeTable(() => store.retroBoards),
    retroLane: makeTable(() => store.retroLanes),
    retroCard: makeTable(() => store.retroCards),
    // RetroVote carries the @@unique([cardId, voterToken]) constraint.
    retroVote: makeTable(() => store.retroVotes, {
      enforceUnique: (row, existing) =>
        existing.some((v) => v.cardId === row.cardId && v.voterToken === row.voterToken),
    }),
  });

  const tables = buildTables();

  return {
    prisma: {
      ...tables,
      $transaction: vi.fn(async (arg: any) => {
        if (typeof arg === 'function') return arg(tables);
        return Promise.all(arg);
      }),
    },
  };
});

// Mock the audit logger (the service may log retro mutations).
vi.mock('@/lib/services/auditLogger', () => ({
  auditLogger: { log: vi.fn(async () => {}) },
  createAuditLogger: vi.fn(() => ({ log: vi.fn(async () => {}) })),
}));

// Import after mocks. This import is RED until task 4 creates retroService — expected.
import { createRetroService } from '@/lib/services/retroService';

// ─── Seed helpers ────────────────────────────────────────────────────────────

function seedBoard(opts: { pollId?: string; phase?: 'gather' | 'vote' | 'closed'; votesPerUser?: number } = {}): any {
  const board = {
    id: crypto.randomUUID(),
    pollId: opts.pollId ?? crypto.randomUUID(),
    template: 'start_stop_continue',
    phase: opts.phase ?? 'gather',
    votesPerUser: opts.votesPerUser ?? 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.retroBoards.push(board);
  return board;
}

function seedLane(boardId: string, displayOrder = 0): any {
  const lane = {
    id: crypto.randomUUID(),
    boardId,
    title: 'Lane',
    displayOrder,
    position: null,
  };
  store.retroLanes.push(lane);
  return lane;
}

function seedCard(boardId: string, laneId: string, authorToken: string, authorName: string, text: string): any {
  const card = {
    id: crypto.randomUUID(),
    boardId,
    laneId,
    authorToken,
    authorName,
    text,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.retroCards.push(card);
  return card;
}

/** Runs an async op and reports whether it resolved or rejected (no throw). */
async function runOp(fn: () => Promise<unknown>): Promise<{ ok: boolean; error?: unknown }> {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Flattens cards out of a BoardView regardless of lane-nested or flat shape. */
function collectViewCards(view: any): any[] {
  if (!view) return [];
  if (Array.isArray(view.cards)) return view.cards;
  if (Array.isArray(view.lanes)) return view.lanes.flatMap((lane: any) => lane.cards ?? []);
  return [];
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const tokenArb = fc.uuid();
const phaseArb = fc.constantFrom<'gather' | 'vote' | 'closed'>('gather', 'vote', 'closed');
const cardTextArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length >= 1);

// ─── Property 1: Vote cap invariant ──────────────────────────────────────────

/**
 * For any sequence of castVote operations by a single voter on a board with cap
 * N, that voter's stored votes never exceed N.
 *
 * **Validates: Requirements 7.2**
 */
describe('Property 1: Vote cap invariant', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('a single voter never accumulates more stored votes than the board cap', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // votesPerUser cap N
        fc.integer({ min: 3, max: 8 }), // number of cards available
        tokenArb,
        fc.array(fc.nat(), { minLength: 1, maxLength: 40 }), // sequence of card picks
        async (cap, cardCount, voterToken, voteSeq) => {
          store = createMockStore();
          const board = seedBoard({ phase: 'vote', votesPerUser: cap });
          const lane = seedLane(board.id);
          const cards = Array.from({ length: cardCount }, (_, i) =>
            seedCard(board.id, lane.id, `author-${i}`, `Author ${i}`, `card ${i}`),
          );

          const service = createRetroService();

          for (const pick of voteSeq) {
            const card = cards[pick % cards.length];
            // Some calls will legitimately be rejected (cap hit / duplicate) — that is the point.
            await runOp(() => service.castVote(board.id, card.id, voterToken));
          }

          const stored = store.retroVotes.filter((v) => v.voterToken === voterToken);
          expect(stored.length).toBeLessThanOrEqual(cap);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ─── Property 2: One-vote-per-card invariant ─────────────────────────────────

/**
 * For any voter and card, at most one RetroVote row ever exists, even under
 * repeated castVote calls for the same (card, voter).
 *
 * **Validates: Requirements 7.3**
 */
describe('Property 2: One-vote-per-card invariant', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('repeated votes on the same card by the same voter never create duplicate rows', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 6 }), // number of cards
        tokenArb,
        fc.array(fc.nat(), { minLength: 2, maxLength: 40 }), // repeated card picks
        async (cardCount, voterToken, voteSeq) => {
          store = createMockStore();
          // Cap >= number of cards so the cap never masks the uniqueness invariant.
          const board = seedBoard({ phase: 'vote', votesPerUser: cardCount });
          const lane = seedLane(board.id);
          const cards = Array.from({ length: cardCount }, (_, i) =>
            seedCard(board.id, lane.id, `author-${i}`, `Author ${i}`, `card ${i}`),
          );

          const service = createRetroService();

          for (const pick of voteSeq) {
            const card = cards[pick % cards.length];
            await runOp(() => service.castVote(board.id, card.id, voterToken));
          }

          const counts = new Map<string, number>();
          for (const v of store.retroVotes) {
            const key = `${v.cardId}|${v.voterToken}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          for (const c of counts.values()) {
            expect(c).toBeLessThanOrEqual(1);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ─── Property 3: Phase-gate invariant ────────────────────────────────────────

/**
 * Card creation succeeds only in `gather`; vote operations succeed only in
 * `vote`; in `closed` no participant mutation succeeds.
 *
 * **Validates: Requirements 5.1, 5.6, 7.1, 7.4, 8.3**
 */
describe('Property 3: Phase-gate invariant', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('addCard succeeds only while phase is gather', async () => {
    await fc.assert(
      fc.asyncProperty(phaseArb, tokenArb, cardTextArb, async (phase, authorToken, text) => {
        store = createMockStore();
        const board = seedBoard({ phase });
        const lane = seedLane(board.id);

        const service = createRetroService();
        const result = await runOp(() =>
          service.addCard(board.id, { laneId: lane.id, authorToken, authorName: 'Author', text }),
        );

        if (phase === 'gather') {
          expect(result.ok).toBe(true);
        } else {
          expect(result.ok).toBe(false);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('castVote succeeds only while phase is vote', async () => {
    await fc.assert(
      fc.asyncProperty(phaseArb, tokenArb, async (phase, voterToken) => {
        store = createMockStore();
        const board = seedBoard({ phase, votesPerUser: 3 });
        const lane = seedLane(board.id);
        const card = seedCard(board.id, lane.id, 'author', 'Author', 'a card');

        const service = createRetroService();
        const result = await runOp(() => service.castVote(board.id, card.id, voterToken));

        if (phase === 'vote') {
          expect(result.ok).toBe(true);
        } else {
          expect(result.ok).toBe(false);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('in closed phase, all participant mutations are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(tokenArb, cardTextArb, async (token, text) => {
        store = createMockStore();
        const board = seedBoard({ phase: 'closed', votesPerUser: 3 });
        const lane = seedLane(board.id);
        const card = seedCard(board.id, lane.id, token, 'Author', 'existing card');

        const service = createRetroService();

        const add = await runOp(() =>
          service.addCard(board.id, { laneId: lane.id, authorToken: token, authorName: 'Author', text }),
        );
        const edit = await runOp(() => service.editCard(card.id, token, text));
        const del = await runOp(() => service.deleteCard(card.id, token));
        const vote = await runOp(() => service.castVote(board.id, card.id, token));
        const unvote = await runOp(() => service.removeVote(board.id, card.id, token));

        expect(add.ok).toBe(false);
        expect(edit.ok).toBe(false);
        expect(del.ok).toBe(false);
        expect(vote.ok).toBe(false);
        expect(unvote.ok).toBe(false);
      }),
      { numRuns: 50 },
    );
  });
});

// ─── Property 4: Ownership invariant ─────────────────────────────────────────

/**
 * A card can be edited or deleted only by a request bearing its authorToken.
 *
 * **Validates: Requirements 5.3, 5.4**
 */
describe('Property 4: Ownership invariant', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('editCard succeeds only when the supplied token matches the author', async () => {
    await fc.assert(
      fc.asyncProperty(tokenArb, tokenArb, fc.boolean(), cardTextArb, async (ownerToken, otherToken, asOwner, newText) => {
        fc.pre(ownerToken !== otherToken);
        store = createMockStore();
        const board = seedBoard({ phase: 'gather' });
        const lane = seedLane(board.id);
        const card = seedCard(board.id, lane.id, ownerToken, 'Owner', 'original');

        const service = createRetroService();
        const token = asOwner ? ownerToken : otherToken;
        const result = await runOp(() => service.editCard(card.id, token, newText));

        expect(result.ok).toBe(asOwner);
      }),
      { numRuns: 50 },
    );
  });

  it('deleteCard succeeds only when the supplied token matches the author', async () => {
    await fc.assert(
      fc.asyncProperty(tokenArb, tokenArb, fc.boolean(), async (ownerToken, otherToken, asOwner) => {
        fc.pre(ownerToken !== otherToken);
        store = createMockStore();
        const board = seedBoard({ phase: 'gather' });
        const lane = seedLane(board.id);
        const card = seedCard(board.id, lane.id, ownerToken, 'Owner', 'original');

        const service = createRetroService();
        const token = asOwner ? ownerToken : otherToken;
        const result = await runOp(() => service.deleteCard(card.id, token));

        expect(result.ok).toBe(asOwner);
        // A rejected delete must not remove the card.
        if (!asOwner) {
          expect(store.retroCards.some((c) => c.id === card.id)).toBe(true);
        }
      }),
      { numRuns: 50 },
    );
  });
});

// ─── Property 5: Anonymity invariant ─────────────────────────────────────────

/**
 * For a board in anonymous state, a getBoard view rendered for participant A
 * never contains author identity for cards authored by participant B; the
 * author still sees and owns their own cards.
 *
 * **Validates: Requirements 6.2, 6.3, 7.6**
 */
describe('Property 5: Anonymity invariant', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it("participant A's view never exposes participant B's author identity while anonymous", async () => {
    await fc.assert(
      fc.asyncProperty(
        tokenArb, // viewer A's token
        tokenArb, // author B's token
        fc.integer({ min: 1, max: 5 }), // number of B-authored cards
        async (tokenA, tokenB, bCardCount) => {
          fc.pre(tokenA !== tokenB);
          store = createMockStore();
          // Anonymous-by-default state: gather phase, not revealed.
          const board = seedBoard({ phase: 'gather' });
          const lane = seedLane(board.id);

          // B's identity uses sentinels that will not collide with card text.
          const bName = 'ZZ_AUTHOR_B_NAME_ZZ';
          for (let i = 0; i < bCardCount; i++) {
            seedCard(board.id, lane.id, tokenB, bName, `b-card-text-${i}`);
          }
          // A's own card, so we can confirm A still sees their own contribution.
          seedCard(board.id, lane.id, tokenA, 'ZZ_AUTHOR_A_NAME_ZZ', 'a-card-text');

          const service = createRetroService();
          const view = await service.getBoard(board.pollId, { role: 'participant', participantToken: tokenA });

          const serialized = JSON.stringify(view);
          // B's author token must never leak to A.
          expect(serialized).not.toContain(tokenB);
          // B's author name must never leak to A.
          expect(serialized).not.toContain(bName);

          // A still sees the board content, including their own card.
          const viewCards = collectViewCards(view);
          expect(viewCards.length).toBeGreaterThan(0);
          expect(serialized).toContain('a-card-text');
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ─── Property 6: Pulse preservation invariant (placeholder) ──────────────────

/**
 * Pulse behavior is unchanged by the Phase 2 schema/service additions. The full
 * verification runs the existing pulse PBT + unit suites unchanged in task 9;
 * this is a deliberate light placeholder so the property is tracked here without
 * duplicating the pulse suite.
 *
 * **Validates: Requirements 11.1, 11.3, 11.4**
 */
describe('Property 6: Pulse preservation invariant (placeholder — full check in task 9)', () => {
  it('is verified by the existing pulse suites; this file adds no pulse-affecting mocks', () => {
    // This retro-only test file mocks the retro tables exclusively and does not
    // touch pollService/responseService, so it cannot alter pulse behavior.
    expect(true).toBe(true);
  });
});
