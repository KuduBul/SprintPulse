import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the rateLimit middleware to pass through by default
vi.mock('@/middleware/rateLimit', () => ({
  withRateLimit: (handler: Function) => handler,
  clearRateLimitStore: vi.fn(),
}));

// Mock services
vi.mock('@/lib/services', () => ({
  responseService: {
    submitResponses: vi.fn(),
    getResults: vi.fn(),
  },
  pollService: {
    getPublicPoll: vi.fn(),
  },
  facilitatorService: {
    getState: vi.fn(),
  },
}));

import { responseService, pollService, facilitatorService } from '@/lib/services';

const validSubmission = {
  participantName: 'Jane Smith',
  sessionToken: '550e8400-e29b-41d4-a716-446655440000',
  answers: [
    {
      questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      selectedOption: 'Option A',
    },
    {
      questionId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      selectedOption: 'Option B',
      customText: 'My custom answer',
    },
  ],
  isTest: false,
};

function createRequest(url: string, options: RequestInit = {}): Request {
  return new Request(`http://localhost${url}`, {
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    ...options,
  });
}

describe('Integration: Response Submission API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/polls/[id]/respond — Submit responses', () => {
    it('submits valid responses successfully (full request/response cycle)', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');
      vi.mocked(responseService.submitResponses).mockResolvedValue(undefined);

      const response = await POST(
        createRequest('/api/polls/poll-1/respond', {
          method: 'POST',
          body: JSON.stringify(validSubmission),
        }),
        { params: { id: 'poll-1' } }
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toBe('Responses submitted');
      expect(responseService.submitResponses).toHaveBeenCalledWith('poll-1', validSubmission);
    });

    it('returns 410 VOTING_CLOSED when voting is closed at submission time', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');
      const error = new Error('Voting is currently closed');
      (error as any).code = 'VOTING_CLOSED';
      vi.mocked(responseService.submitResponses).mockRejectedValue(error);

      const response = await POST(
        createRequest('/api/polls/poll-1/respond', {
          method: 'POST',
          body: JSON.stringify(validSubmission),
        }),
        { params: { id: 'poll-1' } }
      );
      const body = await response.json();

      expect(response.status).toBe(410);
      expect(body.error.code).toBe('VOTING_CLOSED');
      expect(body.error.message).toBe('Voting is currently closed');
    });

    it('returns 409 CONFLICT for duplicate session token submission', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');
      const error = new Error('Already submitted');
      (error as any).code = 'CONFLICT';
      vi.mocked(responseService.submitResponses).mockRejectedValue(error);

      const response = await POST(
        createRequest('/api/polls/poll-1/respond', {
          method: 'POST',
          body: JSON.stringify(validSubmission),
        }),
        { params: { id: 'poll-1' } }
      );
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toBe('Duplicate submission');
    });

    it('returns 400 for invalid submission (missing participantName)', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');

      const response = await POST(
        createRequest('/api/polls/poll-1/respond', {
          method: 'POST',
          body: JSON.stringify({
            sessionToken: validSubmission.sessionToken,
            answers: validSubmission.answers,
          }),
        }),
        { params: { id: 'poll-1' } }
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid session token (not UUID)', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');

      const response = await POST(
        createRequest('/api/polls/poll-1/respond', {
          method: 'POST',
          body: JSON.stringify({ ...validSubmission, sessionToken: 'not-a-uuid' }),
        }),
        { params: { id: 'poll-1' } }
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for empty answers array', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');

      const response = await POST(
        createRequest('/api/polls/poll-1/respond', {
          method: 'POST',
          body: JSON.stringify({ ...validSubmission, answers: [] }),
        }),
        { params: { id: 'poll-1' } }
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for participantName shorter than 2 characters', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');

      const response = await POST(
        createRequest('/api/polls/poll-1/respond', {
          method: 'POST',
          body: JSON.stringify({ ...validSubmission, participantName: 'X' }),
        }),
        { params: { id: 'poll-1' } }
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('does not require admin authentication (public endpoint)', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');
      vi.mocked(responseService.submitResponses).mockResolvedValue(undefined);

      // No auth headers — should still succeed
      const response = await POST(
        new Request('http://localhost/api/polls/poll-1/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validSubmission),
        }),
        { params: { id: 'poll-1' } }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/polls/[id]/public — Public poll data', () => {
    it('returns public poll data', async () => {
      const { GET } = await import('@/app/api/polls/[id]/public/route');
      const mockPublicPoll = {
        id: 'poll-1',
        title: 'Public Poll',
        questions: [{ id: 'q-1', text: 'Question 1', options: ['A', 'B'] }],
        facilitatorState: { votingOpen: true, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
      };
      vi.mocked(pollService.getPublicPoll).mockResolvedValue(mockPublicPoll as any);

      const response = await GET(
        createRequest('/api/polls/poll-1/public'),
        { params: { id: 'poll-1' } }
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.title).toBe('Public Poll');
      expect(body.questions).toHaveLength(1);
    });

    it('returns 404 for non-existent or soft-deleted poll', async () => {
      const { GET } = await import('@/app/api/polls/[id]/public/route');
      vi.mocked(pollService.getPublicPoll).mockResolvedValue(null);

      const response = await GET(
        createRequest('/api/polls/nonexistent/public'),
        { params: { id: 'nonexistent' } }
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/polls/[id]/results/public — Public results', () => {
    it('returns public results respecting facilitator state', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/public/route');
      vi.mocked(pollService.getPublicPoll).mockResolvedValue({ id: 'poll-1' } as any);
      vi.mocked(facilitatorService.getState).mockResolvedValue({
        votingOpen: false,
        liveResults: true,
        anonymise: true,
        revealStage: 'COUNTS',
      } as any);
      const mockResults = {
        questions: [{ questionId: 'q-1', options: [{ label: 'A', count: 5, percentage: 50 }] }],
        participantCount: 10,
        submissionCount: 10,
      };
      vi.mocked(responseService.getResults).mockResolvedValue(mockResults as any);

      const response = await GET(
        createRequest('/api/polls/poll-1/results/public'),
        { params: { id: 'poll-1' } }
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.participantCount).toBe(10);
      expect(responseService.getResults).toHaveBeenCalledWith('poll-1', {
        includeTest: false,
        revealStage: 'COUNTS',
        anonymise: true,
      });
    });

    it('returns 404 for non-existent poll', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/public/route');
      vi.mocked(pollService.getPublicPoll).mockResolvedValue(null);

      const response = await GET(
        createRequest('/api/polls/nonexistent/results/public'),
        { params: { id: 'nonexistent' } }
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
