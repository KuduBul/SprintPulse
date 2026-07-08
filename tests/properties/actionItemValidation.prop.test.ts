import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: retro-enhancements-phase-2b
 * Properties 12, 13, 14: Action Item Validation
 *
 * Property 12: Action item phase gate — addActionItem succeeds in vote/closed, fails in gather
 * Property 13: Action item text validation — accepts 1–500 char trimmed text, rejects empty/whitespace/over-500
 * Property 14: Action item owner length validation — accepts ≤100 chars, rejects >100 chars
 *
 * **Validates: Requirements 7.1, 7.2, 7.3**
 */

// ─── In-memory mock store ────────────────────────────────────────────────────

interface MockStore {
  retroBoards: any[];
  retroLanes: any[];
  retroCards: any[];
  retroVotes: any[];
  retroActionItems: any[];
  auditLogs: any[];
  polls: any[];
}

let store: MockStore;

function createMockStore(): MockStore {
  return {
    retroBoards: [],
    retroLanes: [],
    retroCards: [],
    retroVotes: [],
    retroActionItems: [],
    auditLogs: [],
    polls: [],
  };
}

function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((c: any) => matches(row, c));
    if (key === 'OR') return (Array.isArray(value) ? value : [value]).some((c: any) => matches(row, c));
    if (key === 'NOT') return !matches(row, value);
    if (value !== null && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
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

function makeTable(getArr: () => any[]) {
  return {
    findUnique: vi.fn(async ({ where }: any) => getArr().find((r) => matches(r, where)) ?? null),
    findFirst: vi.fn(async ({ where }: any) => getArr().find((r) => matches(r, where)) ?? null),
    findMany: vi.fn(async ({ where, orderBy }: any = {}) => sortRows(getArr().filter((r) => matches(r, where)), orderBy)),
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

// Mock prisma client
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

// Mock the audit logger
vi.mock('@/lib/services/auditLogger', () => ({
  auditLogger: { log: vi.fn(async () => {}) },
  createAuditLogger: vi.fn(() => ({ log: vi.fn(async () => {}) })),
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

/** Phases where action items ARE allowed */
const allowedPhaseArb = fc.constantFrom<'vote' | 'closed'>('vote', 'closed');

/** All phases */
const phaseArb = fc.constantFrom<'gather' | 'vote' | 'closed'>('gather', 'vote', 'closed');

/** Generates valid action item text: trimmed length 1–500 */
const validTextArb = fc.string({ minLength: 1, maxLength: 500 }).filter((s) => s.trim().length >= 1 && s.trim().length <= 500);

/** Generates text that is empty or whitespace-only after trimming */
const emptyOrWhitespaceTextArb = fc.constantFrom('', ' ', '  ', '\t', '\n', '  \t\n  ');

/** Generates text that exceeds 500 characters after trimming */
const overLengthTextArb = fc.string({ minLength: 501, maxLength: 700 }).filter((s) => s.trim().length > 500);

/** Generates a valid owner string (≤100 chars) */
const validOwnerArb = fc.string({ minLength: 0, maxLength: 100 });

/** Generates an owner string that exceeds 100 characters */
const overLengthOwnerArb = fc.string({ minLength: 101, maxLength: 200 });

// ─── Property 12: Action item phase gate ─────────────────────────────────────

/**
 * Feature: retro-enhancements-phase-2b, Property 12: Action item phase gate
 *
 * For any board in phase "vote" or "closed", addActionItem with valid input SHALL succeed.
 * For any board in phase "gather", addActionItem SHALL fail with a phase error.
 *
 * **Validates: Requirements 7.1**
 */
describe('Feature: retro-enhancements-phase-2b, Property 12: Action item phase gate', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('addActionItem succeeds in vote or closed phase with valid input', async () => {
    await fc.assert(
      fc.asyncProperty(allowedPhaseArb, validTextArb, async (phase, text) => {
        store = createMockStore();
        const board = seedBoard({ phase });

        const service = createRetroService();
        const result = await runOp(() =>
          service.addActionItem(board.id, { text }),
        );

        expect(result.ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('addActionItem fails with WRONG_PHASE error in gather phase', async () => {
    await fc.assert(
      fc.asyncProperty(validTextArb, async (text) => {
        store = createMockStore();
        const board = seedBoard({ phase: 'gather' });

        const service = createRetroService();
        const result = await runOp(() =>
          service.addActionItem(board.id, { text }),
        );

        expect(result.ok).toBe(false);
        expect(result.error?.code).toBe('WRONG_PHASE');
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 13: Action item text validation ────────────────────────────────

/**
 * Feature: retro-enhancements-phase-2b, Property 13: Action item text validation
 *
 * For any string input, addActionItem SHALL accept it if and only if the trimmed text
 * length is between 1 and 500 characters (inclusive). Strings that are empty,
 * whitespace-only, or exceed 500 characters after trimming SHALL be rejected.
 *
 * **Validates: Requirements 7.2**
 */
describe('Feature: retro-enhancements-phase-2b, Property 13: Action item text validation', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('accepts trimmed text with length between 1 and 500 characters', async () => {
    await fc.assert(
      fc.asyncProperty(validTextArb, async (text) => {
        store = createMockStore();
        const board = seedBoard({ phase: 'vote' });

        const service = createRetroService();
        const result = await runOp(() =>
          service.addActionItem(board.id, { text }),
        );

        expect(result.ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('rejects empty or whitespace-only text with VALIDATION_ERROR', async () => {
    await fc.assert(
      fc.asyncProperty(emptyOrWhitespaceTextArb, async (text) => {
        store = createMockStore();
        const board = seedBoard({ phase: 'vote' });

        const service = createRetroService();
        const result = await runOp(() =>
          service.addActionItem(board.id, { text }),
        );

        expect(result.ok).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_ERROR');
      }),
      { numRuns: 100 },
    );
  });

  it('rejects text exceeding 500 characters after trimming with VALIDATION_ERROR', async () => {
    await fc.assert(
      fc.asyncProperty(overLengthTextArb, async (text) => {
        store = createMockStore();
        const board = seedBoard({ phase: 'vote' });

        const service = createRetroService();
        const result = await runOp(() =>
          service.addActionItem(board.id, { text }),
        );

        expect(result.ok).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_ERROR');
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 14: Action item owner length validation ────────────────────────

/**
 * Feature: retro-enhancements-phase-2b, Property 14: Action item owner length validation
 *
 * For any owner string provided to addActionItem, the system SHALL accept it if and only
 * if its length is at most 100 characters. Strings exceeding 100 characters SHALL be rejected.
 *
 * **Validates: Requirements 7.3**
 */
describe('Feature: retro-enhancements-phase-2b, Property 14: Action item owner length validation', () => {
  beforeEach(() => {
    store = createMockStore();
    vi.clearAllMocks();
  });

  it('accepts owner strings with length at most 100 characters', async () => {
    await fc.assert(
      fc.asyncProperty(validTextArb, validOwnerArb, async (text, owner) => {
        store = createMockStore();
        const board = seedBoard({ phase: 'vote' });

        const service = createRetroService();
        const result = await runOp(() =>
          service.addActionItem(board.id, { text, owner }),
        );

        expect(result.ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('rejects owner strings exceeding 100 characters with VALIDATION_ERROR', async () => {
    await fc.assert(
      fc.asyncProperty(validTextArb, overLengthOwnerArb, async (text, owner) => {
        store = createMockStore();
        const board = seedBoard({ phase: 'vote' });

        const service = createRetroService();
        const result = await runOp(() =>
          service.addActionItem(board.id, { text, owner }),
        );

        expect(result.ok).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_ERROR');
      }),
      { numRuns: 100 },
    );
  });
});
