import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';

/**
 * All auditable actions in the system.
 */
export type AuditAction =
  | 'POLL_CREATED'
  | 'POLL_UPDATED'
  | 'POLL_DELETED'
  | 'POLL_CLONED'
  | 'QUESTION_CREATED'
  | 'QUESTION_UPDATED'
  | 'QUESTION_DELETED'
  | 'RESPONSES_SUBMITTED'
  | 'RESPONSES_RESET'
  | 'FACILITATOR_SESSION_STARTED'
  | 'FACILITATOR_STATE_UPDATED'
  | 'REVEAL_STAGE_CHANGED'
  | 'VOTING_OPENED'
  | 'VOTING_CLOSED'
  | 'DATA_PURGED';

/**
 * An audit log entry to be recorded.
 */
export interface AuditEntry {
  pollId?: string;
  action: AuditAction;
  actor: string;
  metadata?: Record<string, unknown>;
}

/**
 * A Prisma transaction client that can be passed to the audit logger
 * to ensure logging happens within the same transaction as the triggering action.
 */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Interface for the audit logging service.
 */
export interface AuditLogger {
  log(entry: AuditEntry, tx?: PrismaTransactionClient): Promise<void>;
}

/**
 * Creates an audit logger instance that records immutable audit log entries.
 * Entries are stored with a `createdAt` timestamp only (no `updatedAt`).
 * Supports logging within a Prisma transaction for atomicity.
 */
export function createAuditLogger(): AuditLogger {
  return {
    async log(entry: AuditEntry, tx?: PrismaTransactionClient): Promise<void> {
      const client = tx ?? prisma;

      await client.auditLog.create({
        data: {
          pollId: entry.pollId ?? null,
          action: entry.action,
          actor: entry.actor,
          metadata: entry.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
        },
      });
    },
  };
}

/**
 * Singleton audit logger instance for use across the application.
 */
export const auditLogger = createAuditLogger();
