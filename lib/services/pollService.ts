import { Poll, Question, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { auditLogger, PrismaTransactionClient } from './auditLogger';
import { tokenService } from './tokenService';
import { CreatePollInput, UpdatePollInput } from '@/lib/validators/schemas';

/**
 * Default facilitator state for newly created polls.
 */
const DEFAULT_FACILITATOR_STATE = {
  _v: 1,
  votingOpen: false,
  liveResults: false,
  anonymise: true,
  revealStage: 'HIDDEN',
};

/**
 * Public view of a poll for participants.
 */
export interface PublicPollView {
  id: string;
  title: string;
  description: string | null;
  backgroundImageUrl: string | null;
  facilitatorState: {
    votingOpen: boolean;
    liveResults: boolean;
    anonymise: boolean;
    revealStage: string;
  };
  questions: Array<{
    id: string;
    text: string;
    options: unknown;
    allowCustom: boolean;
    position: unknown;
    displayOrder: number;
  }>;
}

/**
 * Interface for the Poll Service.
 */
export interface PollService {
  createPoll(data: CreatePollInput, userId: string): Promise<Poll>;
  updatePoll(id: string, data: UpdatePollInput, userId: string): Promise<Poll | null>;
  deletePoll(id: string, userId: string): Promise<boolean>;
  clonePoll(id: string, userId: string): Promise<Poll | null>;
  resetResponses(id: string, userId: string): Promise<boolean>;
  getPoll(id: string, userId: string): Promise<Poll | null>;
  listPolls(userId: string): Promise<Poll[]>;
  listPublicPolls(): Promise<Poll[]>;
  listPublicPollsByTeam(teamId: string): Promise<Poll[]>;
  listPollsByTeam(userId: string, teamId: string): Promise<Poll[]>;
  getPublicPoll(id: string): Promise<PublicPollView | null>;
  getPublicPollByToken(token: string): Promise<PublicPollView | null>;
}

/**
 * Creates a PollService instance with all poll management operations.
 * All mutations are logged via the AuditLogger within the same transaction.
 */
export function createPollService(): PollService {
  return {
    async createPoll(data: CreatePollInput, userId: string): Promise<Poll> {
      const poll = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        const accessToken = tokenService.generateToken();

        const created = await tx.poll.create({
          data: {
            title: data.title,
            description: data.description ?? null,
            userId,
            teamId: data.teamId ?? null,
            accessToken,
            facilitatorState: DEFAULT_FACILITATOR_STATE as unknown as Prisma.InputJsonValue,
          },
        });

        await auditLogger.log(
          {
            pollId: created.id,
            action: 'POLL_CREATED',
            actor: userId,
            metadata: { title: created.title },
          },
          tx,
        );

        return created;
      });

      return poll;
    },

    async updatePoll(id: string, data: UpdatePollInput, userId: string): Promise<Poll | null> {
      const existing = await prisma.poll.findFirst({
        where: { id, userId, isDeleted: false },
      });

      if (!existing) {
        return null;
      }

      const poll = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        const updated = await tx.poll.update({
          where: { id },
          data: {
            ...(data.title !== undefined && { title: data.title }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.backgroundImageUrl !== undefined && { backgroundImageUrl: data.backgroundImageUrl }),
            ...(data.teamId !== undefined && { teamId: data.teamId }),
          },
        });

        await auditLogger.log(
          {
            pollId: updated.id,
            action: 'POLL_UPDATED',
            actor: userId,
            metadata: { updatedFields: Object.keys(data) },
          },
          tx,
        );

        return updated;
      });

      return poll;
    },

    async deletePoll(id: string, userId: string): Promise<boolean> {
      const existing = await prisma.poll.findFirst({
        where: { id, userId, isDeleted: false },
      });

      if (!existing) {
        return false;
      }

      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        await tx.poll.update({
          where: { id },
          data: { isDeleted: true },
        });

        await auditLogger.log(
          {
            pollId: id,
            action: 'POLL_DELETED',
            actor: userId,
          },
          tx,
        );
      });

      return true;
    },

    async clonePoll(id: string, userId: string): Promise<Poll | null> {
      const existing = await prisma.poll.findFirst({
        where: { id, userId, isDeleted: false },
        include: { questions: true },
      });

      if (!existing) {
        return null;
      }

      const poll = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        const accessToken = tokenService.generateToken();

        const cloned = await tx.poll.create({
          data: {
            title: `${existing.title} (Copy)`,
            description: existing.description,
            backgroundImageUrl: existing.backgroundImageUrl,
            userId,
            accessToken,
            facilitatorState: DEFAULT_FACILITATOR_STATE as unknown as Prisma.InputJsonValue,
          },
        });

        // Duplicate all questions
        if (existing.questions.length > 0) {
          await tx.question.createMany({
            data: existing.questions.map((q: Question) => ({
              pollId: cloned.id,
              text: q.text,
              options: q.options as Prisma.InputJsonValue,
              allowCustom: q.allowCustom,
              position: q.position as Prisma.InputJsonValue ?? undefined,
              displayOrder: q.displayOrder,
            })),
          });
        }

        await auditLogger.log(
          {
            pollId: cloned.id,
            action: 'POLL_CLONED',
            actor: userId,
            metadata: { sourcePollId: id, newPollId: cloned.id },
          },
          tx,
        );

        return cloned;
      });

      return poll;
    },

    async resetResponses(id: string, userId: string): Promise<boolean> {
      const existing = await prisma.poll.findFirst({
        where: { id, userId, isDeleted: false },
      });

      if (!existing) {
        return false;
      }

      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        const { count } = await tx.response.deleteMany({
          where: { pollId: id },
        });

        await auditLogger.log(
          {
            pollId: id,
            action: 'RESPONSES_RESET',
            actor: userId,
            metadata: { deletedCount: count },
          },
          tx,
        );
      });

      return true;
    },

    async getPoll(id: string, userId: string): Promise<Poll | null> {
      return prisma.poll.findFirst({
        where: { id, userId, isDeleted: false },
      });
    },

    async listPolls(userId: string): Promise<Poll[]> {
      return prisma.poll.findMany({
        where: { userId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
      });
    },

    async listPublicPolls(): Promise<Poll[]> {
      return prisma.poll.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
      });
    },

    async listPublicPollsByTeam(teamId: string): Promise<Poll[]> {
      return prisma.poll.findMany({
        where: {
          isDeleted: false,
          OR: [
            { teamId },
            { teamId: null },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    },

    async listPollsByTeam(userId: string, teamId: string): Promise<Poll[]> {
      return prisma.poll.findMany({
        where: { userId, teamId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
      });
    },

    async getPublicPoll(id: string): Promise<PublicPollView | null> {
      const poll = await prisma.poll.findFirst({
        where: { id, isDeleted: false },
        include: {
          questions: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });

      if (!poll) {
        return null;
      }

      const state = poll.facilitatorState as Record<string, unknown>;

      return {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        backgroundImageUrl: poll.backgroundImageUrl,
        facilitatorState: {
          votingOpen: Boolean(state.votingOpen),
          liveResults: Boolean(state.liveResults),
          anonymise: Boolean(state.anonymise),
          revealStage: String(state.revealStage ?? 'HIDDEN'),
        },
        questions: poll.questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
          allowCustom: q.allowCustom,
          position: q.position,
          displayOrder: q.displayOrder,
        })),
      };
    },

    async getPublicPollByToken(token: string): Promise<PublicPollView | null> {
      const poll = await prisma.poll.findUnique({
        where: { accessToken: token },
        include: {
          questions: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });

      if (!poll) {
        return null;
      }

      // Reject deleted polls
      if (poll.isDeleted) {
        return null;
      }

      // Reject expired tokens
      if (poll.tokenExpiresAt && new Date() > poll.tokenExpiresAt) {
        return null;
      }

      const state = poll.facilitatorState as Record<string, unknown>;

      return {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        backgroundImageUrl: poll.backgroundImageUrl,
        facilitatorState: {
          votingOpen: Boolean(state.votingOpen),
          liveResults: Boolean(state.liveResults),
          anonymise: Boolean(state.anonymise),
          revealStage: String(state.revealStage ?? 'HIDDEN'),
        },
        questions: poll.questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
          allowCustom: q.allowCustom,
          position: q.position,
          displayOrder: q.displayOrder,
        })),
      };
    },
  };
}

/**
 * Singleton poll service instance for use across the application.
 */
export const pollService = createPollService();
