import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the services module
vi.mock('@/lib/services', () => ({
  pollService: {
    getPoll: vi.fn(),
  },
  facilitatorService: {
    getState: vi.fn(),
    updateState: vi.fn(),
  },
}));

// Mock the adminAuth middleware to pass through
vi.mock('@/middleware/adminAuth', () => ({
  withAdminAuth: (handler: Function) => handler,
}));

import { pollService, facilitatorService } from '@/lib/services';

const mockPoll = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Test Poll',
  description: 'A test poll',
  backgroundImageUrl: null,
  facilitatorState: { _v: 1, votingOpen: false, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
  isDeleted: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockFacilitatorState = {
  votingOpen: false,
  liveResults: false,
  anonymise: true,
  revealStage: 'HIDDEN' as const,
};

function createRequest(body?: unknown, method = 'PATCH'): Request {
  return new Request('http://localhost/api/polls/123/facilitator', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('app/api/polls/[id]/facilitator/route.ts', () => {
  const context = { params: { id: mockPoll.id } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/polls/[id]/facilitator', () => {
    it('returns the current facilitator state', async () => {
      const { GET } = await import('@/app/api/polls/[id]/facilitator/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(facilitatorService.getState).mockResolvedValue(mockFacilitatorState);

      const response = await GET(new Request('http://localhost/api/polls/123/facilitator'), context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(mockFacilitatorState);
      expect(facilitatorService.getState).toHaveBeenCalledWith(mockPoll.id);
    });

    it('returns 404 when poll not found', async () => {
      const { GET } = await import('@/app/api/polls/[id]/facilitator/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await GET(new Request('http://localhost/api/polls/123/facilitator'), context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Poll not found');
    });

    it('returns 500 on internal error', async () => {
      const { GET } = await import('@/app/api/polls/[id]/facilitator/route');
      vi.mocked(pollService.getPoll).mockRejectedValue(new Error('DB error'));

      const response = await GET(new Request('http://localhost/api/polls/123/facilitator'), context);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('PATCH /api/polls/[id]/facilitator', () => {
    it('updates facilitator state with valid partial input', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/facilitator/route');
      const updatedState = { ...mockFacilitatorState, votingOpen: true };
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(facilitatorService.updateState).mockResolvedValue(updatedState);

      const response = await PATCH(createRequest({ votingOpen: true }), context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.votingOpen).toBe(true);
      expect(facilitatorService.updateState).toHaveBeenCalledWith(mockPoll.id, { votingOpen: true });
    });

    it('updates multiple fields at once', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/facilitator/route');
      const patch = { votingOpen: true, liveResults: true, revealStage: 'COUNTS' as const };
      const updatedState = { ...mockFacilitatorState, ...patch };
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(facilitatorService.updateState).mockResolvedValue(updatedState);

      const response = await PATCH(createRequest(patch), context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.votingOpen).toBe(true);
      expect(body.liveResults).toBe(true);
      expect(body.revealStage).toBe('COUNTS');
      expect(facilitatorService.updateState).toHaveBeenCalledWith(mockPoll.id, patch);
    });

    it('returns 404 when poll not found', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/facilitator/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await PATCH(createRequest({ votingOpen: true }), context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Poll not found');
    });

    it('returns 400 for invalid revealStage value', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/facilitator/route');

      const response = await PATCH(createRequest({ revealStage: 'INVALID' }), context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid votingOpen type', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/facilitator/route');

      const response = await PATCH(createRequest({ votingOpen: 'yes' }), context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 500 on internal error', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/facilitator/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(facilitatorService.updateState).mockRejectedValue(new Error('DB error'));

      const response = await PATCH(createRequest({ votingOpen: true }), context);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('accepts empty object as valid input (no-op update)', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/facilitator/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(facilitatorService.updateState).mockResolvedValue(mockFacilitatorState);

      const response = await PATCH(createRequest({}), context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(mockFacilitatorState);
      expect(facilitatorService.updateState).toHaveBeenCalledWith(mockPoll.id, {});
    });
  });
});
