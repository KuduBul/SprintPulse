import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Migration Preservation Tests — Retro Board Phase 2A
 *
 * Task 2.2: prove the Phase 2 schema change is ADDITIVE and pulse-safe.
 *
 * These tests deliberately DO NOT require a live database. The remote Supabase
 * instance is not reachable/touchable in this environment, so "migration
 * preservation" is verified at the levels the application controls:
 *
 *   1. Static analysis of the generated migration (prisma/add_retro_models.sql)
 *      proves the only change to a pre-existing table is a single defaulted
 *      `Poll.type` column, that `Question`/`Response` are never touched, and that
 *      the new Retro* tables are purely additive (Requirements 11.1, 11.2).
 *   2. A light check via the existing mocked-prisma pattern proves pulse poll
 *      creation does not set `type`, so the DB-level DEFAULT 'pulse' applies and
 *      existing pulse behavior is unchanged (Requirements 11.1, 11.3).
 *
 * **Validates: Requirements 11.1, 11.2, 11.3**
 */

// ─── Load the generated (not-yet-applied) migration SQL ──────────────────────
// Vitest runs from the project root, so process.cwd() resolves to the repo root.
const MIGRATION_PATH = path.resolve(process.cwd(), 'prisma/add_retro_models.sql');
const migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

/** Collect the table names targeted by every `ALTER TABLE "X"` statement. */
function alterTableTargets(sql: string): string[] {
  const regex = /ALTER\s+TABLE\s+"([^"]+)"/gi;
  const targets: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    targets.push(match[1]);
  }
  return targets;
}

/** Collect the table names created by every `CREATE TABLE "X"` statement. */
function createTableTargets(sql: string): string[] {
  const regex = /CREATE\s+TABLE\s+"([^"]+)"/gi;
  const targets: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    targets.push(match[1]);
  }
  return targets;
}

describe('Migration preservation: add_retro_models.sql is additive and pulse-safe', () => {
  describe('Requirement 11.1 — existing Poll rows read back as type "pulse"', () => {
    it('adds exactly one column to the pre-existing Poll table', () => {
      const pollAlters = alterTableTargets(migrationSql).filter((t) => t === 'Poll');
      // Only the additive `type` column ALTER — the remaining ALTER TABLEs are
      // AddForeignKey statements on the new Retro* tables.
      expect(pollAlters).toHaveLength(1);
    });

    it('the Poll change is ADD COLUMN "type" TEXT NOT NULL DEFAULT \'pulse\'', () => {
      const addTypeColumn =
        /ALTER\s+TABLE\s+"Poll"\s+ADD\s+COLUMN\s+"type"\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'pulse'/i;
      expect(migrationSql).toMatch(addTypeColumn);
    });

    it('declares the default so existing rows backfill to "pulse" with no data migration', () => {
      // NOT NULL + DEFAULT 'pulse' means Postgres materialises 'pulse' for every
      // pre-existing row at ADD COLUMN time — no UPDATE/backfill statement needed.
      expect(migrationSql).not.toMatch(/UPDATE\s+"Poll"/i);
      expect(migrationSql).toMatch(/DEFAULT\s+'pulse'/i);
    });
  });

  describe('Requirement 11.2 — Question and Response tables are structurally unchanged', () => {
    it('contains no ALTER TABLE against Question or Response', () => {
      const touched = alterTableTargets(migrationSql).filter(
        (t) => t === 'Question' || t === 'Response',
      );
      expect(touched).toEqual([]);
    });

    it('does not re-create or reference Question/Response as a CREATE TABLE target', () => {
      const created = createTableTargets(migrationSql);
      expect(created).not.toContain('Question');
      expect(created).not.toContain('Response');
    });

    it('contains no destructive statements anywhere in the migration', () => {
      // An additive, zero-downtime migration drops nothing and truncates nothing.
      expect(migrationSql).not.toMatch(/DROP\s+TABLE/i);
      expect(migrationSql).not.toMatch(/DROP\s+COLUMN/i);
      expect(migrationSql).not.toMatch(/TRUNCATE/i);
    });
  });

  describe('Requirement 11.1/11.2 — new schema is purely additive', () => {
    it('creates all five Retro* tables', () => {
      const created = createTableTargets(migrationSql);
      expect(created).toEqual(
        expect.arrayContaining([
          'RetroBoard',
          'RetroLane',
          'RetroCard',
          'RetroVote',
          'RetroActionItem',
        ]),
      );
    });

    it('only ever creates new Retro* tables (never an existing table)', () => {
      const created = createTableTargets(migrationSql);
      for (const table of created) {
        expect(table.startsWith('Retro')).toBe(true);
      }
    });

    it('every ALTER TABLE either adds the Poll.type column or a FK on a new Retro* table', () => {
      const targets = alterTableTargets(migrationSql);
      for (const target of targets) {
        const isPoll = target === 'Poll';
        const isNewRetroTable = target.startsWith('Retro');
        expect(isPoll || isNewRetroTable).toBe(true);
      }
    });
  });
});

// ─── App-level check: pulse creation relies on the DB default ────────────────

// Mock prisma + audit logger using the established service-test pattern so the
// check runs without any database connection.
const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  poll: {
    create: vi.fn(),
  },
}));

vi.mock('@/lib/db/client', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/services/auditLogger', () => ({
  auditLogger: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import { createPollService } from '@/lib/services/pollService';

describe('Requirement 11.3 — pulse poll creation is unchanged and defaults to "pulse"', () => {
  const MOCK_USER_ID = 'preservation-user';
  let pollService: ReturnType<typeof createPollService>;

  beforeEach(() => {
    vi.clearAllMocks();
    pollService = createPollService();
  });

  it('createPoll does not set `type`, so the DB DEFAULT \'pulse\' applies', async () => {
    let createData: Record<string, unknown> | undefined;

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        poll: {
          create: vi.fn().mockImplementation((args: any) => {
            createData = args.data;
            // Simulate the DB applying the column default on insert.
            return {
              id: 'poll-pulse',
              type: 'pulse',
              ...args.data,
              createdAt: new Date(),
              updatedAt: new Date(),
              isDeleted: false,
              backgroundImageUrl: null,
            };
          }),
        },
        auditLog: { create: vi.fn() },
      };
      return fn(tx);
    });

    const result = await pollService.createPoll({ title: 'Pulse Poll' }, MOCK_USER_ID);

    // The service must not override the discriminator — pulse stays pulse via default.
    expect(createData).toBeDefined();
    expect(createData!.type).toBeUndefined();
    expect((result as { type?: string }).type).toBe('pulse');
  });
});
