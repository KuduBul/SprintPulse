import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: retro-enhancements-phase-2b, Property 2: Template-to-lane creation round-trip
 *
 * For any built-in template selected during board creation, the resulting RetroLane
 * records SHALL have `icon` and `color` values matching the corresponding column
 * definitions in the template, preserving both the values and the display order.
 *
 * **Validates: Requirements 1.4, 2.4**
 */

// ─── In-memory mock store ────────────────────────────────────────────────────

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
 * Minimal Prisma-style `where` matcher supporting scalar equality, AND/OR/NOT,
 * composite-unique keys, and `in` operator for arrays.
 */
function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((c: any) => matches(row, c));
    if (key === 'OR') return (Array.isArray(value) ? value : [value]).some((c: any) => matches(row, c));
    if (key === 'NOT') return !matches(row, value);
    if (value !== null && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      if ('in' in value) {
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

// Mock Prisma client
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

// Mock audit logger
vi.mock('@/lib/services/auditLogger', () => ({
  auditLogger: { log: vi.fn(async () => {}) },
  createAuditLogger: vi.fn(() => ({ log: vi.fn(async () => {}) })),
}));

// Import after mocks
import { createRetroService } from '@/lib/services/retroService';
import { BUILT_IN_TEMPLATES, getTemplateById } from '@/lib/retro/templateRegistry';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Picks a random built-in template ID. */
const templateIdArb = fc.constantFrom(...BUILT_IN_TEMPLATES.map((t) => t.id));

/** Generates a random facilitator ID for board creation. */
const facilitatorArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0);

// ─── Property 2: Template-to-lane creation round-trip ────────────────────────

describe('Feature: retro-enhancements-phase-2b, Property 2: Template-to-lane creation round-trip', () => {
  beforeEach(() => {
    store = createMockStore();
  });

  it('selected template column icons/colors match resulting RetroLane records preserving values and display order', async () => {
    await fc.assert(
      fc.asyncProperty(templateIdArb, facilitatorArb, async (templateId, facilitator) => {
        // Fresh store for each run
        store = createMockStore();
        const service = createRetroService();

        // Get the expected template definition
        const template = getTemplateById(templateId)!;
        expect(template).toBeDefined();

        // Create a board using the selected template
        const pollId = crypto.randomUUID();
        const board = await service.createBoard(pollId, {
          template: templateId as any,
          createdBy: facilitator,
        });

        // Retrieve the created lanes sorted by displayOrder
        const createdLanes = store.retroLanes
          .filter((l) => l.boardId === board.id)
          .sort((a, b) => a.displayOrder - b.displayOrder);

        // The number of lanes must match the number of template columns
        expect(createdLanes.length).toBe(template.columns.length);

        // Each lane must match its corresponding template column definition
        for (let i = 0; i < template.columns.length; i++) {
          const expectedColumn = template.columns[i];
          const actualLane = createdLanes[i];

          // Icon value matches the template column icon
          expect(actualLane.icon).toBe(expectedColumn.icon);

          // Color value matches the template column color
          expect(actualLane.color).toBe(expectedColumn.color);

          // Title matches the template column title
          expect(actualLane.title).toBe(expectedColumn.title);

          // Display order matches the column index (preserving order)
          expect(actualLane.displayOrder).toBe(i);
        }
      }),
      { numRuns: 100 },
    );
  });
});
