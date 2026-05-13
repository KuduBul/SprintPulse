import { describe, it, expect, vi, beforeEach } from 'vitest';

const MOCK_USER_ID = 'test-user-id';

// Mock the authGuard middleware to pass through with a fake userId
vi.mock('@/middleware/authGuard', () => ({
  withAuth: (handler: Function) => (request: Request, context?: any) =>
    handler(request, { userId: MOCK_USER_ID, ...context }),
}));

// Mock the services module
vi.mock('@/lib/services', () => ({
  pollService: {
    getPoll: vi.fn(),
  },
  questionService: {
    createQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
  },
  teamService: {
    getTeam: vi.fn(),
  },
}));

import { pollService, questionService } from '@/lib/services';

const mockPollId = '123e4567-e89b-12d3-a456-426614174000';
const mockQuestionId = '223e4567-e89b-12d3-a456-426614174001';

const mockPoll = {
  id: mockPollId,
  title: 'Test Poll',
  description: 'A test poll',
  backgroundImageUrl: null,
  facilitatorState: { _v: 1, votingOpen: false, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
  isDeleted: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockQuestion = {
  id: mockQuestionId,
  pollId: mockPollId,
  text: 'What is your favourite colour?',
  options: ['Red', 'Blue', 'Green'],
  allowCustom: false,
  position: null,
  displayOrder: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

function createRequest(body?: unknown, method = 'POST'): Request {
  return new Request('http://localhost/api/polls/123/questions', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('app/api/polls/[id]/questions/route.ts', () => {
  const context = { params: { id: mockPollId } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/polls/[id]/questions', () => {
    it('creates a question with valid input', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(questionService.createQuestion).mockResolvedValue(mockQuestion as any);

      const response = await POST(
        createRequest({
          text: 'What is your favourite colour?',
          options: ['Red', 'Blue', 'Green'],
          displayOrder: 0,
        }),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.text).toBe('What is your favourite colour?');
      expect(questionService.createQuestion).toHaveBeenCalledWith(mockPollId, {
        text: 'What is your favourite colour?',
        options: ['Red', 'Blue', 'Green'],
        allowCustom: false,
        position: null,
        displayOrder: 0,
      }, MOCK_USER_ID);
    });

    it('creates a question with allowCustom and position', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      const questionWithPosition = {
        ...mockQuestion,
        allowCustom: true,
        position: { x: 10, y: 20, width: 30, height: 40 },
      };
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(questionService.createQuestion).mockResolvedValue(questionWithPosition as any);

      const response = await POST(
        createRequest({
          text: 'What is your favourite colour?',
          options: ['Red', 'Blue'],
          allowCustom: true,
          position: { x: 10, y: 20, width: 30, height: 40 },
          displayOrder: 1,
        }),
        context,
      );

      expect(response.status).toBe(201);
      expect(questionService.createQuestion).toHaveBeenCalledWith(mockPollId, {
        text: 'What is your favourite colour?',
        options: ['Red', 'Blue'],
        allowCustom: true,
        position: { x: 10, y: 20, width: 30, height: 40 },
        displayOrder: 1,
      }, MOCK_USER_ID);
    });

    it('returns 404 when poll not found', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await POST(
        createRequest({
          text: 'Question',
          options: ['A', 'B'],
          displayOrder: 0,
        }),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Poll not found');
    });

    it('returns 400 for missing text', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);

      const response = await POST(
        createRequest({ options: ['A', 'B'], displayOrder: 0 }),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['text'] }),
        ]),
      );
    });

    it('returns 400 for text exceeding 500 chars', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);

      const response = await POST(
        createRequest({ text: 'a'.repeat(501), options: ['A', 'B'], displayOrder: 0 }),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for fewer than 2 options', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);

      const response = await POST(
        createRequest({ text: 'Question', options: ['Only one'], displayOrder: 0 }),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for more than 10 options', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);

      const options = Array.from({ length: 11 }, (_, i) => `Option ${i + 1}`);
      const response = await POST(
        createRequest({ text: 'Question', options, displayOrder: 0 }),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for empty option strings', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);

      const response = await POST(
        createRequest({ text: 'Question', options: ['Valid', ''], displayOrder: 0 }),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing displayOrder', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);

      const response = await POST(
        createRequest({ text: 'Question', options: ['A', 'B'] }),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid position coordinates', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);

      const response = await POST(
        createRequest({
          text: 'Question',
          options: ['A', 'B'],
          displayOrder: 0,
          position: { x: 150, y: 20, width: 30, height: 40 },
        }),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 500 on internal error', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(questionService.createQuestion).mockRejectedValue(new Error('DB error'));

      const response = await POST(
        createRequest({ text: 'Question', options: ['A', 'B'], displayOrder: 0 }),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});

describe('app/api/polls/[id]/questions/[qId]/route.ts', () => {
  const context = { params: { id: mockPollId, qId: mockQuestionId } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PATCH /api/polls/[id]/questions/[qId]', () => {
    it('updates a question with valid input', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/questions/[qId]/route');
      const updated = { ...mockQuestion, text: 'Updated question text' };
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(questionService.updateQuestion).mockResolvedValue(updated as any);

      const response = await PATCH(
        createRequest({ text: 'Updated question text' }, 'PATCH'),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.text).toBe('Updated question text');
      expect(questionService.updateQuestion).toHaveBeenCalledWith(mockQuestionId, {
        text: 'Updated question text',
      }, MOCK_USER_ID);
    });

    it('updates question options', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/questions/[qId]/route');
      const updated = { ...mockQuestion, options: ['New A', 'New B', 'New C'] };
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(questionService.updateQuestion).mockResolvedValue(updated as any);

      const response = await PATCH(
        createRequest({ options: ['New A', 'New B', 'New C'] }, 'PATCH'),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.options).toEqual(['New A', 'New B', 'New C']);
    });

    it('returns 404 when poll not found', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/questions/[qId]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await PATCH(
        createRequest({ text: 'Updated' }, 'PATCH'),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Poll not found');
    });

    it('returns 400 for text exceeding 500 chars', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/questions/[qId]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);

      const response = await PATCH(
        createRequest({ text: 'a'.repeat(501) }, 'PATCH'),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for fewer than 2 options', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/questions/[qId]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);

      const response = await PATCH(
        createRequest({ options: ['Only one'] }, 'PATCH'),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for more than 10 options', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/questions/[qId]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);

      const options = Array.from({ length: 11 }, (_, i) => `Option ${i + 1}`);
      const response = await PATCH(
        createRequest({ options }, 'PATCH'),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 500 on internal error', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/questions/[qId]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(questionService.updateQuestion).mockRejectedValue(new Error('DB error'));

      const response = await PATCH(
        createRequest({ text: 'Updated' }, 'PATCH'),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('DELETE /api/polls/[id]/questions/[qId]', () => {
    it('deletes a question successfully', async () => {
      const { DELETE } = await import('@/app/api/polls/[id]/questions/[qId]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(questionService.deleteQuestion).mockResolvedValue(undefined);

      const response = await DELETE(
        new Request('http://localhost/api/polls/123/questions/456', { method: 'DELETE' }),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toBe('Question deleted');
      expect(questionService.deleteQuestion).toHaveBeenCalledWith(mockQuestionId, MOCK_USER_ID);
    });

    it('returns 404 when poll not found', async () => {
      const { DELETE } = await import('@/app/api/polls/[id]/questions/[qId]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await DELETE(
        new Request('http://localhost/api/polls/123/questions/456', { method: 'DELETE' }),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Poll not found');
    });

    it('returns 500 on internal error', async () => {
      const { DELETE } = await import('@/app/api/polls/[id]/questions/[qId]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(questionService.deleteQuestion).mockRejectedValue(new Error('DB error'));

      const response = await DELETE(
        new Request('http://localhost/api/polls/123/questions/456', { method: 'DELETE' }),
        context,
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
