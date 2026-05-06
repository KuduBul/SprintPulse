import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createResponseService } from '@/lib/services/responseService';
import type { ResponseService } from '@/lib/services/responseService';

// Mock the Prisma client
const mockPrisma = {
  $transaction: vi.fn(),
  poll: {
    findUniqueOrThrow: vi.fn(),
  },
  question: {
    findMany: vi.fn(),
  },
  response: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
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

describe('ResponseService', () => {
  let responseService: ResponseService;

  beforeEach(() => {
    vi.clearAllMocks();
    responseService = createResponseService();
  });

  describe('submitResponses', () => {
    const basePoll = {
      id: 'poll-1',
      title: 'Test Poll',
      facilitatorState: { _v: 1, votingOpen: true, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
      questions: [
        { id: 'q1', pollId: 'poll-1', text: 'Q1?', options: ['A', 'B'], allowCustom: false, displayOrder: 0 },
        { id: 'q2', pollId: 'poll-1', text: 'Q2?', options: ['X', 'Y'], allowCustom: true, displayOrder: 1 },
      ],
    };

    const validSubmission = {
      participantName: 'Alice',
      sessionToken: '550e8400-e29b-41d4-a716-446655440000',
      answers: [
        { questionId: 'q1', selectedOption: 'A' },
        { questionId: 'q2', selectedOption: 'X', customText: 'My custom answer' },
      ],
      isTest: false,
    };

    it('persists responses when all validations pass', async () => {
      let createManyData: any;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(basePoll),
          },
          response: {
            findFirst: vi.fn().mockResolvedValue(null),
            createMany: vi.fn().mockImplementation((args: any) => {
              createManyData = args.data;
              return { count: 2 };
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await responseService.submitResponses('poll-1', validSubmission);

      expect(createManyData).toHaveLength(2);
      expect(createManyData[0]).toEqual({
        pollId: 'poll-1',
        questionId: 'q1',
        participantName: 'Alice',
        sessionToken: '550e8400-e29b-41d4-a716-446655440000',
        selectedOption: 'A',
        customText: null,
        isTest: false,
      });
      expect(createManyData[1].customText).toBe('My custom answer');
    });

    it('throws VOTING_CLOSED when voting is not open', async () => {
      const closedPoll = {
        ...basePoll,
        facilitatorState: { ...basePoll.facilitatorState, votingOpen: false },
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(closedPoll),
          },
          response: {
            findFirst: vi.fn(),
            createMany: vi.fn(),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await expect(responseService.submitResponses('poll-1', validSubmission))
        .rejects.toMatchObject({ code: 'VOTING_CLOSED' });
    });

    it('throws CONFLICT when session token already submitted', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(basePoll),
          },
          response: {
            findFirst: vi.fn().mockResolvedValue({ id: 'existing-response' }),
            createMany: vi.fn(),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await expect(responseService.submitResponses('poll-1', validSubmission))
        .rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('throws VALIDATION_ERROR when not all questions are answered', async () => {
      const incompleteSubmission = {
        ...validSubmission,
        answers: [{ questionId: 'q1', selectedOption: 'A' }], // missing q2
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(basePoll),
          },
          response: {
            findFirst: vi.fn().mockResolvedValue(null),
            createMany: vi.fn(),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await expect(responseService.submitResponses('poll-1', incompleteSubmission))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('throws VALIDATION_ERROR when extra questions are answered', async () => {
      const extraSubmission = {
        ...validSubmission,
        answers: [
          { questionId: 'q1', selectedOption: 'A' },
          { questionId: 'q2', selectedOption: 'X' },
          { questionId: 'q3', selectedOption: 'Z' }, // extra question not in poll
        ],
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(basePoll),
          },
          response: {
            findFirst: vi.fn().mockResolvedValue(null),
            createMany: vi.fn(),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await expect(responseService.submitResponses('poll-1', extraSubmission))
        .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('logs RESPONSES_SUBMITTED via audit logger', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(basePoll),
          },
          response: {
            findFirst: vi.fn().mockResolvedValue(null),
            createMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await responseService.submitResponses('poll-1', validSubmission);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          pollId: 'poll-1',
          action: 'RESPONSES_SUBMITTED',
          actor: 'Alice',
          metadata: {
            sessionToken: '550e8400-e29b-41d4-a716-446655440000',
            questionCount: 2,
            isTest: false,
          },
        }),
        expect.anything(),
      );
    });

    it('marks responses as isTest when isTest flag is true', async () => {
      let createManyData: any;
      const testSubmission = { ...validSubmission, isTest: true };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(basePoll),
          },
          response: {
            findFirst: vi.fn().mockResolvedValue(null),
            createMany: vi.fn().mockImplementation((args: any) => {
              createManyData = args.data;
              return { count: 2 };
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await responseService.submitResponses('poll-1', testSubmission);

      expect(createManyData[0].isTest).toBe(true);
      expect(createManyData[1].isTest).toBe(true);
    });
  });

  describe('hasSubmitted', () => {
    it('returns true when session token has already submitted', async () => {
      mockPrisma.response.findFirst.mockResolvedValue({ id: 'resp-1' });

      const result = await responseService.hasSubmitted('poll-1', 'token-123');

      expect(result).toBe(true);
      expect(mockPrisma.response.findFirst).toHaveBeenCalledWith({
        where: { pollId: 'poll-1', sessionToken: 'token-123' },
      });
    });

    it('returns false when session token has not submitted', async () => {
      mockPrisma.response.findFirst.mockResolvedValue(null);

      const result = await responseService.hasSubmitted('poll-1', 'token-new');

      expect(result).toBe(false);
    });
  });

  describe('getResults', () => {
    const mockQuestions = [
      { id: 'q1', pollId: 'poll-1', text: 'Favourite colour?', options: ['Red', 'Blue', 'Green'], allowCustom: true, displayOrder: 0 },
      { id: 'q2', pollId: 'poll-1', text: 'Best language?', options: ['TypeScript', 'Python'], allowCustom: false, displayOrder: 1 },
    ];

    const mockResponses = [
      { id: 'r1', pollId: 'poll-1', questionId: 'q1', participantName: 'Alice', sessionToken: 'token-a', selectedOption: 'Red', customText: null, isTest: false },
      { id: 'r2', pollId: 'poll-1', questionId: 'q1', participantName: 'Bob', sessionToken: 'token-b', selectedOption: 'Blue', customText: 'I love blue!', isTest: false },
      { id: 'r3', pollId: 'poll-1', questionId: 'q1', participantName: 'Charlie', sessionToken: 'token-c', selectedOption: 'Red', customText: null, isTest: false },
      { id: 'r4', pollId: 'poll-1', questionId: 'q2', participantName: 'Alice', sessionToken: 'token-a', selectedOption: 'TypeScript', customText: null, isTest: false },
      { id: 'r5', pollId: 'poll-1', questionId: 'q2', participantName: 'Bob', sessionToken: 'token-b', selectedOption: 'Python', customText: null, isTest: false },
      { id: 'r6', pollId: 'poll-1', questionId: 'q2', participantName: 'Charlie', sessionToken: 'token-c', selectedOption: 'TypeScript', customText: null, isTest: false },
    ];

    it('returns empty results when revealStage is HIDDEN', async () => {
      const result = await responseService.getResults('poll-1', {
        includeTest: false,
        revealStage: 'HIDDEN',
        anonymise: true,
      });

      expect(result).toEqual({
        questions: [],
        participantCount: 0,
        submissionCount: 0,
      });
      // Should not query the database
      expect(mockPrisma.question.findMany).not.toHaveBeenCalled();
    });

    it('returns counts and percentages at COUNTS reveal stage', async () => {
      mockPrisma.question.findMany.mockResolvedValue(mockQuestions);
      mockPrisma.response.findMany.mockResolvedValue(mockResponses);

      const result = await responseService.getResults('poll-1', {
        includeTest: false,
        revealStage: 'COUNTS',
        anonymise: true,
      });

      expect(result.participantCount).toBe(3);
      expect(result.submissionCount).toBe(6);
      expect(result.questions).toHaveLength(2);

      // Q1: Red=2, Blue=1, Green=0 out of 3
      const q1 = result.questions[0];
      expect(q1.questionId).toBe('q1');
      expect(q1.totalResponses).toBe(3);
      expect(q1.options).toEqual([
        { label: 'Red', count: 2, percentage: 67 },
        { label: 'Blue', count: 1, percentage: 33 },
        { label: 'Green', count: 0, percentage: 0 },
      ]);
      // COUNTS stage should not include custom responses
      expect(q1.customResponses).toEqual([]);

      // Q2: TypeScript=2, Python=1 out of 3
      const q2 = result.questions[1];
      expect(q2.totalResponses).toBe(3);
      expect(q2.options).toEqual([
        { label: 'TypeScript', count: 2, percentage: 67 },
        { label: 'Python', count: 1, percentage: 33 },
      ]);
    });

    it('returns full details including custom responses at DETAILS reveal stage', async () => {
      mockPrisma.question.findMany.mockResolvedValue(mockQuestions);
      mockPrisma.response.findMany.mockResolvedValue(mockResponses);

      const result = await responseService.getResults('poll-1', {
        includeTest: false,
        revealStage: 'DETAILS',
        anonymise: false,
      });

      const q1 = result.questions[0];
      expect(q1.customResponses).toHaveLength(1);
      expect(q1.customResponses[0]).toEqual({
        text: 'I love blue!',
        participantLabel: 'Bob',
      });
    });

    it('anonymises participant names when anonymise is true', async () => {
      mockPrisma.question.findMany.mockResolvedValue(mockQuestions);
      mockPrisma.response.findMany.mockResolvedValue(mockResponses);

      const result = await responseService.getResults('poll-1', {
        includeTest: false,
        revealStage: 'DETAILS',
        anonymise: true,
      });

      const q1 = result.questions[0];
      expect(q1.customResponses).toHaveLength(1);
      // Bob's token is 'token-b', which is the second unique token
      expect(q1.customResponses[0].participantLabel).toMatch(/^Participant \d+$/);
      expect(q1.customResponses[0].text).toBe('I love blue!');
    });

    it('excludes test responses when includeTest is false', async () => {
      mockPrisma.question.findMany.mockResolvedValue(mockQuestions);
      mockPrisma.response.findMany.mockResolvedValue(mockResponses);

      await responseService.getResults('poll-1', {
        includeTest: false,
        revealStage: 'COUNTS',
        anonymise: false,
      });

      expect(mockPrisma.response.findMany).toHaveBeenCalledWith({
        where: { pollId: 'poll-1', isTest: false },
      });
    });

    it('includes test responses when includeTest is true', async () => {
      mockPrisma.question.findMany.mockResolvedValue(mockQuestions);
      mockPrisma.response.findMany.mockResolvedValue(mockResponses);

      await responseService.getResults('poll-1', {
        includeTest: true,
        revealStage: 'COUNTS',
        anonymise: false,
      });

      expect(mockPrisma.response.findMany).toHaveBeenCalledWith({
        where: { pollId: 'poll-1' },
      });
    });

    it('returns zero percentages when no responses exist', async () => {
      mockPrisma.question.findMany.mockResolvedValue(mockQuestions);
      mockPrisma.response.findMany.mockResolvedValue([]);

      const result = await responseService.getResults('poll-1', {
        includeTest: false,
        revealStage: 'COUNTS',
        anonymise: false,
      });

      expect(result.participantCount).toBe(0);
      expect(result.submissionCount).toBe(0);
      expect(result.questions[0].totalResponses).toBe(0);
      expect(result.questions[0].options.every((o) => o.count === 0 && o.percentage === 0)).toBe(true);
    });

    it('does not include custom responses section when no custom text exists', async () => {
      const responsesWithoutCustom = mockResponses.map((r) => ({ ...r, customText: null }));
      mockPrisma.question.findMany.mockResolvedValue(mockQuestions);
      mockPrisma.response.findMany.mockResolvedValue(responsesWithoutCustom);

      const result = await responseService.getResults('poll-1', {
        includeTest: false,
        revealStage: 'DETAILS',
        anonymise: false,
      });

      expect(result.questions[0].customResponses).toEqual([]);
    });

    it('computes percentages using Math.round', async () => {
      // 1 out of 3 = 33.33... -> 33
      // 2 out of 3 = 66.66... -> 67
      mockPrisma.question.findMany.mockResolvedValue([mockQuestions[0]]);
      mockPrisma.response.findMany.mockResolvedValue([
        { id: 'r1', pollId: 'poll-1', questionId: 'q1', participantName: 'A', sessionToken: 't1', selectedOption: 'Red', customText: null, isTest: false },
        { id: 'r2', pollId: 'poll-1', questionId: 'q1', participantName: 'B', sessionToken: 't2', selectedOption: 'Red', customText: null, isTest: false },
        { id: 'r3', pollId: 'poll-1', questionId: 'q1', participantName: 'C', sessionToken: 't3', selectedOption: 'Blue', customText: null, isTest: false },
      ]);

      const result = await responseService.getResults('poll-1', {
        includeTest: false,
        revealStage: 'COUNTS',
        anonymise: false,
      });

      const q1 = result.questions[0];
      expect(q1.options[0]).toEqual({ label: 'Red', count: 2, percentage: 67 });
      expect(q1.options[1]).toEqual({ label: 'Blue', count: 1, percentage: 33 });
      expect(q1.options[2]).toEqual({ label: 'Green', count: 0, percentage: 0 });
    });
  });

  describe('clearTestResponses', () => {
    it('deletes only test responses for the given poll', async () => {
      mockPrisma.response.deleteMany.mockResolvedValue({ count: 3 });

      await responseService.clearTestResponses('poll-1');

      expect(mockPrisma.response.deleteMany).toHaveBeenCalledWith({
        where: { pollId: 'poll-1', isTest: true },
      });
    });

    it('does not affect real responses', async () => {
      mockPrisma.response.deleteMany.mockResolvedValue({ count: 0 });

      await responseService.clearTestResponses('poll-1');

      // The where clause specifically targets isTest: true
      const callArgs = mockPrisma.response.deleteMany.mock.calls[0][0];
      expect(callArgs.where.isTest).toBe(true);
    });
  });
});
