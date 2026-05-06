import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the pollService module
vi.mock('@/lib/services', () => ({
  pollService: {
    listPolls: vi.fn(),
    createPoll: vi.fn(),
    getPoll: vi.fn(),
    updatePoll: vi.fn(),
    deletePoll: vi.fn(),
    clonePoll: vi.fn(),
    resetResponses: vi.fn(),
  },
}));

// Mock the adminAuth middleware to pass through
vi.mock('@/middleware/adminAuth', () => ({
  withAdminAuth: (handler: Function) => handler,
}));

import { pollService } from '@/lib/services';

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

function createRequest(body?: unknown, method = 'POST'): Request {
  return new Request('http://localhost/api/polls', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('app/api/polls/route.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/polls', () => {
    it('returns a list of polls', async () => {
      const { GET } = await import('@/app/api/polls/route');
      vi.mocked(pollService.listPolls).mockResolvedValue([mockPoll as any]);

      const response = await GET(new Request('http://localhost/api/polls'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].title).toBe('Test Poll');
    });

    it('returns empty array when no polls exist', async () => {
      const { GET } = await import('@/app/api/polls/route');
      vi.mocked(pollService.listPolls).mockResolvedValue([]);

      const response = await GET(new Request('http://localhost/api/polls'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual([]);
    });

    it('returns 500 on internal error', async () => {
      const { GET } = await import('@/app/api/polls/route');
      vi.mocked(pollService.listPolls).mockRejectedValue(new Error('DB error'));

      const response = await GET(new Request('http://localhost/api/polls'));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/polls', () => {
    it('creates a poll with valid input', async () => {
      const { POST } = await import('@/app/api/polls/route');
      vi.mocked(pollService.createPoll).mockResolvedValue(mockPoll as any);

      const response = await POST(createRequest({ title: 'Test Poll', description: 'A test poll' }));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.title).toBe('Test Poll');
      expect(pollService.createPoll).toHaveBeenCalledWith({ title: 'Test Poll', description: 'A test poll' });
    });

    it('creates a poll without description', async () => {
      const { POST } = await import('@/app/api/polls/route');
      vi.mocked(pollService.createPoll).mockResolvedValue(mockPoll as any);

      const response = await POST(createRequest({ title: 'Test Poll' }));

      expect(response.status).toBe(201);
      expect(pollService.createPoll).toHaveBeenCalledWith({ title: 'Test Poll' });
    });

    it('returns 400 for missing title', async () => {
      const { POST } = await import('@/app/api/polls/route');

      const response = await POST(createRequest({}));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['title'] }),
        ])
      );
    });

    it('returns 400 for title exceeding 200 chars', async () => {
      const { POST } = await import('@/app/api/polls/route');

      const response = await POST(createRequest({ title: 'a'.repeat(201) }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for description exceeding 1000 chars', async () => {
      const { POST } = await import('@/app/api/polls/route');

      const response = await POST(createRequest({ title: 'Valid', description: 'a'.repeat(1001) }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 500 on internal error', async () => {
      const { POST } = await import('@/app/api/polls/route');
      vi.mocked(pollService.createPoll).mockRejectedValue(new Error('DB error'));

      const response = await POST(createRequest({ title: 'Test' }));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});

describe('app/api/polls/[id]/route.ts', () => {
  const context = { params: { id: mockPoll.id } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/polls/[id]', () => {
    it('returns a poll by ID', async () => {
      const { GET } = await import('@/app/api/polls/[id]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);

      const response = await GET(new Request('http://localhost/api/polls/123'), context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.title).toBe('Test Poll');
    });

    it('returns 404 when poll not found', async () => {
      const { GET } = await import('@/app/api/polls/[id]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await GET(new Request('http://localhost/api/polls/123'), context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 500 on internal error', async () => {
      const { GET } = await import('@/app/api/polls/[id]/route');
      vi.mocked(pollService.getPoll).mockRejectedValue(new Error('DB error'));

      const response = await GET(new Request('http://localhost/api/polls/123'), context);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('PATCH /api/polls/[id]', () => {
    it('updates a poll with valid input', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/route');
      const updated = { ...mockPoll, title: 'Updated Title' };
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(pollService.updatePoll).mockResolvedValue(updated as any);

      const response = await PATCH(createRequest({ title: 'Updated Title' }, 'PATCH'), context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.title).toBe('Updated Title');
    });

    it('returns 404 when poll not found', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await PATCH(createRequest({ title: 'Updated' }, 'PATCH'), context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for invalid title (too long)', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/route');

      const response = await PATCH(createRequest({ title: 'a'.repeat(201) }, 'PATCH'), context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid backgroundImageUrl', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/route');

      const response = await PATCH(createRequest({ backgroundImageUrl: 'not-a-url' }, 'PATCH'), context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/polls/[id]', () => {
    it('soft-deletes a poll', async () => {
      const { DELETE } = await import('@/app/api/polls/[id]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(pollService.deletePoll).mockResolvedValue(undefined);

      const response = await DELETE(new Request('http://localhost/api/polls/123', { method: 'DELETE' }), context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toBe('Poll deleted');
      expect(pollService.deletePoll).toHaveBeenCalledWith(mockPoll.id);
    });

    it('returns 404 when poll not found', async () => {
      const { DELETE } = await import('@/app/api/polls/[id]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await DELETE(new Request('http://localhost/api/polls/123', { method: 'DELETE' }), context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});

describe('app/api/polls/[id]/clone/route.ts', () => {
  const context = { params: { id: mockPoll.id } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/polls/[id]/clone', () => {
    it('clones a poll successfully', async () => {
      const { POST } = await import('@/app/api/polls/[id]/clone/route');
      const cloned = { ...mockPoll, id: 'new-id', title: 'Test Poll (Copy)' };
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(pollService.clonePoll).mockResolvedValue(cloned as any);

      const response = await POST(new Request('http://localhost/api/polls/123/clone', { method: 'POST' }), context);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.title).toBe('Test Poll (Copy)');
      expect(pollService.clonePoll).toHaveBeenCalledWith(mockPoll.id);
    });

    it('returns 404 when poll not found', async () => {
      const { POST } = await import('@/app/api/polls/[id]/clone/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await POST(new Request('http://localhost/api/polls/123/clone', { method: 'POST' }), context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 500 on internal error', async () => {
      const { POST } = await import('@/app/api/polls/[id]/clone/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(pollService.clonePoll).mockRejectedValue(new Error('DB error'));

      const response = await POST(new Request('http://localhost/api/polls/123/clone', { method: 'POST' }), context);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});

describe('app/api/polls/[id]/reset/route.ts', () => {
  const context = { params: { id: mockPoll.id } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/polls/[id]/reset', () => {
    it('resets responses for a poll', async () => {
      const { POST } = await import('@/app/api/polls/[id]/reset/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(pollService.resetResponses).mockResolvedValue(undefined);

      const response = await POST(new Request('http://localhost/api/polls/123/reset', { method: 'POST' }), context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toBe('Responses reset');
      expect(pollService.resetResponses).toHaveBeenCalledWith(mockPoll.id);
    });

    it('returns 404 when poll not found', async () => {
      const { POST } = await import('@/app/api/polls/[id]/reset/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await POST(new Request('http://localhost/api/polls/123/reset', { method: 'POST' }), context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 500 on internal error', async () => {
      const { POST } = await import('@/app/api/polls/[id]/reset/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);
      vi.mocked(pollService.resetResponses).mockRejectedValue(new Error('DB error'));

      const response = await POST(new Request('http://localhost/api/polls/123/reset', { method: 'POST' }), context);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
