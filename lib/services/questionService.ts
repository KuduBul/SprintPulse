import { Question, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { auditLogger, PrismaTransactionClient } from './auditLogger';
import { CreateQuestionInput, UpdateQuestionInput } from '@/lib/validators/schemas';

/**
 * Interface for the Question Service.
 */
export interface QuestionService {
  createQuestion(pollId: string, data: CreateQuestionInput, userId?: string): Promise<Question>;
  updateQuestion(id: string, data: UpdateQuestionInput, userId?: string): Promise<Question>;
  deleteQuestion(id: string, userId?: string): Promise<void>;
  reorderQuestions(pollId: string, order: string[], userId?: string): Promise<void>;
}

/**
 * Creates a QuestionService instance with all question management operations.
 * All mutations are logged via the AuditLogger within the same transaction.
 */
export function createQuestionService(): QuestionService {
  return {
    async createQuestion(pollId: string, data: CreateQuestionInput, userId?: string): Promise<Question> {
      const question = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        const created = await tx.question.create({
          data: {
            pollId,
            text: data.text,
            options: data.options as unknown as Prisma.InputJsonValue,
            allowCustom: data.allowCustom,
            position: data.position as unknown as Prisma.InputJsonValue ?? Prisma.JsonNull,
            displayOrder: data.displayOrder,
          },
        });

        await auditLogger.log(
          {
            pollId,
            action: 'QUESTION_CREATED',
            actor: userId || 'admin',
            metadata: { questionId: created.id, text: created.text },
          },
          tx,
        );

        return created;
      });

      return question;
    },

    async updateQuestion(id: string, data: UpdateQuestionInput, userId?: string): Promise<Question> {
      const question = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        const updateData: Record<string, unknown> = {};

        if (data.text !== undefined) {
          updateData.text = data.text;
        }
        if (data.options !== undefined) {
          updateData.options = data.options as unknown as Prisma.InputJsonValue;
        }
        if (data.allowCustom !== undefined) {
          updateData.allowCustom = data.allowCustom;
        }
        if (data.position !== undefined) {
          updateData.position = data.position === null
            ? Prisma.JsonNull
            : (data.position as unknown as Prisma.InputJsonValue);
        }
        if (data.displayOrder !== undefined) {
          updateData.displayOrder = data.displayOrder;
        }

        const updated = await tx.question.update({
          where: { id },
          data: updateData,
        });

        await auditLogger.log(
          {
            pollId: updated.pollId,
            action: 'QUESTION_UPDATED',
            actor: userId || 'admin',
            metadata: { questionId: updated.id, updatedFields: Object.keys(data) },
          },
          tx,
        );

        return updated;
      });

      return question;
    },

    async deleteQuestion(id: string, userId?: string): Promise<void> {
      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        const question = await tx.question.delete({
          where: { id },
        });

        await auditLogger.log(
          {
            pollId: question.pollId,
            action: 'QUESTION_DELETED',
            actor: userId || 'admin',
            metadata: { questionId: id },
          },
          tx,
        );
      });
    },

    async reorderQuestions(pollId: string, order: string[], userId?: string): Promise<void> {
      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // Update each question's displayOrder based on its position in the order array
        for (let i = 0; i < order.length; i++) {
          await tx.question.update({
            where: { id: order[i] },
            data: { displayOrder: i },
          });
        }

        await auditLogger.log(
          {
            pollId,
            action: 'QUESTION_UPDATED',
            actor: userId || 'admin',
            metadata: { reordered: true, questionIds: order },
          },
          tx,
        );
      });
    },
  };
}

/**
 * Singleton question service instance for use across the application.
 */
export const questionService = createQuestionService();
