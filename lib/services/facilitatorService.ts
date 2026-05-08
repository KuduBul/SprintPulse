import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { auditLogger, PrismaTransactionClient } from './auditLogger';

/**
 * Reveal stage options for facilitator control.
 */
export type RevealStage = 'HIDDEN' | 'COUNTS' | 'DETAILS';

/**
 * The typed facilitator state exposed to consumers.
 */
export interface FacilitatorState {
  votingOpen: boolean;
  liveResults: boolean;
  anonymise: boolean;
  revealStage: RevealStage;
}

/**
 * Internal stored state includes the schema version key.
 */
interface StoredFacilitatorState extends FacilitatorState {
  _v: number;
}

/**
 * Interface for the Facilitator Service.
 */
export interface FacilitatorService {
  getState(pollId: string): Promise<FacilitatorState>;
  updateState(pollId: string, patch: Partial<FacilitatorState>, userId?: string): Promise<FacilitatorState>;
}

/**
 * Default facilitator state for schema versioning.
 */
const DEFAULT_STORED_STATE: StoredFacilitatorState = {
  _v: 1,
  votingOpen: false,
  liveResults: false,
  anonymise: true,
  revealStage: 'HIDDEN',
};

/**
 * Parses the raw JSON facilitator state from the database,
 * handling schema versioning via the `_v` key.
 */
function parseStoredState(raw: unknown): StoredFacilitatorState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STORED_STATE };
  }

  const obj = raw as Record<string, unknown>;

  // Handle schema versioning - currently only v1
  // Future versions can add migration logic here
  return {
    _v: typeof obj._v === 'number' ? obj._v : 1,
    votingOpen: typeof obj.votingOpen === 'boolean' ? obj.votingOpen : false,
    liveResults: typeof obj.liveResults === 'boolean' ? obj.liveResults : false,
    anonymise: typeof obj.anonymise === 'boolean' ? obj.anonymise : true,
    revealStage: isValidRevealStage(obj.revealStage) ? obj.revealStage : 'HIDDEN',
  };
}

/**
 * Type guard for RevealStage values.
 */
function isValidRevealStage(value: unknown): value is RevealStage {
  return value === 'HIDDEN' || value === 'COUNTS' || value === 'DETAILS';
}

/**
 * Extracts the public FacilitatorState (without `_v`) from the stored state.
 */
function toPublicState(stored: StoredFacilitatorState): FacilitatorState {
  return {
    votingOpen: stored.votingOpen,
    liveResults: stored.liveResults,
    anonymise: stored.anonymise,
    revealStage: stored.revealStage,
  };
}

/**
 * Creates a FacilitatorService instance for managing facilitator state.
 * All mutations are logged via the AuditLogger within the same transaction.
 */
export function createFacilitatorService(): FacilitatorService {
  return {
    async getState(pollId: string): Promise<FacilitatorState> {
      const poll = await prisma.poll.findFirstOrThrow({
        where: { id: pollId },
        select: { facilitatorState: true },
      });

      const stored = parseStoredState(poll.facilitatorState);
      return toPublicState(stored);
    },

    async updateState(pollId: string, patch: Partial<FacilitatorState>, userId?: string): Promise<FacilitatorState> {
      const result = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // Read current state
        const poll = await tx.poll.findFirstOrThrow({
          where: { id: pollId },
          select: { facilitatorState: true },
        });

        const currentStored = parseStoredState(poll.facilitatorState);
        const currentPublic = toPublicState(currentStored);

        // Merge patch into current state (last-write-wins)
        const merged: StoredFacilitatorState = {
          _v: currentStored._v,
          votingOpen: patch.votingOpen !== undefined ? patch.votingOpen : currentStored.votingOpen,
          liveResults: patch.liveResults !== undefined ? patch.liveResults : currentStored.liveResults,
          anonymise: patch.anonymise !== undefined ? patch.anonymise : currentStored.anonymise,
          revealStage: patch.revealStage !== undefined ? patch.revealStage : currentStored.revealStage,
        };

        // Persist the merged state
        await tx.poll.update({
          where: { id: pollId },
          data: {
            facilitatorState: merged as unknown as Prisma.InputJsonValue,
          },
        });

        // Log specific actions based on what changed
        if (patch.votingOpen !== undefined && patch.votingOpen !== currentPublic.votingOpen) {
          if (patch.votingOpen === true) {
            await auditLogger.log(
              {
                pollId,
                action: 'VOTING_OPENED',
                actor: userId || 'admin',
                metadata: { previousState: currentPublic.votingOpen },
              },
              tx,
            );
          } else {
            await auditLogger.log(
              {
                pollId,
                action: 'VOTING_CLOSED',
                actor: userId || 'admin',
                metadata: { previousState: currentPublic.votingOpen },
              },
              tx,
            );
          }
        }

        if (patch.revealStage !== undefined && patch.revealStage !== currentPublic.revealStage) {
          await auditLogger.log(
            {
              pollId,
              action: 'REVEAL_STAGE_CHANGED',
              actor: userId || 'admin',
              metadata: {
                from: currentPublic.revealStage,
                to: patch.revealStage,
              },
            },
            tx,
          );
        }

        // Always log FACILITATOR_STATE_UPDATED for any state change
        await auditLogger.log(
          {
            pollId,
            action: 'FACILITATOR_STATE_UPDATED',
            actor: userId || 'admin',
            metadata: {
              patch,
              previousState: currentPublic,
              newState: toPublicState(merged),
            },
          },
          tx,
        );

        return toPublicState(merged);
      });

      return result;
    },
  };
}

/**
 * Singleton facilitator service instance for use across the application.
 */
export const facilitatorService = createFacilitatorService();
