import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createQuestionService } from '@/lib/services/questionService';

// Mock the Prisma client
const mockPrisma = {
  $transaction: vi.fn(),
  question: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock('@/lib/db/client', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/services/auditLogger', () => ({
  auditLogger: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import { auditLogger } from '@/lib/services/auditLogger';

describe('QuestionService', () => {
  let questionService: ReturnType<typeof createQuestionService>;

  beforeEach(() => {
    vi.clearAllMocks();
    questionService = createQuestionService();
  });

  describe('createQuestion', () => {
    it('creates a question with all fields', async () => {
      const mockQuestion = {
        id: 'q-1',
        pollId: 'poll-1',
        text: 'What is your favorite color?',
        options: ['Red', 'Blue', 'Green'],
        allowCustom: false,
        position: null,
        displayOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            create: vi.fn().mockResolvedValue(mockQuestion),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await questionService.createQuestion('poll-1', {
        text: 'What is your favorite color?',
        options: ['Red', 'Blue', 'Green'],
        allowCustom: false,
        position: null,
        displayOrder: 0,
      });

      expect(result).toEqual(mockQuestion);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('creates a question with position data', async () => {
      const position = { x: 25, y: 10, width: 30, height: 20 };
      const mockQuestion = {
        id: 'q-2',
        pollId: 'poll-1',
        text: 'Rate this session',
        options: ['1', '2', '3', '4', '5'],
        allowCustom: true,
        position,
        displayOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            create: vi.fn().mockResolvedValue(mockQuestion),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await questionService.createQuestion('poll-1', {
        text: 'Rate this session',
        options: ['1', '2', '3', '4', '5'],
        allowCustom: true,
        position,
        displayOrder: 1,
      });

      expect(result.position).toEqual(position);
      expect(result.allowCustom).toBe(true);
    });

    it('logs QUESTION_CREATED via audit logger', async () => {
      const mockQuestion = {
        id: 'q-3',
        pollId: 'poll-1',
        text: 'Audit test question',
        options: ['A', 'B'],
        allowCustom: false,
        position: null,
        displayOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            create: vi.fn().mockResolvedValue(mockQuestion),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await questionService.createQuestion('poll-1', {
        text: 'Audit test question',
        options: ['A', 'B'],
        allowCustom: false,
        position: null,
        displayOrder: 0,
      });

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          pollId: 'poll-1',
          action: 'QUESTION_CREATED',
          actor: 'admin',
          metadata: { questionId: 'q-3', text: 'Audit test question' },
        }),
        expect.anything(),
      );
    });

    it('passes correct data to Prisma create', async () => {
      let createData: any;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            create: vi.fn().mockImplementation((args: any) => {
              createData = args.data;
              return {
                id: 'q-4',
                ...args.data,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await questionService.createQuestion('poll-1', {
        text: 'Test question',
        options: ['Yes', 'No'],
        allowCustom: true,
        position: { x: 50, y: 50, width: 20, height: 15 },
        displayOrder: 2,
      });

      expect(createData.pollId).toBe('poll-1');
      expect(createData.text).toBe('Test question');
      expect(createData.options).toEqual(['Yes', 'No']);
      expect(createData.allowCustom).toBe(true);
      expect(createData.displayOrder).toBe(2);
    });
  });

  describe('updateQuestion', () => {
    it('updates question text', async () => {
      const mockUpdated = {
        id: 'q-1',
        pollId: 'poll-1',
        text: 'Updated question text',
        options: ['A', 'B'],
        allowCustom: false,
        position: null,
        displayOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            update: vi.fn().mockResolvedValue(mockUpdated),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await questionService.updateQuestion('q-1', { text: 'Updated question text' });

      expect(result.text).toBe('Updated question text');
    });

    it('updates question options', async () => {
      const mockUpdated = {
        id: 'q-1',
        pollId: 'poll-1',
        text: 'Question',
        options: ['New A', 'New B', 'New C'],
        allowCustom: false,
        position: null,
        displayOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            update: vi.fn().mockResolvedValue(mockUpdated),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await questionService.updateQuestion('q-1', {
        options: ['New A', 'New B', 'New C'],
      });

      expect(result.options).toEqual(['New A', 'New B', 'New C']);
    });

    it('updates allowCustom flag', async () => {
      const mockUpdated = {
        id: 'q-1',
        pollId: 'poll-1',
        text: 'Question',
        options: ['A', 'B'],
        allowCustom: true,
        position: null,
        displayOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            update: vi.fn().mockResolvedValue(mockUpdated),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await questionService.updateQuestion('q-1', { allowCustom: true });

      expect(result.allowCustom).toBe(true);
    });

    it('updates position to a new value', async () => {
      const newPosition = { x: 30, y: 40, width: 25, height: 20 };
      const mockUpdated = {
        id: 'q-1',
        pollId: 'poll-1',
        text: 'Question',
        options: ['A', 'B'],
        allowCustom: false,
        position: newPosition,
        displayOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            update: vi.fn().mockResolvedValue(mockUpdated),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await questionService.updateQuestion('q-1', { position: newPosition });

      expect(result.position).toEqual(newPosition);
    });

    it('updates position to null (removes from canvas)', async () => {
      let updateData: any;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            update: vi.fn().mockImplementation((args: any) => {
              updateData = args.data;
              return {
                id: 'q-1',
                pollId: 'poll-1',
                text: 'Question',
                options: ['A', 'B'],
                allowCustom: false,
                position: null,
                displayOrder: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await questionService.updateQuestion('q-1', { position: null });

      // Prisma.JsonNull is used to set JSON fields to null
      expect(updateData.position).toBeDefined();
    });

    it('updates displayOrder', async () => {
      const mockUpdated = {
        id: 'q-1',
        pollId: 'poll-1',
        text: 'Question',
        options: ['A', 'B'],
        allowCustom: false,
        position: null,
        displayOrder: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            update: vi.fn().mockResolvedValue(mockUpdated),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await questionService.updateQuestion('q-1', { displayOrder: 3 });

      expect(result.displayOrder).toBe(3);
    });

    it('logs QUESTION_UPDATED via audit logger with updated fields', async () => {
      const mockUpdated = {
        id: 'q-1',
        pollId: 'poll-1',
        text: 'Updated',
        options: ['A', 'B', 'C'],
        allowCustom: false,
        position: null,
        displayOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            update: vi.fn().mockResolvedValue(mockUpdated),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await questionService.updateQuestion('q-1', {
        text: 'Updated',
        options: ['A', 'B', 'C'],
      });

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          pollId: 'poll-1',
          action: 'QUESTION_UPDATED',
          actor: 'admin',
          metadata: { questionId: 'q-1', updatedFields: ['text', 'options'] },
        }),
        expect.anything(),
      );
    });

    it('only includes provided fields in the update data', async () => {
      let updateArgs: any;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            update: vi.fn().mockImplementation((args: any) => {
              updateArgs = args;
              return {
                id: 'q-1',
                pollId: 'poll-1',
                text: 'New text',
                options: ['A', 'B'],
                allowCustom: false,
                position: null,
                displayOrder: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await questionService.updateQuestion('q-1', { text: 'New text' });

      expect(updateArgs.where).toEqual({ id: 'q-1' });
      expect(updateArgs.data).toHaveProperty('text', 'New text');
      expect(updateArgs.data).not.toHaveProperty('options');
      expect(updateArgs.data).not.toHaveProperty('allowCustom');
      expect(updateArgs.data).not.toHaveProperty('displayOrder');
    });
  });

  describe('deleteQuestion', () => {
    it('deletes a question by id', async () => {
      let deleteArgs: any;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            delete: vi.fn().mockImplementation((args: any) => {
              deleteArgs = args;
              return { id: 'q-1', pollId: 'poll-1' };
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await questionService.deleteQuestion('q-1');

      expect(deleteArgs.where).toEqual({ id: 'q-1' });
    });

    it('logs QUESTION_DELETED via audit logger', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            delete: vi.fn().mockResolvedValue({ id: 'q-1', pollId: 'poll-1' }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await questionService.deleteQuestion('q-1');

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          pollId: 'poll-1',
          action: 'QUESTION_DELETED',
          actor: 'admin',
          metadata: { questionId: 'q-1' },
        }),
        expect.anything(),
      );
    });
  });

  describe('reorderQuestions', () => {
    it('updates displayOrder for all questions in the order array', async () => {
      const updateCalls: Array<{ where: any; data: any }> = [];
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            update: vi.fn().mockImplementation((args: any) => {
              updateCalls.push({ where: args.where, data: args.data });
              return { id: args.where.id, displayOrder: args.data.displayOrder };
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await questionService.reorderQuestions('poll-1', ['q-3', 'q-1', 'q-2']);

      expect(updateCalls).toHaveLength(3);
      expect(updateCalls[0]).toEqual({ where: { id: 'q-3' }, data: { displayOrder: 0 } });
      expect(updateCalls[1]).toEqual({ where: { id: 'q-1' }, data: { displayOrder: 1 } });
      expect(updateCalls[2]).toEqual({ where: { id: 'q-2' }, data: { displayOrder: 2 } });
    });

    it('logs QUESTION_UPDATED via audit logger with reorder metadata', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            update: vi.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await questionService.reorderQuestions('poll-1', ['q-2', 'q-1']);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          pollId: 'poll-1',
          action: 'QUESTION_UPDATED',
          actor: 'admin',
          metadata: { reordered: true, questionIds: ['q-2', 'q-1'] },
        }),
        expect.anything(),
      );
    });

    it('handles empty order array without errors', async () => {
      const updateCalls: any[] = [];
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            update: vi.fn().mockImplementation((args: any) => {
              updateCalls.push(args);
              return {};
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await questionService.reorderQuestions('poll-1', []);

      expect(updateCalls).toHaveLength(0);
    });

    it('handles single question reorder', async () => {
      const updateCalls: Array<{ where: any; data: any }> = [];
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          question: {
            update: vi.fn().mockImplementation((args: any) => {
              updateCalls.push({ where: args.where, data: args.data });
              return { id: args.where.id, displayOrder: args.data.displayOrder };
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await questionService.reorderQuestions('poll-1', ['q-1']);

      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0]).toEqual({ where: { id: 'q-1' }, data: { displayOrder: 0 } });
    });
  });
});
