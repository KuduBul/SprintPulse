import { RetroBoard, RetroCard, RetroLane, RetroActionItem } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { auditLogger, PrismaTransactionClient } from './auditLogger';
import { getTemplateById, TemplateColumnDef } from '@/lib/retro/templateRegistry';
import { generateRetroPdf, PdfExportData } from '@/lib/retro/pdfExportService';

/**
 * The retro lifecycle phases. The board advances gather → vote → closed.
 */
export type RetroPhase = 'gather' | 'vote' | 'closed';

/**
 * Built-in retro templates. "custom" lets the facilitator supply their own
 * lane titles; the others expand to a fixed, ordered set of lanes.
 */
export type RetroTemplate = 'start_stop_continue' | '4ls' | 'mad_sad_glad' | 'sailboat' | 'custom';

/**
 * Input for creating a retro board and its lanes.
 *
 * - For a built-in template, `lanes` is ignored and the template's fixed lane
 *   titles are used.
 * - For the "custom" template, `lanes` supplies the lane titles in display order.
 * - `votesPerUser` optionally overrides the default per-user vote cap.
 * - `createdBy` is the audit actor (the authenticated facilitator). When not
 *   supplied, the board create is attributed to a 'system' sentinel rather than
 *   conflating the actor with the pollId.
 */
export interface CreateBoardInput {
  template: RetroTemplate;
  lanes?: string[];
  votesPerUser?: number;
  createdBy?: string;
}

/**
 * Input for adding a card to a lane during the gather phase.
 */
export interface AddCardInput {
  laneId: string;
  authorToken: string;
  authorName: string;
  text: string;
}

/**
 * Identifies who is requesting a board view, so anonymity can be applied per
 * viewer (a participant sees their own cards' identity; a facilitator sees all).
 */
export interface ViewerContext {
  role: 'facilitator' | 'participant';
  participantToken?: string;
}

/**
 * A single card as exposed in a board view. Author identity (`authorToken` /
 * `authorName`) is null when it must be hidden from the requesting viewer.
 */
export interface BoardCardView {
  id: string;
  laneId: string;
  text: string;
  authorToken: string | null;
  authorName: string | null;
  isOwn: boolean;
  voteCount: number;
  createdAt: Date;
}

/**
 * A lane as exposed in a board view, with its cards nested.
 *
 * `cardCount` is the total number of cards in the lane regardless of the
 * viewer. During the gather phase a participant only receives their OWN cards
 * in `cards`; `cardCount` still reflects everyone's contributions so the UI can
 * show an aggregate count for the lane without exposing others' content
 * (Requirement 6.5).
 */
export interface BoardLaneView {
  id: string;
  title: string;
  displayOrder: number;
  position: unknown;
  icon: string | null;
  color: string | null;
  cardCount: number;
  cards: BoardCardView[];
}

/**
 * A per-viewer projection of a retro board.
 */
export interface BoardView {
  id: string;
  pollId: string;
  template: string;
  phase: RetroPhase;
  votesPerUser: number;
  backgroundImage: { url: string; opacity: number; displayMode: 'cover' | 'contain' } | null;
  lanes: BoardLaneView[];
}

/**
 * Structured export of a closed board.
 */
export interface ExportPayload {
  format: 'json' | 'csv';
  content: string;
}

/**
 * Input for adding a lane to an existing board at runtime.
 */
export interface CreateLaneInput {
  title: string;
  icon?: string;
  color?: string;
}

/**
 * Input for partially updating a lane's title, icon, or color.
 * Setting icon or color to `null` clears the value.
 */
export interface UpdateLaneInput {
  title?: string;
  icon?: string | null;
  color?: string | null;
}

/**
 * Input for reordering lanes. The `laneIds` array defines the new display order:
 * position 0 → displayOrder 0, position 1 → displayOrder 1, etc.
 */
export interface ReorderLanesInput {
  laneIds: string[];
}

/**
 * Input for creating an action item on a board (Requirements 7.2, 7.3, 7.4).
 */
export interface CreateActionItemInput {
  text: string;          // 1–500 chars after trim
  owner?: string;        // 0–100 chars, nullable
  dueDate?: string;      // ISO date string, nullable
}

/**
 * Input for partially updating an action item's text, owner, or due date.
 * Setting owner or dueDate to `null` clears the value.
 */
export interface UpdateActionItemInput {
  text?: string;
  owner?: string | null;
  dueDate?: string | null;
}

/**
 * Input for updating board-level settings from the edit screen.
 * Currently supports the per-user vote cap.
 */
export interface UpdateBoardSettingsInput {
  votesPerUser?: number; // positive integer, 1–20
}

/**
 * Interface for the Retro Service — the retro domain engine. All methods
 * enforce phase rules, ownership, and the vote cap server-side.
 */
export interface RetroService {
  createBoard(pollId: string, input: CreateBoardInput): Promise<RetroBoard>;
  getBoard(pollId: string, viewer: ViewerContext): Promise<BoardView>;
  addCard(boardId: string, input: AddCardInput): Promise<RetroCard>;
  editCard(cardId: string, authorToken: string, text: string): Promise<RetroCard>;
  deleteCard(cardId: string, authorToken: string): Promise<void>;
  castVote(boardId: string, cardId: string, voterToken: string): Promise<void>;
  removeVote(boardId: string, cardId: string, voterToken: string): Promise<void>;
  setPhase(boardId: string, phase: RetroPhase): Promise<RetroBoard>;
  exportBoard(boardId: string, format: 'json' | 'csv'): Promise<ExportPayload>;

  // Board settings (Phase 2B — edit-time configuration)
  updateBoardSettings(boardId: string, input: UpdateBoardSettingsInput): Promise<RetroBoard>;

  // Lane CRUD (Phase 2B — Runtime Column Modification)
  addLane(boardId: string, input: CreateLaneInput): Promise<RetroLane>;
  updateLane(laneId: string, input: UpdateLaneInput): Promise<RetroLane>;
  deleteLane(laneId: string): Promise<void>;
  reorderLanes(boardId: string, input: ReorderLanesInput): Promise<void>;

  // Action Items (Phase 2B — Requirements 7.1–7.7)
  addActionItem(boardId: string, input: CreateActionItemInput): Promise<RetroActionItem>;
  updateActionItem(itemId: string, input: UpdateActionItemInput): Promise<RetroActionItem>;
  deleteActionItem(itemId: string): Promise<void>;
  getActionItems(boardId: string): Promise<RetroActionItem[]>;

  // PDF Export (Phase 2B — Requirements 8.1, 8.2)
  exportBoardPdf(boardId: string): Promise<Buffer>;
}

/** Default per-user vote cap for a newly created board (Requirement 3.7). */
const DEFAULT_VOTES_PER_USER = 3;

/** Lane count bounds enforced on every board (Requirement 3.4). */
const MIN_LANES = 1;
const MAX_LANES = 8;

/** Maximum lane title length (Requirement 3.5). */
const MAX_LANE_TITLE_LENGTH = 100;

/** Maximum card text length after trimming (Requirement 5.2). */
const MAX_CARD_TEXT_LENGTH = 2000;

/**
 * Canonical phase progression (Requirement 8.1). The board advances strictly
 * forward through these stages: gather → vote → closed.
 */
const PHASE_ORDER: RetroPhase[] = ['gather', 'vote', 'closed'];

/**
 * Built-in template → ordered lane titles (Requirement 3.1, 3.2).
 * @deprecated Use `getTemplateById` from templateRegistry instead for full column data.
 * Kept for reference; createBoard now uses the template registry directly.
 */
const TEMPLATE_LANES: Record<string, string[]> = {
  start_stop_continue: ['Start', 'Stop', 'Continue'],
  '4ls': ['Liked', 'Learned', 'Lacked', 'Longed For'],
  mad_sad_glad: ['Mad', 'Sad', 'Glad'],
  sailboat: ['Wind (propelling us)', 'Anchor (holding us back)', 'Rocks (risks ahead)', 'Island (our goal)'],
};

/**
 * Builds an Error carrying a machine-readable `code`, mirroring the existing
 * service error convention (see responseService).
 */
function retroError(message: string, code: string): Error {
  const error = new Error(message);
  (error as Error & { code?: string }).code = code;
  return error;
}

/**
 * Resolves the lane titles for a board from its template. Built-in templates
 * expand to their fixed titles; "custom" uses the caller-supplied titles
 * (Requirement 3.2, 3.3).
 */
function resolveLaneTitles(input: CreateBoardInput): string[] {
  if (input.template === 'custom') {
    if (!input.lanes) {
      throw retroError('Custom retro boards require lane titles', 'VALIDATION_ERROR');
    }
    return input.lanes;
  }

  const titles = TEMPLATE_LANES[input.template];
  if (!titles) {
    throw retroError(`Unknown retro template: ${input.template}`, 'VALIDATION_ERROR');
  }
  return titles;
}

/**
 * Resolves full column definitions (title, icon, color) from the template
 * registry for built-in templates. Returns undefined for "custom" templates
 * (which don't have pre-defined icons/colors from the registry).
 */
function resolveTemplateColumns(input: CreateBoardInput): TemplateColumnDef[] | undefined {
  if (input.template === 'custom') {
    return undefined;
  }
  const template = getTemplateById(input.template);
  return template?.columns;
}

/**
 * Validates and normalises lane titles: enforces the 1–8 lane count and that
 * each title is non-empty and at most 100 characters after trimming
 * (Requirement 3.4, 3.5). Returns the trimmed titles.
 */
function validateLaneTitles(titles: string[]): string[] {
  if (titles.length < MIN_LANES || titles.length > MAX_LANES) {
    throw retroError(
      `A retro board must have between ${MIN_LANES} and ${MAX_LANES} lanes`,
      'VALIDATION_ERROR',
    );
  }

  return titles.map((raw, index) => {
    const title = (raw ?? '').trim();
    if (title.length < 1) {
      throw retroError(`Lane title at position ${index} must not be empty`, 'VALIDATION_ERROR');
    }
    if (title.length > MAX_LANE_TITLE_LENGTH) {
      throw retroError(
        `Lane title at position ${index} must be at most ${MAX_LANE_TITLE_LENGTH} characters`,
        'VALIDATION_ERROR',
      );
    }
    return title;
  });
}

/**
 * Resolves the per-user vote cap, applying the default when unset and rejecting
 * non-positive or non-integer overrides (Requirement 3.7).
 */
function resolveVotesPerUser(override?: number): number {
  if (override === undefined) {
    return DEFAULT_VOTES_PER_USER;
  }
  if (!Number.isInteger(override) || override < 1) {
    throw retroError('votesPerUser must be a positive integer', 'VALIDATION_ERROR');
  }
  return override;
}

/**
 * Validates and normalises card text: trims surrounding whitespace, rejects
 * empty text, and rejects text longer than 2000 characters after trimming
 * (Requirement 5.2). Returns the trimmed text ready to persist.
 */
function validateCardText(raw: string): string {
  const text = (raw ?? '').trim();
  if (text.length < 1) {
    throw retroError('Card text must not be empty', 'VALIDATION_ERROR');
  }
  if (text.length > MAX_CARD_TEXT_LENGTH) {
    throw retroError(
      `Card text must be at most ${MAX_CARD_TEXT_LENGTH} characters`,
      'VALIDATION_ERROR',
    );
  }
  return text;
}

/**
 * Creates a RetroService instance. Board mutations are logged via the
 * AuditLogger within the same transaction, mirroring the pulse services.
 */
export function createRetroService(): RetroService {
  return {
    /**
     * Creates a retro board (phase "gather", default vote cap) and its lanes in
     * a single transaction. Lane titles come from the chosen template, or from
     * the caller for the "custom" template, and are validated before any write.
     * (Requirements 3.1–3.7)
     */
    async createBoard(pollId: string, input: CreateBoardInput): Promise<RetroBoard> {
      const laneTitles = validateLaneTitles(resolveLaneTitles(input));
      const templateColumns = resolveTemplateColumns(input);
      const votesPerUser = resolveVotesPerUser(input.votesPerUser);
      const actor = input.createdBy ?? 'system';

      const board = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        const created = await tx.retroBoard.create({
          data: {
            pollId,
            template: input.template,
            phase: 'gather',
            votesPerUser,
          },
        });

        await tx.retroLane.createMany({
          data: laneTitles.map((title, index) => ({
            boardId: created.id,
            title,
            displayOrder: index,
            icon: templateColumns?.[index]?.icon ?? null,
            color: templateColumns?.[index]?.color ?? null,
          })),
        });

        await auditLogger.log(
          {
            pollId,
            action: 'RETRO_BOARD_CREATED',
            actor,
            metadata: {
              boardId: created.id,
              template: input.template,
              laneCount: laneTitles.length,
              votesPerUser,
            },
          },
          tx,
        );

        return created;
      });

      return board;
    },

    /**
     * Returns a per-viewer projection of the board, applying the Phase 2A
     * anonymity and reveal rules (Requirement 6, 7.5, 7.6, 8.3).
     *
     * Anonymity model (derived from phase for 2A — no schema reveal flag):
     *  - Cards are anonymous by default (Req 6.1). Author identity
     *    (`authorToken`/`authorName`) is exposed only to a facilitator, or to a
     *    participant for their OWN cards (so they can edit/delete during gather)
     *    (Req 6.2, 6.3). It is never exposed to a participant for another
     *    participant's cards while anonymous.
     *  - gather + participant viewer: the viewer sees their own cards in full,
     *    but for OTHER participants' cards they receive only an aggregate count
     *    per lane (`cardCount`) — not the text or identity (Req 6.5).
     *  - vote / closed: card content is revealed for all viewers so they can
     *    vote (Req 7.5 running counts) or read the closed board (Req 8.3), but
     *    author identity stays hidden for non-owned cards unless the viewer is
     *    the facilitator.
     *  - A facilitator always sees every card and its author, in every phase,
     *    so they can manage and (later) export the board (Req 6.4).
     *
     * `cardCount` on each lane always reflects the true total number of cards,
     * independent of how many the viewer is allowed to read, so the UI can show
     * a lane's aggregate size during gather without leaking content.
     */
    async getBoard(pollId: string, viewer: ViewerContext): Promise<BoardView> {
      const board = await prisma.retroBoard.findUnique({ where: { pollId } });
      if (!board) {
        throw retroError('Retro board not found', 'NOT_FOUND');
      }

      const [lanes, cards, votes] = await Promise.all([
        prisma.retroLane.findMany({
          where: { boardId: board.id },
          orderBy: { displayOrder: 'asc' },
        }),
        prisma.retroCard.findMany({ where: { boardId: board.id } }),
        prisma.retroVote.findMany({ where: { boardId: board.id } }),
      ]);

      const voteCounts = new Map<string, number>();
      for (const vote of votes) {
        voteCounts.set(vote.cardId, (voteCounts.get(vote.cardId) ?? 0) + 1);
      }

      const phase = board.phase as RetroPhase;
      const isFacilitator = viewer.role === 'facilitator';

      // Author identity is revealed to the facilitator only. For 2A there is no
      // explicit "disable anonymisation" flag, so participants never see other
      // participants' identity; closed does not auto-expose authors either
      // (Req 6.4 ties name exposure to the facilitator disabling anonymisation).
      const revealAuthorsToViewer = isFacilitator;

      // During gather, participants do not receive other participants' card
      // content — only an aggregate per-lane count (Req 6.5). Once the board
      // advances to vote/closed, cards are revealed for everyone to read/vote.
      const hideOthersContent = !isFacilitator && phase === 'gather';

      const cardCountByLane = new Map<string, number>();
      const cardsByLane = new Map<string, BoardCardView[]>();

      for (const card of cards) {
        // Every card contributes to its lane's aggregate count regardless of
        // whether this viewer may read it.
        cardCountByLane.set(card.laneId, (cardCountByLane.get(card.laneId) ?? 0) + 1);

        const isOwn = !isFacilitator && card.authorToken === viewer.participantToken;

        // While gather is anonymous, a participant only receives their own
        // cards' content; others' cards are represented solely by the count.
        if (hideOthersContent && !isOwn) {
          continue;
        }

        const exposeIdentity = revealAuthorsToViewer || isOwn;

        const cardView: BoardCardView = {
          id: card.id,
          laneId: card.laneId,
          text: card.text,
          authorToken: exposeIdentity ? card.authorToken : null,
          authorName: exposeIdentity ? card.authorName : null,
          isOwn,
          voteCount: voteCounts.get(card.id) ?? 0,
          createdAt: card.createdAt,
        };

        const laneCards = cardsByLane.get(card.laneId) ?? [];
        laneCards.push(cardView);
        cardsByLane.set(card.laneId, laneCards);
      }

      // Parse backgroundImage JSON field if present
      let backgroundImage: BoardView['backgroundImage'] = null;
      if (board.backgroundImage && typeof board.backgroundImage === 'object') {
        const bg = board.backgroundImage as Record<string, unknown>;
        if (typeof bg.url === 'string') {
          backgroundImage = {
            url: bg.url,
            opacity: typeof bg.opacity === 'number' ? bg.opacity : 100,
            displayMode: bg.displayMode === 'contain' ? 'contain' : 'cover',
          };
        }
      }

      return {
        id: board.id,
        pollId: board.pollId,
        template: board.template,
        phase,
        votesPerUser: board.votesPerUser,
        backgroundImage,
        lanes: lanes.map((lane) => ({
          id: lane.id,
          title: lane.title,
          displayOrder: lane.displayOrder,
          position: lane.position,
          icon: lane.icon ?? null,
          color: lane.color ?? null,
          cardCount: cardCountByLane.get(lane.id) ?? 0,
          cards: cardsByLane.get(lane.id) ?? [],
        })),
      };
    },

    // The following participant/facilitator operations are implemented in
    // tasks 4.2–4.4. They are declared here so the full RetroService interface
    // is available to dependents; calling them now throws a clear error.

    /**
     * Adds a card to a lane during the gather phase. Only permitted while the
     * board's phase is "gather"; the text is trimmed and validated (non-empty,
     * at most 2000 characters) before any write. Returns the created card.
     * (Requirements 5.1, 5.2, 5.6)
     */
    async addCard(boardId: string, input: AddCardInput): Promise<RetroCard> {
      const text = validateCardText(input.text);

      const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
      if (!board) {
        throw retroError('Retro board not found', 'NOT_FOUND');
      }
      if ((board.phase as RetroPhase) !== 'gather') {
        throw retroError('Cards can only be added during the gather phase', 'WRONG_PHASE');
      }

      return prisma.retroCard.create({
        data: {
          boardId,
          laneId: input.laneId,
          authorToken: input.authorToken,
          authorName: input.authorName,
          text,
        },
      });
    },

    /**
     * Edits a card's text. Only permitted while the board's phase is "gather"
     * and only by the card's author (matching authorToken). The new text is
     * trimmed and validated before the update. Returns the updated card.
     * (Requirements 5.2, 5.3, 5.4, 5.6)
     */
    async editCard(cardId: string, authorToken: string, text: string): Promise<RetroCard> {
      const validated = validateCardText(text);

      const card = await prisma.retroCard.findUnique({ where: { id: cardId } });
      if (!card) {
        throw retroError('Retro card not found', 'NOT_FOUND');
      }

      const board = await prisma.retroBoard.findUnique({ where: { id: card.boardId } });
      if (!board) {
        throw retroError('Retro board not found', 'NOT_FOUND');
      }
      if ((board.phase as RetroPhase) !== 'gather') {
        throw retroError('Cards can only be edited during the gather phase', 'WRONG_PHASE');
      }
      if (card.authorToken !== authorToken) {
        throw retroError('Only the card author may edit this card', 'NOT_CARD_OWNER');
      }

      return prisma.retroCard.update({
        where: { id: cardId },
        data: { text: validated },
      });
    },

    /**
     * Deletes a card. Only permitted while the board's phase is "gather" and
     * only by the card's author (matching authorToken). A rejected delete leaves
     * the card in place. (Requirements 5.3, 5.4, 5.6)
     */
    async deleteCard(cardId: string, authorToken: string): Promise<void> {
      const card = await prisma.retroCard.findUnique({ where: { id: cardId } });
      if (!card) {
        throw retroError('Retro card not found', 'NOT_FOUND');
      }

      const board = await prisma.retroBoard.findUnique({ where: { id: card.boardId } });
      if (!board) {
        throw retroError('Retro board not found', 'NOT_FOUND');
      }
      if ((board.phase as RetroPhase) !== 'gather') {
        throw retroError('Cards can only be deleted during the gather phase', 'WRONG_PHASE');
      }
      if (card.authorToken !== authorToken) {
        throw retroError('Only the card author may delete this card', 'NOT_CARD_OWNER');
      }

      await prisma.retroCard.delete({ where: { id: cardId } });
    },

    /**
     * Casts a vote for a card during the vote phase. Enforces two invariants
     * server-side:
     *
     *  - One vote per card per voter (Requirement 7.3): if the voter already
     *    has a vote on this card, the call is a no-op — it neither creates a
     *    duplicate row nor counts against the cap. The read-check-write runs in
     *    a transaction and additionally catches the `@@unique([cardId,
     *    voterToken])` violation (P2002) as a no-op, so a duplicate can never
     *    create a second row even under concurrency.
     *  - Per-user total cap (Requirement 7.2): a voter may not hold more than
     *    the board's `votesPerUser` votes. A NEW-card vote that would exceed the
     *    cap is rejected with `VOTE_CAP_EXCEEDED`; a repeated vote on an
     *    already-voted card is never blocked by the cap because it is a no-op.
     *
     * Only permitted while the board's phase is "vote" (Requirements 7.1, 7.4).
     */
    async castVote(boardId: string, cardId: string, voterToken: string): Promise<void> {
      const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
      if (!board) {
        throw retroError('Retro board not found', 'NOT_FOUND');
      }
      if ((board.phase as RetroPhase) !== 'vote') {
        throw retroError('Votes can only be cast during the vote phase', 'WRONG_PHASE');
      }

      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // Uniqueness: an existing vote on this card by this voter is a no-op,
        // so it neither duplicates a row nor consumes another cap slot.
        const existing = await tx.retroVote.findFirst({ where: { cardId, voterToken } });
        if (existing) {
          return;
        }

        // Cap: count the voter's existing (distinct-card) votes on this board.
        const voteCount = await tx.retroVote.count({ where: { boardId, voterToken } });
        if (voteCount >= board.votesPerUser) {
          throw retroError('Vote cap exceeded for this voter', 'VOTE_CAP_EXCEEDED');
        }

        try {
          await tx.retroVote.create({ data: { boardId, cardId, voterToken } });
        } catch (error) {
          // Defensive: a concurrent duplicate trips the unique constraint.
          // Treat it as a handled no-op so a second row can never be written.
          if ((error as { code?: string }).code === 'P2002') {
            return;
          }
          throw error;
        }
      });
    },

    /**
     * Removes the voter's vote on a card during the vote phase. Only permitted
     * while the board's phase is "vote" (Requirements 7.1, 7.4); deleting an
     * absent vote is a no-op.
     */
    async removeVote(boardId: string, cardId: string, voterToken: string): Promise<void> {
      const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
      if (!board) {
        throw retroError('Retro board not found', 'NOT_FOUND');
      }
      if ((board.phase as RetroPhase) !== 'vote') {
        throw retroError('Votes can only be removed during the vote phase', 'WRONG_PHASE');
      }

      await prisma.retroVote.deleteMany({ where: { cardId, voterToken } });
    },

    /**
     * Advances the board's phase (facilitator operation). The canonical
     * progression is gather → vote → closed (Requirement 8.1); when the phase
     * changes the phase rules for card capture and voting take effect
     * immediately because every mutation re-reads the board phase
     * (Requirement 8.2). Ownership/auth is enforced by the calling route
     * (task 5.1); the service performs the persisted update.
     *
     * Transition rules:
     *  - The target must be a known phase (gather | vote | closed).
     *  - The board may only move forward or stay on its current phase; moving
     *    backward (e.g. closed → gather) is rejected with
     *    `INVALID_PHASE_TRANSITION` so a closed board cannot be reopened.
     *
     * The change is recorded via the audit logger ('RETRO_PHASE_CHANGED') in
     * the same transaction as the update, mirroring createBoard. Returns the
     * updated board.
     */
    async setPhase(boardId: string, phase: RetroPhase): Promise<RetroBoard> {
      const targetIndex = PHASE_ORDER.indexOf(phase);
      if (targetIndex === -1) {
        throw retroError(`Unknown retro phase: ${phase}`, 'VALIDATION_ERROR');
      }

      const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
      if (!board) {
        throw retroError('Retro board not found', 'NOT_FOUND');
      }

      const currentIndex = PHASE_ORDER.indexOf(board.phase as RetroPhase);
      if (currentIndex !== -1 && targetIndex < currentIndex) {
        throw retroError(
          `Cannot move retro phase backward from ${board.phase} to ${phase}`,
          'INVALID_PHASE_TRANSITION',
        );
      }

      return prisma.$transaction(async (tx: PrismaTransactionClient) => {
        const updated = await tx.retroBoard.update({
          where: { id: boardId },
          data: { phase },
        });

        await auditLogger.log(
          {
            pollId: board.pollId,
            action: 'RETRO_PHASE_CHANGED',
            actor: 'facilitator',
            metadata: {
              boardId,
              fromPhase: board.phase,
              toPhase: phase,
            },
          },
          tx,
        );

        return updated;
      });
    },

    async exportBoard(boardId: string, format: 'json' | 'csv'): Promise<ExportPayload> {
      const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
      if (!board) {
        throw retroError('Retro board not found', 'NOT_FOUND');
      }

      const [lanes, cards, votes] = await Promise.all([
        prisma.retroLane.findMany({
          where: { boardId: board.id },
          orderBy: { displayOrder: 'asc' },
        }),
        prisma.retroCard.findMany({ where: { boardId: board.id } }),
        prisma.retroVote.findMany({ where: { boardId: board.id } }),
      ]);

      // Compute vote counts per card
      const voteCounts = new Map<string, number>();
      for (const vote of votes) {
        voteCounts.set(vote.cardId, (voteCounts.get(vote.cardId) ?? 0) + 1);
      }

      // Build lane lookup
      const laneMap = new Map(lanes.map((l) => [l.id, l]));

      if (format === 'json') {
        const exportData = {
          board: {
            id: board.id,
            pollId: board.pollId,
            template: board.template,
            phase: board.phase,
            votesPerUser: board.votesPerUser,
            createdAt: board.createdAt,
          },
          lanes: lanes.map((lane) => ({
            id: lane.id,
            title: lane.title,
            displayOrder: lane.displayOrder,
            cards: cards
              .filter((c) => c.laneId === lane.id)
              .map((card) => ({
                id: card.id,
                text: card.text,
                author: card.authorName,
                voteCount: voteCounts.get(card.id) ?? 0,
                createdAt: card.createdAt,
              })),
          })),
        };

        return { format: 'json', content: JSON.stringify(exportData, null, 2) };
      }

      // CSV format: flat table with Lane, CardText, Author, VoteCount
      const csvRows: string[] = ['Lane,CardText,Author,VoteCount'];
      for (const card of cards) {
        const lane = laneMap.get(card.laneId);
        const laneTitle = lane ? lane.title : '';
        const voteCount = voteCounts.get(card.id) ?? 0;
        // Escape CSV fields: wrap in quotes if they contain commas, quotes, or newlines
        const escapeCsv = (value: string): string => {
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        };
        csvRows.push(
          `${escapeCsv(laneTitle)},${escapeCsv(card.text)},${escapeCsv(card.authorName)},${voteCount}`
        );
      }

      return { format: 'csv', content: csvRows.join('\n') };
    },

    // ────────────────────────────────────────────────────────────────────────
    // Lane CRUD (Phase 2B — Runtime Column Modification)
    // Requirements 6.1–6.9, 13.1
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Adds a new lane to an existing board. Validates the max lane cap (8) and
     * the lane title (non-empty, ≤100 chars). The new lane receives the next
     * displayOrder (appended to the end). (Requirements 6.1, 6.2, 6.8)
     */
    async addLane(boardId: string, input: CreateLaneInput): Promise<RetroLane> {
      const title = (input.title ?? '').trim();
      if (title.length < 1) {
        throw retroError('Lane title must not be empty', 'VALIDATION_ERROR');
      }
      if (title.length > MAX_LANE_TITLE_LENGTH) {
        throw retroError(
          `Lane title must be at most ${MAX_LANE_TITLE_LENGTH} characters`,
          'VALIDATION_ERROR',
        );
      }

      const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
      if (!board) {
        throw retroError('Retro board not found', 'NOT_FOUND');
      }

      const currentLaneCount = await prisma.retroLane.count({ where: { boardId } });
      if (currentLaneCount >= MAX_LANES) {
        throw retroError(
          `Cannot add lane: board already has the maximum of ${MAX_LANES} lanes`,
          'LANE_LIMIT_EXCEEDED',
        );
      }

      return prisma.retroLane.create({
        data: {
          boardId,
          title,
          displayOrder: currentLaneCount,
          icon: input.icon ?? null,
          color: input.color ?? null,
        },
      });
    },

    /**
     * Partially updates a lane's title, icon, and/or color. Validates the title
     * if provided. Setting icon/color to `null` clears the value.
     * (Requirements 6.3, 6.9, 13.1)
     */
    async updateLane(laneId: string, input: UpdateLaneInput): Promise<RetroLane> {
      const lane = await prisma.retroLane.findUnique({ where: { id: laneId } });
      if (!lane) {
        throw retroError('Lane not found', 'NOT_FOUND');
      }

      const data: { title?: string; icon?: string | null; color?: string | null } = {};

      if (input.title !== undefined) {
        const title = (input.title ?? '').trim();
        if (title.length < 1) {
          throw retroError('Lane title must not be empty', 'VALIDATION_ERROR');
        }
        if (title.length > MAX_LANE_TITLE_LENGTH) {
          throw retroError(
            `Lane title must be at most ${MAX_LANE_TITLE_LENGTH} characters`,
            'VALIDATION_ERROR',
          );
        }
        data.title = title;
      }

      if ('icon' in input) {
        data.icon = input.icon ?? null;
      }

      if ('color' in input) {
        data.color = input.color ?? null;
      }

      return prisma.retroLane.update({
        where: { id: laneId },
        data,
      });
    },

    /**
     * Deletes a lane and cascades deletion to all associated cards. Validates
     * the minimum lane count (1) — the last lane on a board cannot be deleted.
     * (Requirements 6.4, 6.5, 6.7)
     */
    async deleteLane(laneId: string): Promise<void> {
      const lane = await prisma.retroLane.findUnique({ where: { id: laneId } });
      if (!lane) {
        throw retroError('Lane not found', 'NOT_FOUND');
      }

      const laneCount = await prisma.retroLane.count({ where: { boardId: lane.boardId } });
      if (laneCount <= MIN_LANES) {
        throw retroError(
          'Cannot delete the last lane on a board',
          'MIN_LANES_REQUIRED',
        );
      }

      // Cascade: delete votes on cards in this lane, then cards, then the lane
      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // Delete votes associated with cards in this lane
        const cardsInLane = await tx.retroCard.findMany({
          where: { laneId },
          select: { id: true },
        });
        const cardIds = cardsInLane.map((c) => c.id);

        if (cardIds.length > 0) {
          await tx.retroVote.deleteMany({ where: { cardId: { in: cardIds } } });
        }

        // Delete all cards in the lane
        await tx.retroCard.deleteMany({ where: { laneId } });

        // Delete the lane itself
        await tx.retroLane.delete({ where: { id: laneId } });
      });
    },

    /**
     * Reorders lanes on a board. The `laneIds` array defines the new display
     * order: position 0 → displayOrder 0, position 1 → displayOrder 1, etc.
     * All lane IDs must belong to the specified board. (Requirement 6.6)
     */
    async reorderLanes(boardId: string, input: ReorderLanesInput): Promise<void> {
      const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
      if (!board) {
        throw retroError('Retro board not found', 'NOT_FOUND');
      }

      const existingLanes = await prisma.retroLane.findMany({
        where: { boardId },
        select: { id: true },
      });

      const existingIds = new Set(existingLanes.map((l) => l.id));

      // Validate all provided IDs belong to this board
      for (const laneId of input.laneIds) {
        if (!existingIds.has(laneId)) {
          throw retroError(
            `Lane ${laneId} does not belong to this board`,
            'VALIDATION_ERROR',
          );
        }
      }

      // Validate all board lanes are present in the input (complete reorder)
      if (input.laneIds.length !== existingLanes.length) {
        throw retroError(
          'Reorder input must include all lane IDs for the board',
          'VALIDATION_ERROR',
        );
      }

      // Apply the new display order
      await prisma.$transaction(
        input.laneIds.map((laneId, index) =>
          prisma.retroLane.update({
            where: { id: laneId },
            data: { displayOrder: index },
          }),
        ),
      );
    },

    // ────────────────────────────────────────────────────────────────────────
    // Action Items CRUD (Phase 2B — Requirements 7.1–7.7)
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Adds an action item to a board. Enforces:
     *  - Phase gate: only allowed in "vote" or "closed" phases (Requirement 7.1)
     *  - Text validation: trimmed text must be 1–500 characters (Requirement 7.2)
     *  - Owner validation: at most 100 characters (Requirement 7.3)
     *  - Optional due date as ISO string (Requirement 7.4)
     */
    async addActionItem(boardId: string, input: CreateActionItemInput): Promise<RetroActionItem> {
      const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
      if (!board) {
        throw retroError('Retro board not found', 'NOT_FOUND');
      }

      const phase = board.phase as RetroPhase;
      if (phase !== 'vote' && phase !== 'closed') {
        throw retroError(
          'Action items can only be added during the vote or closed phase',
          'WRONG_PHASE',
        );
      }

      // Validate text: trim and enforce 1–500 char bounds
      const text = (input.text ?? '').trim();
      if (text.length < 1) {
        throw retroError('Action item text must not be empty', 'VALIDATION_ERROR');
      }
      if (text.length > 500) {
        throw retroError(
          'Action item text must be at most 500 characters',
          'VALIDATION_ERROR',
        );
      }

      // Validate owner: at most 100 characters
      if (input.owner !== undefined && input.owner !== null && input.owner.length > 100) {
        throw retroError(
          'Action item owner must be at most 100 characters',
          'VALIDATION_ERROR',
        );
      }

      // Parse due date if provided
      const dueDate = input.dueDate ? new Date(input.dueDate) : null;
      if (input.dueDate && isNaN(dueDate!.getTime())) {
        throw retroError('Invalid due date format', 'VALIDATION_ERROR');
      }

      return prisma.retroActionItem.create({
        data: {
          boardId,
          text,
          owner: input.owner ?? null,
          dueDate,
        },
      });
    },

    /**
     * Partially updates an action item's text, owner, and/or due date.
     * Validates text (1–500 chars) if provided. Setting owner or dueDate to
     * `null` clears the value. (Requirement 7.6)
     */
    async updateActionItem(itemId: string, input: UpdateActionItemInput): Promise<RetroActionItem> {
      const item = await prisma.retroActionItem.findUnique({ where: { id: itemId } });
      if (!item) {
        throw retroError('Action item not found', 'NOT_FOUND');
      }

      const data: { text?: string; owner?: string | null; dueDate?: Date | null } = {};

      if (input.text !== undefined) {
        const text = (input.text ?? '').trim();
        if (text.length < 1) {
          throw retroError('Action item text must not be empty', 'VALIDATION_ERROR');
        }
        if (text.length > 500) {
          throw retroError(
            'Action item text must be at most 500 characters',
            'VALIDATION_ERROR',
          );
        }
        data.text = text;
      }

      if ('owner' in input) {
        if (input.owner !== undefined && input.owner !== null && input.owner.length > 100) {
          throw retroError(
            'Action item owner must be at most 100 characters',
            'VALIDATION_ERROR',
          );
        }
        data.owner = input.owner ?? null;
      }

      if ('dueDate' in input) {
        if (input.dueDate === null || input.dueDate === undefined) {
          data.dueDate = null;
        } else {
          const dueDate = new Date(input.dueDate);
          if (isNaN(dueDate.getTime())) {
            throw retroError('Invalid due date format', 'VALIDATION_ERROR');
          }
          data.dueDate = dueDate;
        }
      }

      return prisma.retroActionItem.update({
        where: { id: itemId },
        data,
      });
    },

    /**
     * Deletes an action item by ID. (Requirement 7.6)
     */
    async deleteActionItem(itemId: string): Promise<void> {
      const item = await prisma.retroActionItem.findUnique({ where: { id: itemId } });
      if (!item) {
        throw retroError('Action item not found', 'NOT_FOUND');
      }

      await prisma.retroActionItem.delete({ where: { id: itemId } });
    },

    /**
     * Returns all action items for a board, ordered by creation time.
     * (Requirements 7.5, 7.7)
     */
    async getActionItems(boardId: string): Promise<RetroActionItem[]> {
      return prisma.retroActionItem.findMany({
        where: { boardId },
        orderBy: { createdAt: 'asc' },
      });
    },

    // ────────────────────────────────────────────────────────────────────────
    // Board settings (Phase 2B — edit-time configuration)
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Updates board-level settings from the edit screen. Currently supports the
     * per-user vote cap (`votesPerUser`), validated as a positive integer in the
     * 1–20 range to match the create-time constraints.
     */
    async updateBoardSettings(boardId, input) {
      const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
      if (!board) {
        throw retroError('Retro board not found', 'NOT_FOUND');
      }

      const data: { votesPerUser?: number } = {};
      if (input.votesPerUser !== undefined) {
        if (!Number.isInteger(input.votesPerUser) || input.votesPerUser < 1 || input.votesPerUser > 20) {
          throw retroError('votesPerUser must be an integer between 1 and 20', 'VALIDATION_ERROR');
        }
        data.votesPerUser = input.votesPerUser;
      }

      if (Object.keys(data).length === 0) {
        return board;
      }

      return prisma.retroBoard.update({ where: { id: boardId }, data });
    },

    // ────────────────────────────────────────────────────────────────────────
    // PDF Export (Phase 2B — Requirements 8.1, 8.2)
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Aggregates board data (title, lanes with cards sorted by vote count, and
     * action items) and generates a styled PDF export using the pdfExportService.
     * Returns the PDF buffer ready to serve as a download.
     * (Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6)
     */
    async exportBoardPdf(boardId: string): Promise<Buffer> {
      const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
      if (!board) {
        throw retroError('Retro board not found', 'NOT_FOUND');
      }

      // Fetch the poll to get the board title
      const poll = await prisma.poll.findUnique({ where: { id: board.pollId } });
      if (!poll) {
        throw retroError('Associated poll not found', 'NOT_FOUND');
      }

      // Fetch lanes, cards, votes, and action items in parallel
      const [lanes, cards, votes, actionItems] = await Promise.all([
        prisma.retroLane.findMany({
          where: { boardId: board.id },
          orderBy: { displayOrder: 'asc' },
        }),
        prisma.retroCard.findMany({ where: { boardId: board.id } }),
        prisma.retroVote.findMany({ where: { boardId: board.id } }),
        prisma.retroActionItem.findMany({
          where: { boardId: board.id },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      // Compute vote counts per card
      const voteCounts = new Map<string, number>();
      for (const vote of votes) {
        voteCounts.set(vote.cardId, (voteCounts.get(vote.cardId) ?? 0) + 1);
      }

      // Build PdfExportData structure
      const pdfData: PdfExportData = {
        boardTitle: poll.title,
        template: board.template,
        lanes: lanes.map((lane) => ({
          title: lane.title,
          icon: lane.icon,
          color: lane.color,
          cards: cards
            .filter((c) => c.laneId === lane.id)
            .map((card) => ({
              text: card.text,
              authorName: card.authorName,
              voteCount: voteCounts.get(card.id) ?? 0,
            }))
            .sort((a, b) => b.voteCount - a.voteCount),
        })),
        actionItems: actionItems.map((item) => ({
          text: item.text,
          owner: item.owner,
          dueDate: item.dueDate ? item.dueDate.toISOString() : null,
        })),
      };

      return generateRetroPdf(pdfData);
    },
  };
}

/**
 * Singleton retro service instance for use across the application.
 */
export const retroService = createRetroService();
