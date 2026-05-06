import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { config } from '@/lib/config';
import { auditLogger, AuditLogger } from './auditLogger';

/**
 * Result of a retention purge operation.
 */
export interface PurgeResult {
  responsesDeleted: number;
  auditLogsDeleted: number;
  pollsHardDeleted: number;
}

/**
 * Interface for the retention service.
 */
export interface RetentionService {
  purge(): Promise<PurgeResult>;
}

/**
 * Creates a retention service instance that purges old data based on configured thresholds.
 *
 * - Responses older than RETENTION_RESPONSES_DAYS (default 90) are deleted
 * - Audit logs older than RETENTION_AUDIT_DAYS (default 365) are deleted
 * - Soft-deleted polls older than 30 days are hard-deleted
 * - Same retention policy applies to both test and real responses
 * - Logs DATA_PURGED action via AuditLogger with counts
 */
export function createRetentionService(
  db: PrismaClient = prisma,
  logger: AuditLogger = auditLogger
): RetentionService {
  return {
    async purge(): Promise<PurgeResult> {
      const now = new Date();

      // Calculate cutoff dates
      const responseCutoff = new Date(now);
      responseCutoff.setDate(responseCutoff.getDate() - config.RETENTION_RESPONSES_DAYS);

      const auditLogCutoff = new Date(now);
      auditLogCutoff.setDate(auditLogCutoff.getDate() - config.RETENTION_AUDIT_DAYS);

      const pollHardDeleteCutoff = new Date(now);
      pollHardDeleteCutoff.setDate(pollHardDeleteCutoff.getDate() - 30);

      // Delete responses older than retention threshold (both test and real)
      const responsesResult = await db.response.deleteMany({
        where: {
          createdAt: {
            lt: responseCutoff,
          },
        },
      });

      // Delete audit logs older than retention threshold
      const auditLogsResult = await db.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: auditLogCutoff,
          },
        },
      });

      // Hard-delete soft-deleted polls older than 30 days
      // First, delete related records for those polls
      const pollsToDelete = await db.poll.findMany({
        where: {
          isDeleted: true,
          updatedAt: {
            lt: pollHardDeleteCutoff,
          },
        },
        select: { id: true },
      });

      const pollIds = pollsToDelete.map((p) => p.id);
      let pollsHardDeleted = 0;

      if (pollIds.length > 0) {
        // Delete related responses first
        await db.response.deleteMany({
          where: { pollId: { in: pollIds } },
        });

        // Delete related audit logs
        await db.auditLog.deleteMany({
          where: { pollId: { in: pollIds } },
        });

        // Delete related questions
        await db.question.deleteMany({
          where: { pollId: { in: pollIds } },
        });

        // Hard-delete the polls
        const pollsResult = await db.poll.deleteMany({
          where: { id: { in: pollIds } },
        });

        pollsHardDeleted = pollsResult.count;
      }

      const result: PurgeResult = {
        responsesDeleted: responsesResult.count,
        auditLogsDeleted: auditLogsResult.count,
        pollsHardDeleted,
      };

      // Log the purge action
      await logger.log({
        action: 'DATA_PURGED',
        actor: 'system',
        metadata: {
          responsesDeleted: result.responsesDeleted,
          auditLogsDeleted: result.auditLogsDeleted,
          pollsHardDeleted: result.pollsHardDeleted,
        },
      });

      return result;
    },
  };
}

/**
 * Singleton retention service instance for use across the application.
 */
export const retentionService = createRetentionService();
