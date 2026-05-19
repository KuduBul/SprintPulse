import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase auth
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      }),
    },
  }),
}));

// Mock next/headers cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: () => {},
  }),
}));

// Mock services
vi.mock('@/lib/services', () => ({
  pollService: {
    getPoll: vi.fn(),
    getPublicPoll: vi.fn(),
  },
  facilitatorService: {
    getState: vi.fn(),
    updateState: vi.fn(),
  },
  responseService: {
    getResults: vi.fn(),
  },
}));

import { pollService, facilitatorService, responseService } from '@/lib/services';
import { createClient } from '@/lib/supabase/server';

function createRequest(url: string, options: RequestInit = {}): Request {
  return new Request(`http://localhost${url}`, options);
}

describe('Integration: Facilitator API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
    } as any);
  });

  describe('GET /api/polls/[id]/facilitator — Get facilitator state', () => {
    it('returns the current facilitator state', async () => {
      const { GET } = await import('@/app/api/polls/[id]/facilitator/route');
      vi.mocked(pollService.getPoll).mockResolvedValue({ id: 'poll-1' } as any);
      const mockState = {
        votingOpen: true,
        liveResults: true,
        anonymise: false,
        revealStage: 'DETAILS',
      };
      vi.mocked(facilitatorService.getState).mockResolvedValue(mockState as any);

      const response = await GET(
        createRequest('/api/polls/poll-1/facilitator'),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.votingOpen).toBe(true);
      expect(body.revealStage).toBe('DETAILS');
    });

    it('returns 404 when poll not found', async () => {
      const { GET } = await import('@/app/api/polls/[id]/facilitator/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await GET(
        createRequest('/api/polls/nonexistent/facilitator'),
        { params: { id: 'nonexistent' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/polls/[id]/facilitator — Update facilitator state', () => {
    it('updates facilitator state with valid partial data', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/facilitator/route');
      vi.mocked(pollService.getPoll).mockResolvedValue({ id: 'poll-1' } as any);
      const updatedState = {
        votingOpen: true,
        liveResults: false,
        anonymise: true,
        revealStage: 'HIDDEN',
      };
      vi.mocked(facilitatorService.updateState).mockResolvedValue(updatedState as any);

      const response = await PATCH(
        createRequest('/api/polls/poll-1/facilitator', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ votingOpen: true }),
        }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.votingOpen).toBe(true);
    });

    it('returns 400 for invalid reveal stage value', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/facilitator/route');
      vi.mocked(pollService.getPoll).mockResolvedValue({ id: 'poll-1' } as any);

      const response = await PATCH(
        createRequest('/api/polls/poll-1/facilitator', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revealStage: 'INVALID_STAGE' }),
        }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when poll not found', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/facilitator/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await PATCH(
        createRequest('/api/polls/nonexistent/facilitator', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ votingOpen: true }),
        }),
        { params: { id: 'nonexistent' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/polls/[id]/results — Admin results', () => {
    it('returns full results for authenticated admin', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/route');
      vi.mocked(pollService.getPoll).mockResolvedValue({ id: 'poll-1' } as any);
      const mockResults = {
        questions: [
          {
            questionId: 'q-1',
            questionText: 'Favourite?',
            options: [
              { label: 'A', count: 3, percentage: 60 },
              { label: 'B', count: 2, percentage: 40 },
            ],
            customResponses: [],
            totalResponses: 5,
          },
        ],
        participantCount: 5,
        submissionCount: 5,
      };
      vi.mocked(responseService.getResults).mockResolvedValue(mockResults as any);

      const response = await GET(
        createRequest('/api/polls/poll-1/results'),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.participantCount).toBe(5);
      expect(responseService.getResults).toHaveBeenCalledWith('poll-1', {
        includeTest: false,
        revealStage: 'DETAILS',
        anonymise: false,
      });
    });

    it('passes includeTest=true when query param is set', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/route');
      vi.mocked(pollService.getPoll).mockResolvedValue({ id: 'poll-1' } as any);
      vi.mocked(responseService.getResults).mockResolvedValue({ questions: [], participantCount: 0, submissionCount: 0 } as any);

      const response = await GET(
        createRequest('/api/polls/poll-1/results?includeTest=true'),
        { params: { id: 'poll-1' } } as any
      );

      expect(response.status).toBe(200);
      expect(responseService.getResults).toHaveBeenCalledWith('poll-1', {
        includeTest: true,
        revealStage: 'DETAILS',
        anonymise: false,
      });
    });

    it('returns 404 when poll not found', async () => {
      const { GET } = await import('@/app/api/polls/[id]/results/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await GET(
        createRequest('/api/polls/nonexistent/results'),
        { params: { id: 'nonexistent' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
