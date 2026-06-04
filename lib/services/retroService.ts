import { RetroBoard, RetroCard } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { auditLogger, PrismaTransactionClient } from './auditLogger';

/**
 * The retro lifecycle phases. The board advances gather → vote → closed.
 */
export type RetroPhase = 'gather' | 'vote' | 'closed';

/**
 * Built-in retro templates. "custom" lets the facilitator supply their own
 * lane titles; the others expand to a fixed, ordered set of lanes.
 */
export type RetroTemplate = 'start_stop_continue' | '4ls' | 'mad_sad_glad' | 'custom';

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
 */
export interface BoardLaneView {
  id: string;
  title: string;
  displayOrder: number;
  position: unknown;
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
}

/** Default per-user vote cap for a newly created board (Requirement 3.7). */
const DEFAULT_VOTES_PER_USER = 3;

/** Lane count bounds enforced on every board (Requirement 3.4). */
const MIN_LANES = 1;
const MAX_LANES = 8;

/** Maximum lane title length (Requirement 3.5). */
const MAX_LANE_TITLE_LENGTH = 100;

/**
 * Built-in template → ordered lane titles (Requirement 3.1, 3.2).
 * Keyed by string so an unrecognised template is caught at runtime.
 */
const TEMPLATE_LANES: Record<string, string[]> = {
  start_stop_continue: ['Start', 'Stop', 'Continue'],
  '4ls': ['Liked', 'Learned', 'Lacked', 'Longed For'],
  mad_sad_glad: ['Mad', 'Sad', 'Glad'],
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
     * Returns a per-viewer projection of the board. Author identity is stripped
     * for cards the viewer does not own while the board is not yet closed; a
     * facilitator and the closed board expose authors.
     *
     * NOTE (task 4.1 scaffold): this applies the basic owner/facilitator
     * anonymity rule. The full reveal-stage handling (Requirement 6) lands in
     * task 4.4.
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

      const board_phase = board.phase as RetroPhase;
      const revealAuthors = viewer.role === 'facilitator' || board_phase === 'closed';

      const cardsByLane = new Map<string, BoardCardView[]>();
      for (const card of cards) {
        const isOwn =
          viewer.role === 'participant' && card.authorToken === viewer.participantToken;
        const exposeIdentity = revealAuthors || isOwn;

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

      return {
        id: board.id,
        pollId: board.pollId,
        template: board.template,
        phase: board_phase,
        votesPerUser: board.votesPerUser,
        lanes: lanes.map((lane) => ({
          id: lane.id,
          title: lane.title,
          displayOrder: lane.displayOrder,
          position: lane.position,
          cards: cardsByLane.get(lane.id) ?? [],
        })),
      };
    },

    // The following participant/facilitator operations are implemented in
    // tasks 4.2–4.4. They are declared here so the full RetroService interface
    // is available to dependents; calling them now throws a clear error.

    async addCard(): Promise<RetroCard> {
      throw retroError('retroService.addCard is not implemented yet', 'NOT_IMPLEMENTED');
    },

    async editCard(): Promise<RetroCard> {
      throw retroError('retroService.editCard is not implemented yet', 'NOT_IMPLEMENTED');
    },

    async deleteCard(): Promise<void> {
      throw retroError('retroService.deleteCard is not implemented yet', 'NOT_IMPLEMENTED');
    },

    async castVote(): Promise<void> {
      throw retroError('retroService.castVote is not implemented yet', 'NOT_IMPLEMENTED');
    },

    async removeVote(): Promise<void> {
      throw retroError('retroService.removeVote is not implemented yet', 'NOT_IMPLEMENTED');
    },

    async setPhase(): Promise<RetroBoard> {
      throw retroError('retroService.setPhase is not implemented yet', 'NOT_IMPLEMENTED');
    },

    async exportBoard(): Promise<ExportPayload> {
      throw retroError('retroService.exportBoard is not implemented yet', 'NOT_IMPLEMENTED');
    },
  };
}

/**
 * Singleton retro service instance for use across the application.
 */
export const retroService = createRetroService();
