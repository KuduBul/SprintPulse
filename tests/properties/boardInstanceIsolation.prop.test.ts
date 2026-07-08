import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: retro-enhancements-phase-2b, Property 11: Board instance isolation
 *
 * For any two boards created from the same template, modifying lanes (add, edit,
 * remove, reorder) on board A SHALL leave board B's lanes completely unchanged,
 * and the template registry SHALL remain unmodified.
 *
 * **Validates: Requirements 6.9, 13.1, 13.2, 13.3**
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
      // Check for `in` operator
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

/** Generates a valid lane title (1–100 chars, non-whitespace-only). */
const laneTitleArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/** Generates an emoji-like string for lane icon. */
const laneIconArb = fc.constantFrom('🎯', '🔥', '💡', '🚀', '⭐', '✨', '🎉', '💪');

/** Generates a CSS hex color. */
const laneColorArb = fc.hexaString({ minLength: 6, maxLength: 6 }).map((h) => `#${h}`);

/**
 * Represents a mutation operation to perform on board A.
 */
type LaneMutation =
  | { type: 'add'; title: string; icon: string; color: string }
  | { type: 'update'; title: string; icon: string; color: string }
  | { type: 'reorder' }
  | { type: 'delete' };

const addMutationArb: fc.Arbitrary<LaneMutation> = fc.record({
  type: fc.constant('add' as const),
  title: laneTitleArb,
  icon: laneIconArb,
  color: laneColorArb,
});

const updateMutationArb: fc.Arbitrary<LaneMutation> = fc.record({
  type: fc.constant('update' as const),
  title: laneTitleArb,
  icon: laneIconArb,
  color: laneColorArb,
});

const reorderMutationArb: fc.Arbitrary<LaneMutation> = fc.constant({ type: 'reorder' as const });

const deleteMutationArb: fc.Arbitrary<LaneMutation> = fc.constant({ type: 'delete' as const });

/** Generate a sequence of 1–5 mutations to apply to board A. */
const mutationSeqArb = fc.array(
  fc.oneof(addMutationArb, updateMutationArb, reorderMutationArb, deleteMutationArb),
  { minLength: 1, maxLength: 5 },
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Deep-clones a lane snapshot for comparison. */
function snapshotLanes(boardId: string): { id: string; title: string; displayOrder: number; icon: string | null; color: string | null }[] {
  return store.retroLanes
    .filter((l) => l.boardId === boardId)
    .map((l) => ({
      id: l.id,
      title: l.title,
      displayOrder: l.displayOrder,
      icon: l.icon ?? null,
      color: l.color ?? null,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/** Deep-clones the template registry snapshot for comparison. */
function snapshotTemplates() {
  return BUILT_IN_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    columns: t.columns.map((c) => ({ ...c })),
  }));
}

// ─── Property 11: Board instance isolation ───────────────────────────────────

describe('Feature: retro-enhancements-phase-2b, Property 11: Board instance isolation', () => {
  beforeEach(() => {
    store = createMockStore();
  });

  it('modifying lanes on board A leaves board B lanes completely unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(templateIdArb, mutationSeqArb, async (templateId, mutations) => {
        // Fresh store for each run
        store = createMockStore();
        const service = createRetroService();

        // Create two boards from the same template
        const pollIdA = crypto.randomUUID();
        const pollIdB = crypto.randomUUID();

        const boardA = await service.createBoard(pollIdA, {
          template: templateId as any,
          createdBy: 'facilitator-a',
        });
        const boardB = await service.createBoard(pollIdB, {
          template: templateId as any,
          createdBy: 'facilitator-b',
        });

        // Snapshot board B's lanes BEFORE mutations to board A
        const boardBLanesBefore = snapshotLanes(boardB.id);

        // Apply mutations to board A
        for (const mutation of mutations) {
          const boardALanes = store.retroLanes.filter((l) => l.boardId === boardA.id);
          const laneCount = boardALanes.length;

          switch (mutation.type) {
            case 'add': {
              if (laneCount < 8) {
                await service.addLane(boardA.id, {
                  title: mutation.title,
                  icon: mutation.icon,
                  color: mutation.color,
                });
              }
              break;
            }
            case 'update': {
              if (laneCount > 0) {
                const targetLane = boardALanes[0];
                await service.updateLane(targetLane.id, {
                  title: mutation.title,
                  icon: mutation.icon,
                  color: mutation.color,
                });
              }
              break;
            }
            case 'reorder': {
              if (laneCount > 1) {
                // Reverse the lane order as a reorder operation
                const laneIds = boardALanes
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((l) => l.id)
                  .reverse();
                await service.reorderLanes(boardA.id, { laneIds });
              }
              break;
            }
            case 'delete': {
              if (laneCount > 1) {
                // Delete the last lane (safe — not the only one)
                const sorted = boardALanes.sort((a, b) => a.displayOrder - b.displayOrder);
                await service.deleteLane(sorted[sorted.length - 1].id);
              }
              break;
            }
          }
        }

        // Snapshot board B's lanes AFTER mutations to board A
        const boardBLanesAfter = snapshotLanes(boardB.id);

        // Board B's lanes must be completely unchanged
        expect(boardBLanesAfter).toEqual(boardBLanesBefore);
      }),
      { numRuns: 100 },
    );
  });

  it('modifying lanes on board A leaves the template registry unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(templateIdArb, mutationSeqArb, async (templateId, mutations) => {
        // Fresh store for each run
        store = createMockStore();
        const service = createRetroService();

        // Snapshot template registry BEFORE any mutations
        const templatesBefore = snapshotTemplates();

        // Create a board from the template
        const pollId = crypto.randomUUID();
        const board = await service.createBoard(pollId, {
          template: templateId as any,
          createdBy: 'facilitator',
        });

        // Apply mutations to the board
        for (const mutation of mutations) {
          const boardLanes = store.retroLanes.filter((l) => l.boardId === board.id);
          const laneCount = boardLanes.length;

          switch (mutation.type) {
            case 'add': {
              if (laneCount < 8) {
                await service.addLane(board.id, {
                  title: mutation.title,
                  icon: mutation.icon,
                  color: mutation.color,
                });
              }
              break;
            }
            case 'update': {
              if (laneCount > 0) {
                const targetLane = boardLanes[0];
                await service.updateLane(targetLane.id, {
                  title: mutation.title,
                  icon: mutation.icon,
                  color: mutation.color,
                });
              }
              break;
            }
            case 'reorder': {
              if (laneCount > 1) {
                const laneIds = boardLanes
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((l) => l.id)
                  .reverse();
                await service.reorderLanes(board.id, { laneIds });
              }
              break;
            }
            case 'delete': {
              if (laneCount > 1) {
                const sorted = boardLanes.sort((a, b) => a.displayOrder - b.displayOrder);
                await service.deleteLane(sorted[sorted.length - 1].id);
              }
              break;
            }
          }
        }

        // Template registry must remain unchanged
        const templatesAfter = snapshotTemplates();
        expect(templatesAfter).toEqual(templatesBefore);

        // Additionally verify the specific template is still accessible and unchanged
        const template = getTemplateById(templateId);
        const originalTemplate = templatesBefore.find((t) => t.id === templateId);
        expect(template).toBeDefined();
        expect(template!.id).toBe(originalTemplate!.id);
        expect(template!.name).toBe(originalTemplate!.name);
        expect(template!.columns).toEqual(originalTemplate!.columns);
      }),
      { numRuns: 100 },
    );
  });

  it('a new board from the same template gets original template config regardless of prior board mutations', async () => {
    await fc.assert(
      fc.asyncProperty(templateIdArb, mutationSeqArb, async (templateId, mutations) => {
        // Fresh store for each run
        store = createMockStore();
        const service = createRetroService();

        // Get expected template columns
        const template = getTemplateById(templateId)!;
        const expectedColumns = template.columns;

        // Create board A and apply mutations
        const pollIdA = crypto.randomUUID();
        const boardA = await service.createBoard(pollIdA, {
          template: templateId as any,
          createdBy: 'facilitator-a',
        });

        // Apply mutations to board A
        for (const mutation of mutations) {
          const boardALanes = store.retroLanes.filter((l) => l.boardId === boardA.id);
          const laneCount = boardALanes.length;

          switch (mutation.type) {
            case 'add': {
              if (laneCount < 8) {
                await service.addLane(boardA.id, {
                  title: mutation.title,
                  icon: mutation.icon,
                  color: mutation.color,
                });
              }
              break;
            }
            case 'update': {
              if (laneCount > 0) {
                await service.updateLane(boardALanes[0].id, {
                  title: mutation.title,
                  icon: mutation.icon,
                  color: mutation.color,
                });
              }
              break;
            }
            case 'reorder': {
              if (laneCount > 1) {
                const laneIds = boardALanes
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((l) => l.id)
                  .reverse();
                await service.reorderLanes(boardA.id, { laneIds });
              }
              break;
            }
            case 'delete': {
              if (laneCount > 1) {
                const sorted = boardALanes.sort((a, b) => a.displayOrder - b.displayOrder);
                await service.deleteLane(sorted[sorted.length - 1].id);
              }
              break;
            }
          }
        }

        // Create a NEW board from the same template AFTER mutations to board A
        const pollIdC = crypto.randomUUID();
        const boardC = await service.createBoard(pollIdC, {
          template: templateId as any,
          createdBy: 'facilitator-c',
        });

        // Board C should have the original template columns — unaffected by board A mutations
        const boardCLanes = store.retroLanes
          .filter((l) => l.boardId === boardC.id)
          .sort((a, b) => a.displayOrder - b.displayOrder);

        expect(boardCLanes.length).toBe(expectedColumns.length);
        for (let i = 0; i < expectedColumns.length; i++) {
          expect(boardCLanes[i].title).toBe(expectedColumns[i].title);
          expect(boardCLanes[i].icon).toBe(expectedColumns[i].icon);
          expect(boardCLanes[i].color).toBe(expectedColumns[i].color);
          expect(boardCLanes[i].displayOrder).toBe(i);
        }
      }),
      { numRuns: 100 },
    );
  });
});
