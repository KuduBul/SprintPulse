import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: retro-enhancements-phase-2b
 * Property 4: Lane count minimum enforcement
 * Property 5: Lane count maximum enforcement
 *
 * Property 4: For any board with exactly 1 lane, attempting to delete that lane
 * SHALL fail with a validation error (MIN_LANES_REQUIRED), ensuring the board
 * always has at least 1 lane.
 *
 * Property 5: For any board with exactly 8 lanes, attempting to add another lane
 * SHALL fail with a validation error (LANE_LIMIT_EXCEEDED), ensuring the board
 * never exceeds 8 lanes.
 *
 * **Validates: Requirements 5.3, 5.4, 6.7, 6.8**
 */

// ─── In-memory mock store ────────────────────────────────────────────────────

interface MockStore {
  retroBoards: any[];
  retroLanes: any[];
  retroCards: any[];
  retroVotes: any[];
  retroActionItems: any[];
  polls: any[];
  auditLogs: any[];
}

let store: MockStore;

function createMockStore(): MockStore {
  return {
    retroBoards: [],
    retroLanes: [],
    retroCards: [],
    retroVotes: [],
    retroActionItems: [],
    polls: [],
    auditLogs: [],
  };
}

/**
 * Minimal Prisma-style `where` matcher. Supports scalar equality and nested
 * composite keys, plus `in` operator for array containment.
 */
function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((c) => matches(row, c));
    if (key === 'OR') return (Array.isArray(value) ? value : [value]).some((c) => matches(row, c));
    if (key === 'NOT') return !matches(row, value);
    if (value !== null && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      // Check for Prisma `in` operator
      if ('in' in (value as any)) {
        return (value as any).in.includes(row[key]);
      }
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
 * Builds a standard Prisma-style delegate over a backing array.
 */
function makeTable(getArr: () => any[]) {
  return {
    findUnique: vi.fn(async ({ where }: any) => getArr().find((r) => matches(r, where)) ?? null),
    findFirst: vi.fn(async ({ where }: any) => getArr().find((r) => matches(r, where)) ?? null),
    findMany: vi.fn(async ({ where, orderBy, select }: any = {}) => {
      const filtered = getArr().filter((r) => matches(r, where));
      const sorted = sortRows(filtered, orderBy);
      if (select) {
        return sorted.map((r) => {
          const result: any = {};
          for (const key of Object.keys(select)) {
            if (select[key]) result[key] = r[key];
          }
          return result;
        });
      }
      return sorted;
    }),
    create: vi.fn(async ({ data }: any) => {
      const arr = getArr();
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

// Mock the prisma client with the retro tables.
vi.mock('@/lib/db/client', () => {
  const buildTables = () => ({
    poll: makeTable(() => store.polls),
    auditLog: makeTable(() => store.auditLogs),
    retroBoard: makeTable(() => store.retroBoards),
    retroLane: makeTable(() => store.retroLanes),
    retroCard: makeTable(() => store.retroCards),
    retroVote: makeTable(() => store.retroVotes),
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

// Mock the audit logger.
vi.mock('@/lib/services/auditLogger', () => ({
  auditLogger: { log: vi.fn(async () => {}) },
  createAuditLogger: vi.fn(() => ({ log: vi.fn(async () => {}) })),
}));

// Mock the PDF export service (not needed for lane tests but required by import).
vi.mock('@/lib/retro/pdfExportService', () => ({
  generateRetroPdf: vi.fn(async () => Buffer.from('mock-pdf')),
}));

import { createRetroService } from '@/lib/services/retroService';

// ─── Seed helpers ────────────────────────────────────────────────────────────

function seedBoard(opts: { phase?: 'gather' | 'vote' | 'closed' } = {}): any {
  const board = {
    id: crypto.randomUUID(),
    pollId: crypto.randomUUID(),
    template: 'start_stop_continue',
    phase: opts.phase ?? 'gather',
    votesPerUser: 3,
    backgroundImage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.retroBoards.push(board);
  return board;
}

function seedLane(boardId: string, opts: { displayOrder?: number; title?: string; icon?: string; color?: string } = {}): any {
  const lane = {
    id: crypto.randomUUID(),
    boardId,
    title: opts.title ?? `Lane ${store.retroLanes.length + 1}`,
    displayOrder: opts.displayOrder ?? store.retroLanes.filter((l) => l.boardId === boardId).length,
    position: null,
    icon: opts.icon ?? null,
    color: opts.color ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.retroLanes.push(lane);
  return lane;
}

/** Runs an async op and reports whether it resolved or rejected. */
async function runOp(fn: () => Promise<unknown>): Promise<{ ok: boolean; error?: any }> {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a valid lane title (non-empty, ≤100 chars). */
const laneTitleArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length >= 1);

/** Generates an optional emoji icon. */
const laneIconArb = fc.constantFrom('🚀', '🛑', '✅', '❤️', '📚', '⭐', '😡', '💨', undefined);

/** Generates an optional CSS hex color. */
const laneColorArb = fc.constantFrom('#4CAF50', '#F44336', '#2196F3', '#E91E63', '#9C27B0', undefined);

// ─── Property 4: Lane count minimum enforcement ──────────────────────────────

describe('Feature: retro-enhancements-phase-2b, Property 4: Lane count minimum enforcement', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('deleting the last lane on a board with exactly 1 lane fails with MIN_LANES_REQUIRED', async () => {
    await fc.assert(
      fc.asyncProperty(
        laneTitleArb,
        laneIconArb,
        laneColorArb,
        async (title, icon, color) => {
          store = createMockStore();
          const board = seedBoard();
          const lane = seedLane(board.id, { title, icon, color });

          const service = createRetroService();
          const result = await runOp(() => service.deleteLane(lane.id));

          // Deletion MUST fail
          expect(result.ok).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error.code).toBe('MIN_LANES_REQUIRED');

          // The lane must still exist in the store
          expect(store.retroLanes.some((l: any) => l.id === lane.id)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('the board always retains at least 1 lane after a rejected deletion attempt', async () => {
    await fc.assert(
      fc.asyncProperty(
        laneTitleArb,
        async (title) => {
          store = createMockStore();
          const board = seedBoard();
          seedLane(board.id, { title });

          const service = createRetroService();
          await runOp(() => service.deleteLane(store.retroLanes[0].id));

          // Board must still have at least 1 lane
          const boardLanes = store.retroLanes.filter((l: any) => l.boardId === board.id);
          expect(boardLanes.length).toBeGreaterThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 5: Lane count maximum enforcement ──────────────────────────────

describe('Feature: retro-enhancements-phase-2b, Property 5: Lane count maximum enforcement', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('adding a lane to a board with exactly 8 lanes fails with LANE_LIMIT_EXCEEDED', async () => {
    await fc.assert(
      fc.asyncProperty(
        laneTitleArb,
        laneIconArb,
        laneColorArb,
        async (newTitle, newIcon, newColor) => {
          store = createMockStore();
          const board = seedBoard();

          // Seed exactly 8 lanes
          for (let i = 0; i < 8; i++) {
            seedLane(board.id, { title: `Lane ${i + 1}`, displayOrder: i });
          }

          const service = createRetroService();
          const input: any = { title: newTitle };
          if (newIcon !== undefined) input.icon = newIcon;
          if (newColor !== undefined) input.color = newColor;

          const result = await runOp(() => service.addLane(board.id, input));

          // Addition MUST fail
          expect(result.ok).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error.code).toBe('LANE_LIMIT_EXCEEDED');

          // The board must still have exactly 8 lanes (not 9)
          const boardLanes = store.retroLanes.filter((l: any) => l.boardId === board.id);
          expect(boardLanes.length).toBe(8);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('the board never exceeds 8 lanes after a rejected addition attempt', async () => {
    await fc.assert(
      fc.asyncProperty(
        laneTitleArb,
        async (newTitle) => {
          store = createMockStore();
          const board = seedBoard();

          // Seed exactly 8 lanes
          for (let i = 0; i < 8; i++) {
            seedLane(board.id, { title: `Lane ${i + 1}`, displayOrder: i });
          }

          const service = createRetroService();
          await runOp(() => service.addLane(board.id, { title: newTitle }));

          // Board must never have more than 8 lanes
          const boardLanes = store.retroLanes.filter((l: any) => l.boardId === board.id);
          expect(boardLanes.length).toBeLessThanOrEqual(8);
        },
      ),
      { numRuns: 100 },
    );
  });
});
