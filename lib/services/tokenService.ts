import crypto from 'crypto';
import { prisma } from '@/lib/db/client';
import { auditLogger, PrismaTransactionClient } from './auditLogger';

/**
 * Validated poll data returned by token validation.
 */
export interface ValidatedPoll {
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
 * Interface for the Token Service.
 */
export interface TokenService {
  /** Generate a new cryptographically secure access token (32-char base64url). */
  generateToken(): string;

  /** Validate a token and return the associated poll, or null if invalid/expired/deleted. */
  validateToken(token: string): Promise<ValidatedPoll | null>;

  /** Regenerate the access token for a poll. Verifies ownership, generates new token, logs audit. */
  regenerateToken(pollId: string, userId: string): Promise<{ accessToken: string } | null>;

  /** Construct the full poll URL from a token. */
  buildPollUrl(token: string): string;
}

/**
 * Creates a TokenService instance for access token lifecycle management.
 * Follows the same factory pattern as other services in the project.
 */
export function createTokenService(): TokenService {
  return {
    generateToken(): string {
      // 24 random bytes → 32 characters in base64url encoding
      // Provides 192 bits of entropy, URL-safe (A-Z, a-z, 0-9, -, _)
      return crypto.randomBytes(24).toString('base64url');
    },

    async validateToken(token: string): Promise<ValidatedPoll | null> {
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

    async regenerateToken(pollId: string, userId: string): Promise<{ accessToken: string } | null> {
      // Verify the poll exists and belongs to the user
      const existing = await prisma.poll.findFirst({
        where: { id: pollId, userId, isDeleted: false },
      });

      if (!existing) {
        return null;
      }

      const newToken = crypto.randomBytes(24).toString('base64url');

      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        await tx.poll.update({
          where: { id: pollId },
          data: { accessToken: newToken },
        });

        await auditLogger.log(
          {
            pollId,
            action: 'TOKEN_REGENERATED',
            actor: userId,
            metadata: { previousTokenPrefix: existing.accessToken.slice(0, 8) },
          },
          tx,
        );
      });

      return { accessToken: newToken };
    },

    buildPollUrl(token: string): string {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return `${baseUrl}/poll/${token}`;
    },
  };
}

/**
 * Singleton token service instance for use across the application.
 */
export const tokenService = createTokenService();
