import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPollService } from '@/lib/services/pollService';

// Use vi.hoisted to define mocks before vi.mock hoisting
const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  poll: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  question: {
    createMany: vi.fn(),
  },
  response: {
    deleteMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock('@/lib/db/client', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/services/auditLogger', () => ({
  auditLogger: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import { auditLogger } from '@/lib/services/auditLogger';

describe('PollService', () => {
  let pollService: ReturnType<typeof createPollService>;
  const MOCK_USER_ID = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    pollService = createPollService();

    // Default findFirst mock for ownership checks
    mockPrisma.poll.findFirst.mockResolvedValue({
      id: 'poll-1',
      title: 'Test Poll',
      userId: MOCK_USER_ID,
      isDeleted: false,
      questions: [],
    });

    // Default $transaction implementation: execute the callback with a mock tx
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        poll: {
          create: vi.fn(),
          update: vi.fn(),
          findUniqueOrThrow: vi.fn(),
        },
        question: {
          createMany: vi.fn(),
        },
        response: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        auditLog: {
          create: vi.fn(),
        },
      };
      return fn(tx);
    });
  });

  describe('createPoll', () => {
    it('creates a poll with default facilitator state', async () => {
      const mockPoll = {
        id: 'poll-1',
        title: 'Test Poll',
        description: null,
        backgroundImageUrl: null,
        facilitatorState: { _v: 1, votingOpen: false, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            create: vi.fn().mockResolvedValue(mockPoll),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await pollService.createPoll({ title: 'Test Poll' }, MOCK_USER_ID);

      expect(result).toEqual(mockPoll);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('creates a poll with title and description', async () => {
      const mockPoll = {
        id: 'poll-2',
        title: 'My Poll',
        description: 'A description',
        backgroundImageUrl: null,
        facilitatorState: { _v: 1, votingOpen: false, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            create: vi.fn().mockResolvedValue(mockPoll),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await pollService.createPoll({ title: 'My Poll', description: 'A description' }, MOCK_USER_ID);

      expect(result.title).toBe('My Poll');
      expect(result.description).toBe('A description');
    });

    it('logs POLL_CREATED via audit logger', async () => {
      const mockPoll = {
        id: 'poll-3',
        title: 'Audit Test',
        description: null,
        backgroundImageUrl: null,
        facilitatorState: { _v: 1, votingOpen: false, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            create: vi.fn().mockResolvedValue(mockPoll),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await pollService.createPoll({ title: 'Audit Test' }, MOCK_USER_ID);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          pollId: 'poll-3',
          action: 'POLL_CREATED',
          actor: MOCK_USER_ID,
          metadata: { title: 'Audit Test' },
        }),
        expect.anything(),
      );
    });

    it('sets facilitator state with correct defaults', async () => {
      let createData: any;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            create: vi.fn().mockImplementation((args: any) => {
              createData = args.data;
              return {
                id: 'poll-4',
                ...args.data,
                createdAt: new Date(),
                updatedAt: new Date(),
                isDeleted: false,
                backgroundImageUrl: null,
              };
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await pollService.createPoll({ title: 'Defaults Test' }, MOCK_USER_ID);

      expect(createData.facilitatorState).toEqual({
        _v: 1,
        votingOpen: false,
        liveResults: false,
        anonymise: true,
        revealStage: 'HIDDEN',
      });
    });
  });

  describe('updatePoll', () => {
    it('updates poll title', async () => {
      const mockUpdated = {
        id: 'poll-1',
        title: 'Updated Title',
        description: null,
        backgroundImageUrl: null,
        facilitatorState: {},
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            update: vi.fn().mockResolvedValue(mockUpdated),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await pollService.updatePoll('poll-1', { title: 'Updated Title' }, MOCK_USER_ID);

      expect(result.title).toBe('Updated Title');
    });

    it('updates poll description and backgroundImageUrl', async () => {
      const mockUpdated = {
        id: 'poll-1',
        title: 'Test',
        description: 'New desc',
        backgroundImageUrl: 'https://example.com/img.png',
        facilitatorState: {},
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            update: vi.fn().mockResolvedValue(mockUpdated),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await pollService.updatePoll('poll-1', {
        description: 'New desc',
        backgroundImageUrl: 'https://example.com/img.png',
      }, MOCK_USER_ID);

      expect(result.description).toBe('New desc');
      expect(result.backgroundImageUrl).toBe('https://example.com/img.png');
    });

    it('logs POLL_UPDATED via audit logger', async () => {
      const mockUpdated = {
        id: 'poll-1',
        title: 'Updated',
        description: null,
        backgroundImageUrl: null,
        facilitatorState: {},
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            update: vi.fn().mockResolvedValue(mockUpdated),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await pollService.updatePoll('poll-1', { title: 'Updated' }, MOCK_USER_ID);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          pollId: 'poll-1',
          action: 'POLL_UPDATED',
          actor: MOCK_USER_ID,
          metadata: { updatedFields: ['title'] },
        }),
        expect.anything(),
      );
    });
  });

  describe('deletePoll', () => {
    it('soft-deletes a poll by setting isDeleted to true', async () => {
      let updateArgs: any;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            update: vi.fn().mockImplementation((args: any) => {
              updateArgs = args;
              return { id: 'poll-1', isDeleted: true };
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await pollService.deletePoll('poll-1', MOCK_USER_ID);

      expect(updateArgs.where).toEqual({ id: 'poll-1' });
      expect(updateArgs.data).toEqual({ isDeleted: true });
    });

    it('logs POLL_DELETED via audit logger', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            update: vi.fn().mockResolvedValue({ id: 'poll-1', isDeleted: true }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await pollService.deletePoll('poll-1', MOCK_USER_ID);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          pollId: 'poll-1',
          action: 'POLL_DELETED',
          actor: MOCK_USER_ID,
        }),
        expect.anything(),
      );
    });
  });

  describe('clonePoll', () => {
    it('creates a new poll with title suffixed "(Copy)"', async () => {
      const originalPoll = {
        id: 'poll-original',
        title: 'Original Poll',
        description: 'Desc',
        backgroundImageUrl: 'https://example.com/bg.png',
        facilitatorState: { _v: 1, votingOpen: true, liveResults: true, anonymise: false, revealStage: 'DETAILS' },
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        questions: [
          { id: 'q1', pollId: 'poll-original', text: 'Q1?', options: ['A', 'B'], allowCustom: false, position: null, displayOrder: 0 },
        ],
      };

      const clonedPoll = {
        id: 'poll-clone',
        title: 'Original Poll (Copy)',
        description: 'Desc',
        backgroundImageUrl: 'https://example.com/bg.png',
        facilitatorState: { _v: 1, votingOpen: false, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(originalPoll),
            create: vi.fn().mockResolvedValue(clonedPoll),
          },
          question: {
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await pollService.clonePoll('poll-original', MOCK_USER_ID);

      expect(result.title).toBe('Original Poll (Copy)');
      expect(result.id).toBe('poll-clone');
    });

    it('duplicates all questions from the original poll', async () => {
      const originalPoll = {
        id: 'poll-original',
        title: 'Original',
        description: null,
        backgroundImageUrl: null,
        facilitatorState: {},
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: MOCK_USER_ID,
        questions: [
          { id: 'q1', pollId: 'poll-original', text: 'Q1?', options: ['A', 'B'], allowCustom: false, position: null, displayOrder: 0 },
          { id: 'q2', pollId: 'poll-original', text: 'Q2?', options: ['X', 'Y', 'Z'], allowCustom: true, position: { x: 10, y: 20, width: 30, height: 40 }, displayOrder: 1 },
        ],
      };

      const clonedPoll = {
        id: 'poll-clone',
        title: 'Original (Copy)',
        description: null,
        backgroundImageUrl: null,
        facilitatorState: { _v: 1, votingOpen: false, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock findFirst to return the original poll with questions (for ownership + include)
      mockPrisma.poll.findFirst.mockResolvedValue(originalPoll);

      let createManyData: any;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(originalPoll),
            create: vi.fn().mockResolvedValue(clonedPoll),
          },
          question: {
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

      await pollService.clonePoll('poll-original', MOCK_USER_ID);

      expect(createManyData).toHaveLength(2);
      expect(createManyData[0].pollId).toBe('poll-clone');
      expect(createManyData[0].text).toBe('Q1?');
      expect(createManyData[1].text).toBe('Q2?');
      expect(createManyData[1].allowCustom).toBe(true);
    });

    it('cloned poll has default facilitator state (not copied from original)', async () => {
      const originalPoll = {
        id: 'poll-original',
        title: 'Original',
        description: null,
        backgroundImageUrl: null,
        facilitatorState: { _v: 1, votingOpen: true, liveResults: true, anonymise: false, revealStage: 'DETAILS' },
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        questions: [],
      };

      let createArgs: any;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(originalPoll),
            create: vi.fn().mockImplementation((args: any) => {
              createArgs = args.data;
              return { id: 'poll-clone', ...args.data, createdAt: new Date(), updatedAt: new Date(), isDeleted: false };
            }),
          },
          question: {
            createMany: vi.fn(),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await pollService.clonePoll('poll-original', MOCK_USER_ID);

      expect(createArgs.facilitatorState).toEqual({
        _v: 1,
        votingOpen: false,
        liveResults: false,
        anonymise: true,
        revealStage: 'HIDDEN',
      });
    });

    it('logs POLL_CLONED via audit logger with source and new poll IDs', async () => {
      const originalPoll = {
        id: 'poll-original',
        title: 'Original',
        description: null,
        backgroundImageUrl: null,
        facilitatorState: {},
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        questions: [],
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(originalPoll),
            create: vi.fn().mockResolvedValue({ id: 'poll-clone', title: 'Original (Copy)' }),
          },
          question: {
            createMany: vi.fn(),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await pollService.clonePoll('poll-original', MOCK_USER_ID);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          pollId: 'poll-clone',
          action: 'POLL_CLONED',
          actor: MOCK_USER_ID,
          metadata: { sourcePollId: 'poll-original', newPollId: 'poll-clone' },
        }),
        expect.anything(),
      );
    });

    it('does not create questions when original has none', async () => {
      const originalPoll = {
        id: 'poll-original',
        title: 'Empty Poll',
        description: null,
        backgroundImageUrl: null,
        facilitatorState: {},
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        questions: [],
      };

      let questionCreateManyCalled = false;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          poll: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(originalPoll),
            create: vi.fn().mockResolvedValue({ id: 'poll-clone', title: 'Empty Poll (Copy)' }),
          },
          question: {
            createMany: vi.fn().mockImplementation(() => {
              questionCreateManyCalled = true;
              return { count: 0 };
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await pollService.clonePoll('poll-original', MOCK_USER_ID);

      expect(questionCreateManyCalled).toBe(false);
    });
  });

  describe('resetResponses', () => {
    it('deletes all responses for a poll', async () => {
      let deleteWhereArgs: any;
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          response: {
            deleteMany: vi.fn().mockImplementation((args: any) => {
              deleteWhereArgs = args.where;
              return { count: 5 };
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await pollService.resetResponses('poll-1', MOCK_USER_ID);

      expect(deleteWhereArgs).toEqual({ pollId: 'poll-1' });
    });

    it('logs RESPONSES_RESET via audit logger with deleted count', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          response: {
            deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return fn(tx);
      });

      await pollService.resetResponses('poll-1', MOCK_USER_ID);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          pollId: 'poll-1',
          action: 'RESPONSES_RESET',
          actor: MOCK_USER_ID,
          metadata: { deletedCount: 10 },
        }),
        expect.anything(),
      );
    });
  });

  describe('getPoll', () => {
    it('returns a poll when it exists and is not deleted', async () => {
      const mockPoll = {
        id: 'poll-1',
        title: 'Active Poll',
        description: null,
        backgroundImageUrl: null,
        facilitatorState: {},
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.poll.findFirst.mockResolvedValue(mockPoll);

      const result = await pollService.getPoll('poll-1', MOCK_USER_ID);

      expect(result).toEqual(mockPoll);
      expect(mockPrisma.poll.findFirst).toHaveBeenCalledWith({
        where: { id: 'poll-1', userId: MOCK_USER_ID, isDeleted: false },
      });
    });

    it('returns null for a soft-deleted poll', async () => {
      mockPrisma.poll.findFirst.mockResolvedValue(null);

      const result = await pollService.getPoll('poll-deleted', MOCK_USER_ID);

      expect(result).toBeNull();
    });

    it('returns null for a non-existent poll', async () => {
      mockPrisma.poll.findFirst.mockResolvedValue(null);

      const result = await pollService.getPoll('non-existent', MOCK_USER_ID);

      expect(result).toBeNull();
    });
  });

  describe('listPolls', () => {
    it('returns all non-deleted polls ordered by createdAt desc', async () => {
      const mockPolls = [
        { id: 'poll-2', title: 'Newer', isDeleted: false, createdAt: new Date('2024-02-01') },
        { id: 'poll-1', title: 'Older', isDeleted: false, createdAt: new Date('2024-01-01') },
      ];

      mockPrisma.poll.findMany.mockResolvedValue(mockPolls);

      const result = await pollService.listPolls(MOCK_USER_ID);

      expect(result).toEqual(mockPolls);
      expect(mockPrisma.poll.findMany).toHaveBeenCalledWith({
        where: { userId: MOCK_USER_ID, isDeleted: false },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns empty array when no polls exist', async () => {
      mockPrisma.poll.findMany.mockResolvedValue([]);

      const result = await pollService.listPolls(MOCK_USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe('ownership enforcement', () => {
    const OWNER_ID = 'owner-user-id';
    const OTHER_USER_ID = 'other-user-id';

    describe('createPoll sets userId on record', () => {
      it('passes userId to the Prisma create call', async () => {
        let createData: any;
        mockPrisma.$transaction.mockImplementation(async (fn: any) => {
          const tx = {
            poll: {
              create: vi.fn().mockImplementation((args: any) => {
                createData = args.data;
                return {
                  id: 'poll-new',
                  ...args.data,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  isDeleted: false,
                  backgroundImageUrl: null,
                };
              }),
            },
            auditLog: {
              create: vi.fn(),
            },
          };
          return fn(tx);
        });

        await pollService.createPoll({ title: 'Ownership Test' }, OWNER_ID);

        expect(createData.userId).toBe(OWNER_ID);
      });

      it('returned poll has the correct userId', async () => {
        const mockPoll = {
          id: 'poll-owned',
          title: 'My Poll',
          description: null,
          backgroundImageUrl: null,
          userId: OWNER_ID,
          facilitatorState: { _v: 1, votingOpen: false, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.$transaction.mockImplementation(async (fn: any) => {
          const tx = {
            poll: {
              create: vi.fn().mockResolvedValue(mockPoll),
            },
            auditLog: {
              create: vi.fn(),
            },
          };
          return fn(tx);
        });

        const result = await pollService.createPoll({ title: 'My Poll' }, OWNER_ID);

        expect(result.userId).toBe(OWNER_ID);
      });
    });

    describe('listPolls filters by userId', () => {
      it('queries Prisma with the provided userId filter', async () => {
        mockPrisma.poll.findMany.mockResolvedValue([]);

        await pollService.listPolls(OWNER_ID);

        expect(mockPrisma.poll.findMany).toHaveBeenCalledWith({
          where: { userId: OWNER_ID, isDeleted: false },
          orderBy: { createdAt: 'desc' },
        });
      });

      it('does not return polls belonging to other users', async () => {
        const ownerPolls = [
          { id: 'poll-1', title: 'Owner Poll', userId: OWNER_ID, isDeleted: false },
        ];

        mockPrisma.poll.findMany.mockResolvedValue(ownerPolls);

        const result = await pollService.listPolls(OWNER_ID);

        expect(result).toHaveLength(1);
        expect(result[0].userId).toBe(OWNER_ID);
        // Verify the query was scoped to the owner
        expect(mockPrisma.poll.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ userId: OWNER_ID }),
          }),
        );
      });

      it('returns empty array when user has no polls', async () => {
        mockPrisma.poll.findMany.mockResolvedValue([]);

        const result = await pollService.listPolls(OTHER_USER_ID);

        expect(result).toEqual([]);
        expect(mockPrisma.poll.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ userId: OTHER_USER_ID }),
          }),
        );
      });
    });

    describe('getPoll returns null for wrong owner', () => {
      it('returns null when userId does not match poll owner', async () => {
        mockPrisma.poll.findFirst.mockResolvedValue(null);

        const result = await pollService.getPoll('poll-1', OTHER_USER_ID);

        expect(result).toBeNull();
        expect(mockPrisma.poll.findFirst).toHaveBeenCalledWith({
          where: { id: 'poll-1', userId: OTHER_USER_ID, isDeleted: false },
        });
      });

      it('returns the poll when userId matches the owner', async () => {
        const mockPoll = {
          id: 'poll-1',
          title: 'Owner Poll',
          userId: OWNER_ID,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.poll.findFirst.mockResolvedValue(mockPoll);

        const result = await pollService.getPoll('poll-1', OWNER_ID);

        expect(result).not.toBeNull();
        expect(result!.id).toBe('poll-1');
      });
    });

    describe('updatePoll returns null for wrong owner', () => {
      it('returns null when userId does not match poll owner', async () => {
        // findFirst returns null because the ownership check fails
        mockPrisma.poll.findFirst.mockResolvedValue(null);

        const result = await pollService.updatePoll('poll-1', { title: 'Hacked' }, OTHER_USER_ID);

        expect(result).toBeNull();
        expect(mockPrisma.poll.findFirst).toHaveBeenCalledWith({
          where: { id: 'poll-1', userId: OTHER_USER_ID, isDeleted: false },
        });
      });

      it('does not execute the update transaction when ownership check fails', async () => {
        mockPrisma.poll.findFirst.mockResolvedValue(null);

        await pollService.updatePoll('poll-1', { title: 'Hacked' }, OTHER_USER_ID);

        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });

      it('proceeds with update when userId matches the owner', async () => {
        const existingPoll = {
          id: 'poll-1',
          title: 'Original',
          userId: OWNER_ID,
          isDeleted: false,
        };

        mockPrisma.poll.findFirst.mockResolvedValue(existingPoll);

        const updatedPoll = {
          id: 'poll-1',
          title: 'Updated',
          userId: OWNER_ID,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.$transaction.mockImplementation(async (fn: any) => {
          const tx = {
            poll: {
              update: vi.fn().mockResolvedValue(updatedPoll),
            },
            auditLog: {
              create: vi.fn(),
            },
          };
          return fn(tx);
        });

        const result = await pollService.updatePoll('poll-1', { title: 'Updated' }, OWNER_ID);

        expect(result).not.toBeNull();
        expect(result!.title).toBe('Updated');
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      });
    });

    describe('deletePoll returns false for wrong owner', () => {
      it('returns false when userId does not match poll owner', async () => {
        mockPrisma.poll.findFirst.mockResolvedValue(null);

        const result = await pollService.deletePoll('poll-1', OTHER_USER_ID);

        expect(result).toBe(false);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });
    });

    describe('clonePoll returns null for wrong owner', () => {
      it('returns null when userId does not match poll owner', async () => {
        mockPrisma.poll.findFirst.mockResolvedValue(null);

        const result = await pollService.clonePoll('poll-1', OTHER_USER_ID);

        expect(result).toBeNull();
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });
    });

    describe('resetResponses returns false for wrong owner', () => {
      it('returns false when userId does not match poll owner', async () => {
        mockPrisma.poll.findFirst.mockResolvedValue(null);

        const result = await pollService.resetResponses('poll-1', OTHER_USER_ID);

        expect(result).toBe(false);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });
    });
  });

  describe('getPublicPoll', () => {
    it('returns poll with questions and parsed facilitator state', async () => {
      const mockPoll = {
        id: 'poll-1',
        title: 'Public Poll',
        description: 'A public poll',
        backgroundImageUrl: 'https://example.com/bg.png',
        facilitatorState: { _v: 1, votingOpen: true, liveResults: true, anonymise: false, revealStage: 'COUNTS' },
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        questions: [
          { id: 'q1', pollId: 'poll-1', text: 'Question 1?', options: ['A', 'B'], allowCustom: false, position: null, displayOrder: 0 },
          { id: 'q2', pollId: 'poll-1', text: 'Question 2?', options: ['X', 'Y', 'Z'], allowCustom: true, position: { x: 10, y: 20, width: 30, height: 40 }, displayOrder: 1 },
        ],
      };

      mockPrisma.poll.findFirst.mockResolvedValue(mockPoll);

      const result = await pollService.getPublicPoll('poll-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('poll-1');
      expect(result!.title).toBe('Public Poll');
      expect(result!.description).toBe('A public poll');
      expect(result!.backgroundImageUrl).toBe('https://example.com/bg.png');
      expect(result!.facilitatorState).toEqual({
        votingOpen: true,
        liveResults: true,
        anonymise: false,
        revealStage: 'COUNTS',
      });
      expect(result!.questions).toHaveLength(2);
      expect(result!.questions[0].text).toBe('Question 1?');
      expect(result!.questions[1].allowCustom).toBe(true);
    });

    it('returns null for a soft-deleted poll', async () => {
      mockPrisma.poll.findFirst.mockResolvedValue(null);

      const result = await pollService.getPublicPoll('poll-deleted');

      expect(result).toBeNull();
    });

    it('returns null for a non-existent poll', async () => {
      mockPrisma.poll.findFirst.mockResolvedValue(null);

      const result = await pollService.getPublicPoll('non-existent');

      expect(result).toBeNull();
    });

    it('queries with isDeleted: false filter', async () => {
      mockPrisma.poll.findFirst.mockResolvedValue(null);

      await pollService.getPublicPoll('poll-1');

      expect(mockPrisma.poll.findFirst).toHaveBeenCalledWith({
        where: { id: 'poll-1', isDeleted: false },
        include: {
          questions: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
    });

    it('returns questions ordered by displayOrder', async () => {
      const mockPoll = {
        id: 'poll-1',
        title: 'Ordered',
        description: null,
        backgroundImageUrl: null,
        facilitatorState: { _v: 1, votingOpen: false, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        questions: [
          { id: 'q1', pollId: 'poll-1', text: 'First', options: ['A', 'B'], allowCustom: false, position: null, displayOrder: 0 },
          { id: 'q2', pollId: 'poll-1', text: 'Second', options: ['C', 'D'], allowCustom: false, position: null, displayOrder: 1 },
          { id: 'q3', pollId: 'poll-1', text: 'Third', options: ['E', 'F'], allowCustom: false, position: null, displayOrder: 2 },
        ],
      };

      mockPrisma.poll.findFirst.mockResolvedValue(mockPoll);

      const result = await pollService.getPublicPoll('poll-1');

      expect(result!.questions[0].displayOrder).toBe(0);
      expect(result!.questions[1].displayOrder).toBe(1);
      expect(result!.questions[2].displayOrder).toBe(2);
    });
  });
});
