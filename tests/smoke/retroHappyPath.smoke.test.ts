import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db/client';
import { createRetroService } from '@/lib/services/retroService';

/**
 * REAL-DATABASE smoke test for the retro happy path.
 *
 * Unlike the property/unit suites (which mock Prisma), this executes real
 * writes against the same database the app uses. It exists to catch the class
 * of bug that mocked tests are blind to: schema drift, un-applied migrations,
 * wrong-database config, and serialization errors.
 *
 * If a required column (e.g. RetroBoard.backgroundImage, RetroLane.icon/color)
 * is missing from the live database, these tests fail loudly — instead of the
 * bug reaching the browser as a 500.
 *
 * Each test cleans up the rows it creates. A unique poll shell is created per
 * run so tests never collide with real data.
 */

const service = createRetroService();

// Track created poll ids for teardown.
const createdPollIds: string[] = [];

/** Creates a minimal Poll shell (retro type) that a board can attach to. */
async function createPollShell(): Promise<string> {
  const pollId = randomUUID();
  await prisma.poll.create({
    data: {
      id: pollId,
      userId: `smoke-${randomUUID()}`,
      title: 'SMOKE TEST retro',
      accessToken: randomUUID().replace(/-/g, '').slice(0, 32),
      type: 'retro',
    },
  });
  createdPollIds.push(pollId);
  return pollId;
}

/** Removes all rows created under a poll (children first, respecting FKs). */
async function cleanupPoll(pollId: string): Promise<void> {
  const board = await prisma.retroBoard.findUnique({ where: { pollId } });
  if (board) {
    await prisma.retroVote.deleteMany({ where: { boardId: board.id } });
    await prisma.retroCard.deleteMany({ where: { boardId: board.id } });
    await prisma.retroLane.deleteMany({ where: { boardId: board.id } });
    await prisma.retroActionItem.deleteMany({ where: { boardId: board.id } });
    await prisma.retroBoard.delete({ where: { id: board.id } });
  }
  await prisma.auditLog.deleteMany({ where: { pollId } });
  await prisma.poll.delete({ where: { id: pollId } }).catch(() => {});
}

beforeAll(async () => {
  // Fail fast with a clear message if the DB is unreachable.
  await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  for (const pollId of createdPollIds) {
    await cleanupPoll(pollId).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('Retro happy path (real database)', () => {
  it('creates a board from a template with icons and colors persisted', async () => {
    const pollId = await createPollShell();

    const board = await service.createBoard(pollId, {
      template: '4ls',
      createdBy: 'smoke-test',
    });

    expect(board.id).toBeTruthy();
    expect(board.template).toBe('4ls');

    // Read lanes back and confirm icon/color columns actually round-trip.
    const lanes = await prisma.retroLane.findMany({
      where: { boardId: board.id },
      orderBy: { displayOrder: 'asc' },
    });
    expect(lanes.length).toBeGreaterThanOrEqual(1);
    // 4Ls template lanes carry an icon and color — this fails if columns are missing.
    expect(lanes[0].icon).toBeTruthy();
    expect(lanes[0].color).toBeTruthy();
  });

  it('persists a background image config on the board (backgroundImage column)', async () => {
    const pollId = await createPollShell();
    const board = await service.createBoard(pollId, { template: 'start_stop_continue', createdBy: 'smoke-test' });

    const bg = { url: 'https://example.com/bg.jpg', storagePath: 'retro/x.jpg', opacity: 50, displayMode: 'cover' as const };
    await prisma.retroBoard.update({ where: { id: board.id }, data: { backgroundImage: bg } });

    const reread = await prisma.retroBoard.findUnique({ where: { id: board.id } });
    expect(reread?.backgroundImage).toEqual(bg);
  });

  it('runs the full flow: add card → vote → advance phase → add action item', async () => {
    const pollId = await createPollShell();
    const board = await service.createBoard(pollId, { template: 'start_stop_continue', createdBy: 'smoke-test' });

    const lanes = await prisma.retroLane.findMany({ where: { boardId: board.id }, orderBy: { displayOrder: 'asc' } });
    const laneId = lanes[0].id;

    // Add a card.
    const card = await service.addCard(board.id, {
      laneId,
      authorToken: 'participant-1',
      authorName: 'Alice',
      text: 'We shipped on time',
    });
    expect(card.id).toBeTruthy();

    // Move to vote phase and cast a vote.
    await service.setPhase(board.id, 'vote');
    await service.castVote(board.id, card.id, 'participant-2');
    const votes = await prisma.retroVote.count({ where: { cardId: card.id } });
    expect(votes).toBe(1);

    // Add an action item (allowed in vote phase).
    const item = await service.addActionItem(board.id, { text: 'Follow up on deploys', owner: 'Bob' });
    expect(item.id).toBeTruthy();

    const items = await service.getActionItems(board.id);
    expect(items.map((i) => i.text)).toContain('Follow up on deploys');
  });

  it('supports runtime lane add / update / delete (Phase 2B columns)', async () => {
    const pollId = await createPollShell();
    const board = await service.createBoard(pollId, { template: 'start_stop_continue', createdBy: 'smoke-test' });

    // Add a lane with icon + color — writes to the new columns.
    const lane = await service.addLane(board.id, { title: 'New Lane', icon: '🎯', color: '#123456' });
    expect(lane.icon).toBe('🎯');
    expect(lane.color).toBe('#123456');

    // Update it.
    const updated = await service.updateLane(lane.id, { title: 'Renamed', color: '#654321' });
    expect(updated.title).toBe('Renamed');
    expect(updated.color).toBe('#654321');

    // Delete it (board still has the original template lanes).
    await service.deleteLane(lane.id);
    const stillThere = await prisma.retroLane.findUnique({ where: { id: lane.id } });
    expect(stillThere).toBeNull();
  });

  it('updates board settings (votes per user) and rejects invalid values', async () => {
    const pollId = await createPollShell();
    const board = await service.createBoard(pollId, { template: 'start_stop_continue', createdBy: 'smoke-test' });

    const updated = await service.updateBoardSettings(board.id, { votesPerUser: 5 });
    expect(updated.votesPerUser).toBe(5);

    const reread = await prisma.retroBoard.findUnique({ where: { id: board.id } });
    expect(reread?.votesPerUser).toBe(5);

    // Out-of-range values are rejected.
    await expect(service.updateBoardSettings(board.id, { votesPerUser: 0 })).rejects.toThrow();
    await expect(service.updateBoardSettings(board.id, { votesPerUser: 21 })).rejects.toThrow();
  });

  it('exports a valid PDF for a board through the service (real @react-pdf)', async () => {
    const pollId = await createPollShell();
    const board = await service.createBoard(pollId, { template: '4ls', createdBy: 'smoke-test' });
    const lanes = await prisma.retroLane.findMany({ where: { boardId: board.id }, orderBy: { displayOrder: 'asc' } });
    await service.addCard(board.id, { laneId: lanes[0].id, authorToken: 't1', authorName: 'A', text: 'Card A' });

    const pdf = await service.exportBoardPdf(board.id);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});
