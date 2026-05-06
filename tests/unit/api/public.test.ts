import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the pollService module
vi.mock('@/lib/services', () => ({
  pollService: {
    getPublicPoll: vi.fn(),
  },
}));

import { pollService } from '@/lib/services';

const mockPublicPoll = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Test Poll',
  description: 'A test poll',
  backgroundImageUrl: null,
  facilitatorState: {
    votingOpen: true,
    liveResults: false,
    anonymise: true,
    revealStage: 'HIDDEN',
  },
  questions: [
    {
      id: 'q1',
      text: 'What is your favourite colour?',
      options: ['Red', 'Blue', 'Green'],
      allowCustom: false,
      position: null,
      displayOrder: 0,
    },
  ],
};

describe('app/api/polls/[id]/public/route.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/polls/[id]/public', () => {
    it('returns public poll data for a valid poll', async () => {
      const { GET } = await import('@/app/api/polls/[id]/public/route');
      vi.mocked(pollService.getPublicPoll).mockResolvedValue(mockPublicPoll as any);

      const context = { params: { id: mockPublicPoll.id } };
      const response = await GET(new Request('http://localhost/api/polls/123/public'), context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.id).toBe(mockPublicPoll.id);
      expect(body.title).toBe('Test Poll');
      expect(body.facilitatorState.votingOpen).toBe(true);
      expect(body.questions).toHaveLength(1);
    });

    it('returns 404 when poll not found', async () => {
      const { GET } = await import('@/app/api/polls/[id]/public/route');
      vi.mocked(pollService.getPublicPoll).mockResolvedValue(null);

      const context = { params: { id: 'nonexistent-id' } };
      const response = await GET(new Request('http://localhost/api/polls/nonexistent/public'), context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for soft-deleted polls (service returns null)', async () => {
      const { GET } = await import('@/app/api/polls/[id]/public/route');
      vi.mocked(pollService.getPublicPoll).mockResolvedValue(null);

      const context = { params: { id: 'deleted-poll-id' } };
      const response = await GET(new Request('http://localhost/api/polls/deleted/public'), context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 500 on internal error', async () => {
      const { GET } = await import('@/app/api/polls/[id]/public/route');
      vi.mocked(pollService.getPublicPoll).mockRejectedValue(new Error('DB error'));

      const context = { params: { id: mockPublicPoll.id } };
      const response = await GET(new Request('http://localhost/api/polls/123/public'), context);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('does not require admin authentication', async () => {
      const { GET } = await import('@/app/api/polls/[id]/public/route');
      vi.mocked(pollService.getPublicPoll).mockResolvedValue(mockPublicPoll as any);

      // No admin token header — should still succeed
      const context = { params: { id: mockPublicPoll.id } };
      const response = await GET(
        new Request('http://localhost/api/polls/123/public'),
        context
      );

      expect(response.status).toBe(200);
    });
  });
});
