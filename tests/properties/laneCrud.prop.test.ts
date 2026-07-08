import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Lane CRUD Correctness Properties (Phase 2B)
 *
 * Property-based tests for the lane management operations introduced in Phase 2B:
 *   Property 7: Add lane grows lane count — addLane increases count by 1 for boards with <8 lanes
 *   Property 8: Lane update persistence round-trip — updateLane values are readable via getBoard
 *   Property 9: Lane deletion cascades to cards — deleteLane removes lane and all associated cards
 *   Property 10: Lane reorder preserves correct display order — permutation maps to displayOrder indices
 *
 * Feature: retro-enhancements-phase-2b
 */

// ─── In-memory mock store for the retro tables ──────────────────────────────

interface MockStore {
  polls: any[];
  auditLogs: any[];
  retroBoards: any[];
  retroLanes: any[];
  retroCards: any[];
  retroVotes: any[];
  retroActionItems: any[];
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
    retroActionItems: [],
  };
}

/**
 * Prisma-style `where` matcher. Supports scalar equality, AND/OR/NOT,
 * composite-unique keys, and the `{ in: [...] }` operator for deleteMany.
 */
function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((c) => matches(row, c));
    if (key === 'OR') return (Array.isArray(value) ? value : [value]).some((c) => matches(row, c));
    if (key === 'NOT') return !matches(row, value);
    if (value !== null && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      // Handle `{ in: [...] }` operator
      if ('in' in (value as Record<string, unknown>)) {
        return (value as { in: any[] }).in.includes(row[key]);
      }
      // Composite unique key: match each sub-field directly against the row.
      return Object.entries(value as Record<string, unknown>).every(([subKey, subVal]) => row[subKey] === subVal);
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
 * Builds a standard Prisma-style delegate over a backing array.
 */
function makeTable(getArr: () => any[], opts: { enforceUnique?: (row: any, existing: any[]) => boolean } = {}) {
  return {
    findUnique: vi.fn(async ({ where }: any) => getArr().find((r) => matches(r, where)) ?? null),
    findFirst: vi.fn(async ({ where }: any) => getArr().find((r) => matches(r, where)) ?? null),
    findMany: vi.fn(async ({ where, orderBy, select }: any = {}) => {
      const filtered = getArr().filter((r) => matches(r, where));
      const sorted = sortRows(filtered, orderBy);
      if (select) {
        return sorted.map((row) => {
          const result: any = {};
          for (const key of Object.keys(select)) {
            if (select[key]) result[key] = row[key];
          }
          return result;
        });
      }
      return sorted;
    }),
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

// Mock the prisma client with the retro tables
vi.mock('@/lib/db/client', () => {
  const buildTables = () => ({
    poll: makeTable(() => store.polls),
    auditLog: makeTable(() => store.auditLogs),
    retroBoard: makeTable(() => store.retroBoards),
    retroLane: makeTable(() => store.retroLanes),
    retroCard: makeTable(() => store.retroCards),
    retroVote: makeTable(() => store.retroVotes, {
      enforceUnique: (row, existing) =>
        existing.some((v) => v.cardId === row.cardId && v.voterToken === row.voterToken),
    }),
    retroActionItem: makeTable(() => store.retroActionItems),
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

// Mock the audit logger
vi.mock('@/lib/services/auditLogger', () => ({
  auditLogger: { log: vi.fn(async () => {}) },
  createAuditLogger: vi.fn(() => ({ log: vi.fn(async () => {}) })),
}));

// Mock the PDF export service (not needed for lane tests but required for import)
vi.mock('@/lib/retro/pdfExportService', () => ({
  generateRetroPdf: vi.fn(async () => Buffer.from('mock-pdf')),
}));

import { createRetroService } from '@/lib/services/retroService';

// ─── Seed helpers ────────────────────────────────────────────────────────────

function seedBoard(opts: { pollId?: string; phase?: 'gather' | 'vote' | 'closed'; votesPerUser?: number } = {}): any {
  const board = {
    id: crypto.randomUUID(),
    pollId: opts.pollId ?? crypto.randomUUID(),
    template: 'start_stop_continue',
    phase: opts.phase ?? 'gather',
    votesPerUser: opts.votesPerUser ?? 3,
    backgroundImage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.retroBoards.push(board);
  return board;
}

function seedLane(boardId: string, opts: { displayOrder?: number; title?: string; icon?: string | null; color?: string | null } = {}): any {
  const lane = {
    id: crypto.randomUUID(),
    boardId,
    title: opts.title ?? `Lane ${store.retroLanes.length}`,
    displayOrder: opts.displayOrder ?? store.retroLanes.filter((l) => l.boardId === boardId).length,
    position: null,
    icon: opts.icon ?? null,
    color: opts.color ?? null,
  };
  store.retroLanes.push(lane);
  return lane;
}

function seedCard(boardId: string, laneId: string, text?: string): any {
  const card = {
    id: crypto.randomUUID(),
    boardId,
    laneId,
    authorToken: crypto.randomUUID(),
    authorName: 'Author',
    text: text ?? `Card ${store.retroCards.length}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.retroCards.push(card);
  return card;
}

function seedVote(boardId: string, cardId: string): any {
  const vote = {
    id: crypto.randomUUID(),
    boardId,
    cardId,
    voterToken: crypto.randomUUID(),
  };
  store.retroVotes.push(vote);
  return vote;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a valid lane title (non-empty, ≤100 chars) */
const laneTitleArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length >= 1);

/** Generates an emoji icon (common single-char emojis) */
const emojiArb = fc.constantFrom('🚀', '🛑', '✅', '❤️', '📚', '⭐', '😡', '😢', '😊', '💨', '⚓', '🪨', '🏝️');

/** Generates a CSS color string */
const colorArb = fc.constantFrom('#4CAF50', '#F44336', '#2196F3', '#E91E63', '#9C27B0', '#FF9800', '#FFC107', '#03A9F4', '#795548', '#9E9E9E');

/** Generates a lane count between 1 and 7 (boards where addLane should succeed) */
const laneCountForAddArb = fc.integer({ min: 1, max: 7 });

/** Generates a number of cards per lane between 0 and 5 */
const cardCountArb = fc.integer({ min: 0, max: 5 });

// ─── Property 7: Add lane grows lane count ──────────────────────────────────

/**
 * For any board with fewer than 8 lanes, calling addLane SHALL increase the
 * board's lane count by exactly 1 and the new lane SHALL appear in the board's
 * lane list.
 *
 * Feature: retro-enhancements-phase-2b, Property 7: Add lane grows lane count
 * **Validates: Requirements 6.2**
 */
describe('Feature: retro-enhancements-phase-2b, Property 7: Add lane grows lane count', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('addLane increases lane count by exactly 1 for boards with 1-7 lanes', async () => {
    await fc.assert(
      fc.asyncProperty(
        laneCountForAddArb,
        laneTitleArb,
        fc.option(emojiArb),
        fc.option(colorArb),
        async (initialLaneCount, title, icon, color) => {
          store = createMockStore();
          const board = seedBoard();

          // Seed the initial lanes
          for (let i = 0; i < initialLaneCount; i++) {
            seedLane(board.id);
          }

          const service = createRetroService();
          const countBefore = store.retroLanes.filter((l) => l.boardId === board.id).length;

          // Add a new lane
          const newLane = await service.addLane(board.id, {
            title,
            icon: icon ?? undefined,
            color: color ?? undefined,
          });

          const countAfter = store.retroLanes.filter((l) => l.boardId === board.id).length;

          // Count increased by exactly 1
          expect(countAfter).toBe(countBefore + 1);

          // The new lane appears in the board's lane list
          const boardLanes = store.retroLanes.filter((l) => l.boardId === board.id);
          expect(boardLanes.some((l) => l.id === newLane.id)).toBe(true);

          // The new lane has the correct title (trimmed)
          expect(newLane.title).toBe(title.trim());
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 8: Lane update persistence round-trip ──────────────────────────

/**
 * For any existing lane and any valid update payload (title, icon, and/or color),
 * after calling updateLane, reading the board back via getBoard SHALL return the
 * lane with the updated values.
 *
 * Feature: retro-enhancements-phase-2b, Property 8: Lane update persistence round-trip
 * **Validates: Requirements 6.3, 13.4**
 */
describe('Feature: retro-enhancements-phase-2b, Property 8: Lane update persistence round-trip', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('updateLane values are readable via getBoard', async () => {
    await fc.assert(
      fc.asyncProperty(
        laneTitleArb,
        emojiArb,
        colorArb,
        async (newTitle, newIcon, newColor) => {
          store = createMockStore();
          const board = seedBoard();
          const lane = seedLane(board.id, { title: 'Original', icon: '🔵', color: '#000000' });

          const service = createRetroService();

          // Update the lane with new values
          await service.updateLane(lane.id, {
            title: newTitle,
            icon: newIcon,
            color: newColor,
          });

          // Read the board back via getBoard
          const boardView = await service.getBoard(board.pollId, { role: 'facilitator' });

          // Find the updated lane in the board view
          const updatedLane = boardView.lanes.find((l) => l.id === lane.id);

          expect(updatedLane).toBeDefined();
          expect(updatedLane!.title).toBe(newTitle.trim());
          expect(updatedLane!.icon).toBe(newIcon);
          expect(updatedLane!.color).toBe(newColor);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 9: Lane deletion cascades to cards ────────────────────────────

/**
 * For any lane containing N cards (where N ≥ 0), after calling deleteLane,
 * neither the lane record nor any of its associated card records SHALL exist
 * in the database.
 *
 * Feature: retro-enhancements-phase-2b, Property 9: Lane deletion cascades to cards
 * **Validates: Requirements 6.5**
 */
describe('Feature: retro-enhancements-phase-2b, Property 9: Lane deletion cascades to cards', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('deleteLane removes the lane and all associated cards', async () => {
    await fc.assert(
      fc.asyncProperty(
        cardCountArb,
        async (cardCount) => {
          store = createMockStore();
          const board = seedBoard();

          // Need at least 2 lanes so deletion is allowed (min 1 lane enforced)
          const laneToDelete = seedLane(board.id, { title: 'Lane to delete' });
          seedLane(board.id, { title: 'Remaining lane' });

          // Seed cards in the lane to be deleted
          const cardIds: string[] = [];
          for (let i = 0; i < cardCount; i++) {
            const card = seedCard(board.id, laneToDelete.id, `Card ${i}`);
            cardIds.push(card.id);
            // Add a vote to some cards to test full cascade
            if (i % 2 === 0) {
              seedVote(board.id, card.id);
            }
          }

          const service = createRetroService();

          // Delete the lane
          await service.deleteLane(laneToDelete.id);

          // Lane should be gone
          expect(store.retroLanes.some((l) => l.id === laneToDelete.id)).toBe(false);

          // All associated cards should be gone
          for (const cardId of cardIds) {
            expect(store.retroCards.some((c) => c.id === cardId)).toBe(false);
          }

          // Votes on those cards should also be gone
          for (const cardId of cardIds) {
            expect(store.retroVotes.some((v) => v.cardId === cardId)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 10: Lane reorder preserves correct display order ──────────────

/**
 * For any valid permutation of a board's lane IDs passed to reorderLanes,
 * reading the board back SHALL return lanes with `displayOrder` values matching
 * the input array index positions.
 *
 * Feature: retro-enhancements-phase-2b, Property 10: Lane reorder preserves correct display order
 * **Validates: Requirements 6.6**
 */
describe('Feature: retro-enhancements-phase-2b, Property 10: Lane reorder preserves correct display order', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('permutation maps to displayOrder indices', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 8 }),
        async (laneCount) => {
          store = createMockStore();
          const board = seedBoard();

          // Seed lanes
          const lanes: any[] = [];
          for (let i = 0; i < laneCount; i++) {
            lanes.push(seedLane(board.id, { title: `Lane ${i}`, displayOrder: i }));
          }

          // Generate a random permutation of lane IDs
          const laneIds = lanes.map((l) => l.id);
          // Fisher-Yates shuffle using a deterministic seed from the lane IDs
          const shuffled = [...laneIds];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }

          const service = createRetroService();

          // Reorder with the shuffled permutation
          await service.reorderLanes(board.id, { laneIds: shuffled });

          // Verify displayOrder matches index position in the input array
          for (let i = 0; i < shuffled.length; i++) {
            const lane = store.retroLanes.find((l) => l.id === shuffled[i]);
            expect(lane).toBeDefined();
            expect(lane!.displayOrder).toBe(i);
          }

          // Also verify via getBoard that lanes come back in correct order
          const boardView = await service.getBoard(board.pollId, { role: 'facilitator' });
          for (let i = 0; i < boardView.lanes.length; i++) {
            expect(boardView.lanes[i].displayOrder).toBe(i);
            expect(boardView.lanes[i].id).toBe(shuffled[i]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
