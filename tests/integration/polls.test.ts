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
    listPolls: vi.fn(),
    createPoll: vi.fn(),
    getPoll: vi.fn(),
    updatePoll: vi.fn(),
    deletePoll: vi.fn(),
    clonePoll: vi.fn(),
    resetResponses: vi.fn(),
    getPublicPoll: vi.fn(),
  },
  teamService: {
    getTeam: vi.fn(),
  },
  responseService: {
    clearTestResponses: vi.fn(),
  },
}));

import { pollService, teamService, responseService } from '@/lib/services';
import { createClient } from '@/lib/supabase/server';

function createRequest(url: string, options: RequestInit = {}): Request {
  return new Request(`http://localhost${url}`, options);
}

describe('Integration: Poll CRUD API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
    } as any);
  });

  describe('GET /api/polls — List polls', () => {
    it('returns list of polls for authenticated user', async () => {
      const { GET } = await import('@/app/api/polls/route');
      const mockPolls = [
        { id: 'poll-1', title: 'Poll 1', isDeleted: false },
        { id: 'poll-2', title: 'Poll 2', isDeleted: false },
      ];
      vi.mocked(pollService.listPolls).mockResolvedValue(mockPolls as any);

      const response = await GET(createRequest('/api/polls'), {} as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(mockPolls);
      expect(pollService.listPolls).toHaveBeenCalledWith('user-123');
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'No session' },
          }),
        },
      } as any);

      const { GET } = await import('@/app/api/polls/route');
      const response = await GET(createRequest('/api/polls'), {} as any);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/polls — Create poll', () => {
    it('creates a poll with valid data', async () => {
      const { POST } = await import('@/app/api/polls/route');
      const teamId = '550e8400-e29b-41d4-a716-446655440000';
      const mockPoll = { id: 'poll-new', title: 'New Poll', description: 'A test poll' };
      vi.mocked(teamService.getTeam).mockResolvedValue({ id: teamId, name: 'Team' } as any);
      vi.mocked(pollService.createPoll).mockResolvedValue(mockPoll as any);

      const response = await POST(
        createRequest('/api/polls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Poll', description: 'A test poll', teamId }),
        }),
        {} as any
      );
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.title).toBe('New Poll');
    });

    it('returns 400 for missing title', async () => {
      const { POST } = await import('@/app/api/polls/route');
      const teamId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await POST(
        createRequest('/api/polls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: 'No title', teamId }),
        }),
        {} as any
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for title exceeding 200 characters', async () => {
      const { POST } = await import('@/app/api/polls/route');
      const teamId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await POST(
        createRequest('/api/polls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'A'.repeat(201), teamId }),
        }),
        {} as any
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'No session' },
          }),
        },
      } as any);

      const { POST } = await import('@/app/api/polls/route');
      const teamId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await POST(
        createRequest('/api/polls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Test', teamId }),
        }),
        {} as any
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/polls/[id] — Get single poll', () => {
    it('returns a poll by ID', async () => {
      const { GET } = await import('@/app/api/polls/[id]/route');
      const mockPoll = { id: 'poll-1', title: 'My Poll' };
      vi.mocked(pollService.getPoll).mockResolvedValue(mockPoll as any);

      const response = await GET(
        createRequest('/api/polls/poll-1'),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.id).toBe('poll-1');
    });

    it('returns 404 for non-existent poll', async () => {
      const { GET } = await import('@/app/api/polls/[id]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await GET(
        createRequest('/api/polls/nonexistent'),
        { params: { id: 'nonexistent' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/polls/[id] — Update poll', () => {
    it('updates a poll with valid data', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/route');
      const updatedPoll = { id: 'poll-1', title: 'Updated Title' };
      vi.mocked(pollService.updatePoll).mockResolvedValue(updatedPoll as any);

      const response = await PATCH(
        createRequest('/api/polls/poll-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Updated Title' }),
        }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.title).toBe('Updated Title');
    });

    it('returns 404 when poll not found', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/route');
      vi.mocked(pollService.updatePoll).mockResolvedValue(null);

      const response = await PATCH(
        createRequest('/api/polls/nonexistent', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Updated' }),
        }),
        { params: { id: 'nonexistent' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/polls/[id] — Soft-delete poll', () => {
    it('soft-deletes a poll', async () => {
      const { DELETE } = await import('@/app/api/polls/[id]/route');
      vi.mocked(pollService.deletePoll).mockResolvedValue(true as any);

      const response = await DELETE(
        createRequest('/api/polls/poll-1', { method: 'DELETE' }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toBe('Poll deleted');
    });

    it('returns 404 for non-existent poll', async () => {
      const { DELETE } = await import('@/app/api/polls/[id]/route');
      vi.mocked(pollService.deletePoll).mockResolvedValue(null as any);

      const response = await DELETE(
        createRequest('/api/polls/nonexistent', { method: 'DELETE' }),
        { params: { id: 'nonexistent' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/polls/[id]/clone — Clone poll', () => {
    it('clones a poll successfully', async () => {
      const { POST } = await import('@/app/api/polls/[id]/clone/route');
      const clonedPoll = { id: 'poll-clone', title: 'My Poll (Copy)' };
      vi.mocked(pollService.clonePoll).mockResolvedValue(clonedPoll as any);

      const response = await POST(
        createRequest('/api/polls/poll-1/clone', { method: 'POST' }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.title).toContain('(Copy)');
    });

    it('returns 404 when source poll not found', async () => {
      const { POST } = await import('@/app/api/polls/[id]/clone/route');
      vi.mocked(pollService.clonePoll).mockResolvedValue(null);

      const response = await POST(
        createRequest('/api/polls/nonexistent/clone', { method: 'POST' }),
        { params: { id: 'nonexistent' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/polls/[id]/reset — Reset responses', () => {
    it('resets all responses for a poll', async () => {
      const { POST } = await import('@/app/api/polls/[id]/reset/route');
      vi.mocked(pollService.getPoll).mockResolvedValue({ id: 'poll-1' } as any);
      vi.mocked(pollService.resetResponses).mockResolvedValue(undefined);

      const response = await POST(
        createRequest('/api/polls/poll-1/reset', { method: 'POST' }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toBe('Responses reset');
    });

    it('clears only test responses when testOnly=true', async () => {
      const { POST } = await import('@/app/api/polls/[id]/reset/route');
      vi.mocked(pollService.getPoll).mockResolvedValue({ id: 'poll-1' } as any);
      vi.mocked(responseService.clearTestResponses).mockResolvedValue(undefined);

      const response = await POST(
        createRequest('/api/polls/poll-1/reset?testOnly=true', { method: 'POST' }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toBe('Test responses cleared');
      expect(responseService.clearTestResponses).toHaveBeenCalledWith('poll-1');
    });

    it('returns 404 when poll not found', async () => {
      const { POST } = await import('@/app/api/polls/[id]/reset/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await POST(
        createRequest('/api/polls/nonexistent/reset', { method: 'POST' }),
        { params: { id: 'nonexistent' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
