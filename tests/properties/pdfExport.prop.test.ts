import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: retro-enhancements-phase-2b
 *
 * Property 15: PDF content completeness — generated PDF contains all lane titles, card texts,
 *   vote counts, and action items
 * Property 16: PDF card ordering by votes — cards within each lane are ordered by descending
 *   vote count
 *
 * **Validates: Requirements 8.2, 8.4, 8.5, 8.6**
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
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const [[field, dir]] = Object.entries(order) as [string, 'asc' | 'desc'][];
      if (a[field] < b[field]) return dir === 'desc' ? 1 : -1;
      if (a[field] > b[field]) return dir === 'desc' ? -1 : 1;
    }
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

// Capture the PdfExportData passed to generateRetroPdf
let capturedPdfData: any = null;

vi.mock('@/lib/retro/pdfExportService', () => ({
  generateRetroPdf: vi.fn(async (data: any) => {
    capturedPdfData = data;
    // Return a valid PDF-like buffer (starts with %PDF magic bytes)
    const header = Buffer.from('%PDF-1.4\n');
    const body = Buffer.from(JSON.stringify(data));
    return Buffer.concat([header, body]);
  }),
}));

import { createRetroService } from '@/lib/services/retroService';

// ─── Seed helpers ────────────────────────────────────────────────────────────

function seedBoardWithData(opts: {
  laneCount: number;
  cardsPerLane: number[];
  actionItemCount: number;
  laneData?: Array<{ title: string; icon: string | null; color: string | null }>;
  cardData?: Array<Array<{ text: string; authorName: string }>>;
  actionItemData?: Array<{ text: string; owner: string | null; dueDate: Date | null }>;
  votesPerCard?: Map<string, number>;
}): { boardId: string; pollId: string } {
  const boardId = crypto.randomUUID();
  const pollId = crypto.randomUUID();

  // Create poll
  store.polls.push({
    id: pollId,
    title: `Board Title ${boardId.slice(0, 8)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Create board
  store.retroBoards.push({
    id: boardId,
    pollId,
    template: 'start_stop_continue',
    phase: 'closed',
    votesPerUser: 3,
    backgroundImage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Create lanes
  for (let i = 0; i < opts.laneCount; i++) {
    const laneId = crypto.randomUUID();
    const laneInfo = opts.laneData?.[i];
    store.retroLanes.push({
      id: laneId,
      boardId,
      title: laneInfo?.title ?? `Lane ${i}`,
      displayOrder: i,
      position: null,
      icon: laneInfo?.icon ?? null,
      color: laneInfo?.color ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create cards for this lane
    const cardCount = opts.cardsPerLane[i] ?? 0;
    for (let j = 0; j < cardCount; j++) {
      const cardId = crypto.randomUUID();
      const cardInfo = opts.cardData?.[i]?.[j];
      store.retroCards.push({
        id: cardId,
        boardId,
        laneId,
        text: cardInfo?.text ?? `Card ${i}-${j}`,
        authorName: cardInfo?.authorName ?? `Author ${j}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create votes for this card
      const voteCount = opts.votesPerCard?.get(cardId) ?? 0;
      for (let v = 0; v < voteCount; v++) {
        store.retroVotes.push({
          id: crypto.randomUUID(),
          boardId,
          cardId,
          participantId: crypto.randomUUID(),
          createdAt: new Date(),
        });
      }
    }
  }

  // Create action items
  for (let i = 0; i < opts.actionItemCount; i++) {
    const aiInfo = opts.actionItemData?.[i];
    store.retroActionItems.push({
      id: crypto.randomUUID(),
      boardId,
      text: aiInfo?.text ?? `Action Item ${i}`,
      owner: aiInfo?.owner ?? null,
      dueDate: aiInfo?.dueDate ?? null,
      createdAt: new Date(Date.now() + i * 1000), // Sequential creation for ordering
    });
  }

  return { boardId, pollId };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a non-empty lane title (printable ASCII for easier verification) */
const laneTitleArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/** Generates an emoji icon or null */
const iconArb = fc.oneof(
  fc.constant(null),
  fc.constantFrom('🚀', '🛑', '✅', '❤️', '📚', '😡', '😢', '😊', '💨', '⚓', '🪨', '🏝️', '⭐'),
);

/** Generates a CSS color or null */
const colorArb = fc.oneof(
  fc.constant(null),
  fc.constantFrom('#4CAF50', '#F44336', '#2196F3', '#E91E63', '#9C27B0', '#FF9800', '#FFC107'),
);

/** Generates a non-empty card text */
const cardTextArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

/** Generates an author name */
const authorNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/** Generates a vote count (0–20) */
const voteCountArb = fc.integer({ min: 0, max: 20 });

/** Generates action item text */
const actionItemTextArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

/** Generates an optional owner */
const ownerArb = fc.oneof(
  fc.constant(null),
  fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
);

/** Generates an optional due date as ISO string */
const dueDateArb = fc.oneof(
  fc.constant(null),
  fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
);

/** Generates a card definition with text, author, and vote count */
const cardDefArb = fc.record({
  text: cardTextArb,
  authorName: authorNameArb,
  voteCount: voteCountArb,
});

/** Generates a lane definition with title, icon, color, and cards */
const laneDefArb = fc.record({
  title: laneTitleArb,
  icon: iconArb,
  color: colorArb,
  cards: fc.array(cardDefArb, { minLength: 0, maxLength: 5 }),
});

/** Generates an action item definition */
const actionItemDefArb = fc.record({
  text: actionItemTextArb,
  owner: ownerArb,
  dueDate: dueDateArb,
});

/** Generates a complete board definition for PDF export */
const boardDefArb = fc.record({
  lanes: fc.array(laneDefArb, { minLength: 1, maxLength: 6 }),
  actionItems: fc.array(actionItemDefArb, { minLength: 0, maxLength: 5 }),
});

// ─── Property 15: PDF content completeness ───────────────────────────────────

/**
 * Feature: retro-enhancements-phase-2b, Property 15: PDF content completeness
 *
 * For any board with lanes, cards, and action items, the generated PDF document
 * SHALL contain all lane titles (including icons), all card texts, vote counts
 * for each card, and all action item texts with their assignees and due dates.
 *
 * We test this by calling exportBoardPdf and inspecting the PdfExportData
 * captured from the mocked generateRetroPdf call — verifying the data assembly
 * is complete and correct.
 *
 * **Validates: Requirements 8.2, 8.4, 8.5, 8.6**
 */
describe('Feature: retro-enhancements-phase-2b, Property 15: PDF content completeness', () => {
  beforeEach(() => {
    store = createMockStore();
    capturedPdfData = null;
    vi.clearAllMocks();
  });

  it('exported PDF data contains all lane titles and icons from the board', async () => {
    await fc.assert(
      fc.asyncProperty(boardDefArb, async (boardDef) => {
        store = createMockStore();
        capturedPdfData = null;

        // Seed the board with the generated lanes
        const boardId = crypto.randomUUID();
        const pollId = crypto.randomUUID();

        store.polls.push({
          id: pollId,
          title: `Test Board`,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        store.retroBoards.push({
          id: boardId,
          pollId,
          template: 'start_stop_continue',
          phase: 'closed',
          votesPerUser: 3,
          backgroundImage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Seed lanes with their data
        for (let i = 0; i < boardDef.lanes.length; i++) {
          const lane = boardDef.lanes[i];
          const laneId = crypto.randomUUID();
          store.retroLanes.push({
            id: laneId,
            boardId,
            title: lane.title,
            displayOrder: i,
            position: null,
            icon: lane.icon,
            color: lane.color,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Seed cards for this lane
          for (const card of lane.cards) {
            const cardId = crypto.randomUUID();
            store.retroCards.push({
              id: cardId,
              boardId,
              laneId,
              text: card.text,
              authorName: card.authorName,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            // Seed votes for this card
            for (let v = 0; v < card.voteCount; v++) {
              store.retroVotes.push({
                id: crypto.randomUUID(),
                boardId,
                cardId,
                participantId: crypto.randomUUID(),
                createdAt: new Date(),
              });
            }
          }
        }

        // Seed action items
        for (let i = 0; i < boardDef.actionItems.length; i++) {
          const ai = boardDef.actionItems[i];
          store.retroActionItems.push({
            id: crypto.randomUUID(),
            boardId,
            text: ai.text,
            owner: ai.owner,
            dueDate: ai.dueDate,
            createdAt: new Date(Date.now() + i * 1000),
          });
        }

        // Export PDF
        const service = createRetroService();
        await service.exportBoardPdf(boardId);

        // Verify captured data contains ALL lane titles
        expect(capturedPdfData).not.toBeNull();
        expect(capturedPdfData.lanes).toHaveLength(boardDef.lanes.length);

        for (let i = 0; i < boardDef.lanes.length; i++) {
          const expectedLane = boardDef.lanes[i];
          const actualLane = capturedPdfData.lanes[i];

          // Lane title matches
          expect(actualLane.title).toBe(expectedLane.title);
          // Lane icon included
          expect(actualLane.icon).toBe(expectedLane.icon);
          // Lane color included
          expect(actualLane.color).toBe(expectedLane.color);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('exported PDF data contains all card texts and vote counts', async () => {
    await fc.assert(
      fc.asyncProperty(boardDefArb, async (boardDef) => {
        store = createMockStore();
        capturedPdfData = null;

        const boardId = crypto.randomUUID();
        const pollId = crypto.randomUUID();

        store.polls.push({
          id: pollId,
          title: `Test Board`,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        store.retroBoards.push({
          id: boardId,
          pollId,
          template: 'start_stop_continue',
          phase: 'closed',
          votesPerUser: 3,
          backgroundImage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        for (let i = 0; i < boardDef.lanes.length; i++) {
          const lane = boardDef.lanes[i];
          const laneId = crypto.randomUUID();
          store.retroLanes.push({
            id: laneId,
            boardId,
            title: lane.title,
            displayOrder: i,
            position: null,
            icon: lane.icon,
            color: lane.color,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          for (const card of lane.cards) {
            const cardId = crypto.randomUUID();
            store.retroCards.push({
              id: cardId,
              boardId,
              laneId,
              text: card.text,
              authorName: card.authorName,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            for (let v = 0; v < card.voteCount; v++) {
              store.retroVotes.push({
                id: crypto.randomUUID(),
                boardId,
                cardId,
                participantId: crypto.randomUUID(),
                createdAt: new Date(),
              });
            }
          }
        }

        for (let i = 0; i < boardDef.actionItems.length; i++) {
          const ai = boardDef.actionItems[i];
          store.retroActionItems.push({
            id: crypto.randomUUID(),
            boardId,
            text: ai.text,
            owner: ai.owner,
            dueDate: ai.dueDate,
            createdAt: new Date(Date.now() + i * 1000),
          });
        }

        const service = createRetroService();
        await service.exportBoardPdf(boardId);

        expect(capturedPdfData).not.toBeNull();

        // Verify all card texts and vote counts are present per lane
        for (let i = 0; i < boardDef.lanes.length; i++) {
          const expectedLane = boardDef.lanes[i];
          const actualLane = capturedPdfData.lanes[i];

          // All cards from the lane are present in the output
          expect(actualLane.cards).toHaveLength(expectedLane.cards.length);

          // Every card text and vote count from the input appears in the output
          const actualCardTexts = actualLane.cards.map((c: any) => c.text);
          const actualVoteCounts = actualLane.cards.map((c: any) => c.voteCount);

          for (const expectedCard of expectedLane.cards) {
            expect(actualCardTexts).toContain(expectedCard.text);
            expect(actualVoteCounts).toContain(expectedCard.voteCount);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('exported PDF data contains all action items with owners and due dates', async () => {
    await fc.assert(
      fc.asyncProperty(boardDefArb, async (boardDef) => {
        store = createMockStore();
        capturedPdfData = null;

        const boardId = crypto.randomUUID();
        const pollId = crypto.randomUUID();

        store.polls.push({
          id: pollId,
          title: `Test Board`,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        store.retroBoards.push({
          id: boardId,
          pollId,
          template: 'start_stop_continue',
          phase: 'closed',
          votesPerUser: 3,
          backgroundImage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Need at least one lane for a valid board
        const laneId = crypto.randomUUID();
        store.retroLanes.push({
          id: laneId,
          boardId,
          title: 'Default Lane',
          displayOrder: 0,
          position: null,
          icon: null,
          color: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Seed action items
        for (let i = 0; i < boardDef.actionItems.length; i++) {
          const ai = boardDef.actionItems[i];
          store.retroActionItems.push({
            id: crypto.randomUUID(),
            boardId,
            text: ai.text,
            owner: ai.owner,
            dueDate: ai.dueDate,
            createdAt: new Date(Date.now() + i * 1000),
          });
        }

        const service = createRetroService();
        await service.exportBoardPdf(boardId);

        expect(capturedPdfData).not.toBeNull();

        // Verify all action items are present
        expect(capturedPdfData.actionItems).toHaveLength(boardDef.actionItems.length);

        for (let i = 0; i < boardDef.actionItems.length; i++) {
          const expected = boardDef.actionItems[i];
          const actual = capturedPdfData.actionItems[i];

          // Text matches
          expect(actual.text).toBe(expected.text);
          // Owner matches
          expect(actual.owner).toBe(expected.owner);
          // Due date: if set, should be an ISO string representation of the date
          if (expected.dueDate) {
            expect(actual.dueDate).toBe(expected.dueDate.toISOString());
          } else {
            expect(actual.dueDate).toBeNull();
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 16: PDF card ordering by votes ─────────────────────────────────

/**
 * Feature: retro-enhancements-phase-2b, Property 16: PDF card ordering by votes
 *
 * For any lane containing multiple cards with different vote counts, the PDF SHALL list
 * those cards in descending vote count order.
 *
 * **Validates: Requirements 8.5**
 */
describe('Feature: retro-enhancements-phase-2b, Property 16: PDF card ordering by votes', () => {
  beforeEach(() => {
    store = createMockStore();
    capturedPdfData = null;
    vi.clearAllMocks();
  });

  it('cards within each lane are sorted by descending vote count in the PDF data', async () => {
    // Generate lanes where each lane has cards with distinct vote counts
    const laneWithDistinctVotesArb = fc.record({
      title: laneTitleArb,
      icon: iconArb,
      color: colorArb,
      cards: fc.array(
        fc.record({
          text: cardTextArb,
          authorName: authorNameArb,
          voteCount: voteCountArb,
        }),
        { minLength: 2, maxLength: 8 },
      ),
    });

    const multiLaneBoardArb = fc.array(laneWithDistinctVotesArb, { minLength: 1, maxLength: 4 });

    await fc.assert(
      fc.asyncProperty(multiLaneBoardArb, async (lanes) => {
        store = createMockStore();
        capturedPdfData = null;

        const boardId = crypto.randomUUID();
        const pollId = crypto.randomUUID();

        store.polls.push({
          id: pollId,
          title: `Test Board`,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        store.retroBoards.push({
          id: boardId,
          pollId,
          template: 'start_stop_continue',
          phase: 'closed',
          votesPerUser: 3,
          backgroundImage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Seed lanes and cards
        for (let i = 0; i < lanes.length; i++) {
          const lane = lanes[i];
          const laneId = crypto.randomUUID();
          store.retroLanes.push({
            id: laneId,
            boardId,
            title: lane.title,
            displayOrder: i,
            position: null,
            icon: lane.icon,
            color: lane.color,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          for (const card of lane.cards) {
            const cardId = crypto.randomUUID();
            store.retroCards.push({
              id: cardId,
              boardId,
              laneId,
              text: card.text,
              authorName: card.authorName,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            // Create votes for this card
            for (let v = 0; v < card.voteCount; v++) {
              store.retroVotes.push({
                id: crypto.randomUUID(),
                boardId,
                cardId,
                participantId: crypto.randomUUID(),
                createdAt: new Date(),
              });
            }
          }
        }

        const service = createRetroService();
        await service.exportBoardPdf(boardId);

        expect(capturedPdfData).not.toBeNull();

        // Verify cards in each lane are sorted by descending vote count
        for (const actualLane of capturedPdfData.lanes) {
          const cards = actualLane.cards;
          for (let j = 0; j < cards.length - 1; j++) {
            expect(cards[j].voteCount).toBeGreaterThanOrEqual(cards[j + 1].voteCount);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
