import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the services module
vi.mock('@/lib/services', () => ({
  pollService: {
    getPoll: vi.fn(),
  },
  responseService: {
    getResults: vi.fn(),
  },
  facilitatorService: {
    getState: vi.fn(),
  },
}));

// Mock the adminAuth middleware to pass through
vi.mock('@/middleware/adminAuth', () => ({
  withAdminAuth: (handler: Function) => handler,
}));

import { pollService, responseService, facilitatorService } from '@/lib/services';

const mockPoll = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Test Poll',
  description: 'A test poll',
  backgroundImageUrl: null,
  facilitatorState: { _v: 1, votingOpen: true, liveResults: true, anonymise: false, revealStage: 'DETAILS' },
  isDeleted: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockResults = {
  questions: [
    {
      questionId: 'q1',
      questionText: 'What is your favourite colour?',
      options: [
        { label: 'Red', count: 3, percentage: 60 },
        { label: 'Blue', count: 2, percentage: 40 },
      ],
      customResponses: [
        { text: 'I like green', participantLabel: 'Alice' },
      ],
      totalResponses: 5,
    },
  ],
  participantCount: 5,
  submissionCount: 5,
};

const mockEmptyResults = {
  questions: [],
  participantCount: 0,
  submissionCount: 0,
};

function createRequest(url = 'http://localhost/api/polls/123/results'): Request {
  return new Request(url, { method: 'GET' });
}

describe('app/api/polls/[id]/results/route.ts (Admin)', () => {
  const context = { params: { id: mockPoll.id } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/polls/[id]/results', () => {
    it('returns full results with DETAILS reveal stage and no anonymisation', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(responseService.getResults).mockResolvedValue(mockResults);

      const response = await GET(createRequest(), context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(mockResults);
      expect(responseService.getResults).toHaveBeenCalledWith(mockPoll.id, {
        includeTest: false,
        revealStage: 'DETAILS',
        anonymise: false,
      });
    });

    it('always requests DETAILS reveal stage regardless of facilitator state', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/route');
      const pollWithHidden = {
        ...mockPoll,
        facilitatorState: { _v: 1, votingOpen: false, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
      };
      vi.mocked(pollService.getPoll).mockResolvedValue(pollWithHidden as any);
      vi.mocked(responseService.getResults).mockResolvedValue(mockResults);

      const response = await GET(createRequest(), context);

      expect(response.status).toBe(200);
      expect(responseService.getResults).toHaveBeenCalledWith(mockPoll.id, {
        includeTest: false,
        revealStage: 'DETAILS',
        anonymise: false,
      });
    });

    it('excludes test responses', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(responseService.getResults).mockResolvedValue(mockResults);

      await GET(createRequest(), context);

      expect(responseService.getResults).toHaveBeenCalledWith(
        mockPoll.id,
        expect.objectContaining({ includeTest: false })
      );
    });

    it('returns 404 when poll not found', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await GET(createRequest(), context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Poll not found');
    });

    it('returns 500 on internal error', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/route');
      vi.mocked(pollService.getPoll).mockRejectedValue(new Error('DB error'));

      const response = await GET(createRequest(), context);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});

describe('app/api/polls/[id]/results/public/route.ts (Public)', () => {
  const context = { params: { id: mockPoll.id } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/polls/[id]/results/public', () => {
    it('returns results respecting facilitator state (DETAILS, no anonymise)', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/public/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(facilitatorService.getState).mockResolvedValue({
        votingOpen: true,
        liveResults: true,
        anonymise: false,
        revealStage: 'DETAILS',
      });
      vi.mocked(responseService.getResults).mockResolvedValue(mockResults);

      const response = await GET(createRequest('http://localhost/api/polls/123/results/public'), context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(mockResults);
      expect(responseService.getResults).toHaveBeenCalledWith(mockPoll.id, {
        includeTest: false,
        revealStage: 'DETAILS',
        anonymise: false,
      });
    });

    it('returns results respecting HIDDEN reveal stage', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/public/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(facilitatorService.getState).mockResolvedValue({
        votingOpen: false,
        liveResults: false,
        anonymise: true,
        revealStage: 'HIDDEN',
      });
      vi.mocked(responseService.getResults).mockResolvedValue(mockEmptyResults);

      const response = await GET(createRequest('http://localhost/api/polls/123/results/public'), context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(mockEmptyResults);
      expect(responseService.getResults).toHaveBeenCalledWith(mockPoll.id, {
        includeTest: false,
        revealStage: 'HIDDEN',
        anonymise: true,
      });
    });

    it('returns results respecting COUNTS reveal stage with anonymisation', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/public/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(facilitatorService.getState).mockResolvedValue({
        votingOpen: true,
        liveResults: true,
        anonymise: true,
        revealStage: 'COUNTS',
      });
      const countsResults = {
        questions: [
          {
            questionId: 'q1',
            questionText: 'What is your favourite colour?',
            options: [
              { label: 'Red', count: 3, percentage: 60 },
              { label: 'Blue', count: 2, percentage: 40 },
            ],
            customResponses: [],
            totalResponses: 5,
          },
        ],
        participantCount: 5,
        submissionCount: 5,
      };
      vi.mocked(responseService.getResults).mockResolvedValue(countsResults);

      const response = await GET(createRequest('http://localhost/api/polls/123/results/public'), context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(countsResults);
      expect(responseService.getResults).toHaveBeenCalledWith(mockPoll.id, {
        includeTest: false,
        revealStage: 'COUNTS',
        anonymise: true,
      });
    });

    it('excludes test responses from public results', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/public/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(facilitatorService.getState).mockResolvedValue({
        votingOpen: true,
        liveResults: true,
        anonymise: false,
        revealStage: 'DETAILS',
      });
      vi.mocked(responseService.getResults).mockResolvedValue(mockResults);

      await GET(createRequest('http://localhost/api/polls/123/results/public'), context);

      expect(responseService.getResults).toHaveBeenCalledWith(
        mockPoll.id,
        expect.objectContaining({ includeTest: false })
      );
    });

    it('returns 404 when poll not found', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/public/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await GET(createRequest('http://localhost/api/polls/123/results/public'), context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Poll not found');
    });

    it('returns 500 on internal error from pollService', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/public/route');
      vi.mocked(pollService.getPoll).mockRejectedValue(new Error('DB error'));

      const response = await GET(createRequest('http://localhost/api/polls/123/results/public'), context);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('returns 500 on internal error from facilitatorService', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/public/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(facilitatorService.getState).mockRejectedValue(new Error('DB error'));

      const response = await GET(createRequest('http://localhost/api/polls/123/results/public'), context);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
