import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/headers cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: () => {},
  }),
}));

// Mock Supabase auth — will be configured per test
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock services
vi.mock('@/lib/services', () => ({
  pollService: {
    listPolls: vi.fn().mockResolvedValue([]),
    getPoll: vi.fn().mockResolvedValue({ id: 'poll-1', title: 'Test' }),
    createPoll: vi.fn().mockResolvedValue({ id: 'poll-new', title: 'New' }),
    updatePoll: vi.fn().mockResolvedValue({ id: 'poll-1', title: 'Updated' }),
    deletePoll: vi.fn().mockResolvedValue(true),
    clonePoll: vi.fn().mockResolvedValue({ id: 'poll-clone', title: 'Test (Copy)' }),
    resetResponses: vi.fn().mockResolvedValue(undefined),
    getPublicPoll: vi.fn().mockResolvedValue({ id: 'poll-1', questions: [] }),
  },
  teamService: {
    getTeam: vi.fn().mockResolvedValue({ id: 'team-1', name: 'Team' }),
  },
  questionService: {
    createQuestion: vi.fn().mockResolvedValue({ id: 'q-1', text: 'Q' }),
    updateQuestion: vi.fn().mockResolvedValue({ id: 'q-1', text: 'Updated' }),
    deleteQuestion: vi.fn().mockResolvedValue(undefined),
  },
  facilitatorService: {
    getState: vi.fn().mockResolvedValue({ votingOpen: false, liveResults: false, anonymise: true, revealStage: 'HIDDEN' }),
    updateState: vi.fn().mockResolvedValue({ votingOpen: true, liveResults: false, anonymise: true, revealStage: 'HIDDEN' }),
  },
  responseService: {
    submitResponses: vi.fn().mockResolvedValue(undefined),
    getResults: vi.fn().mockResolvedValue({ questions: [], participantCount: 0, submissionCount: 0 }),
    clearTestResponses: vi.fn().mockResolvedValue(undefined),
  },
}));

import { createClient } from '@/lib/supabase/server';

function createRequest(url: string, options: RequestInit = {}): Request {
  return new Request(`http://localhost${url}`, options);
}

function mockAuthenticated() {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      }),
    },
  } as any);
}

function mockUnauthenticated() {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      }),
    },
  } as any);
}

describe('Integration: Auth Middleware Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Admin routes reject unauthenticated requests (401)', () => {
    it('GET /api/polls returns 401 without valid auth', async () => {
      mockUnauthenticated();
      const { GET } = await import('@/app/api/polls/route');
      const response = await GET(createRequest('/api/polls'), {} as any);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Authentication required');
    });

    it('POST /api/polls returns 401 without valid auth', async () => {
      mockUnauthenticated();
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

    it('GET /api/polls/[id] returns 401 without valid auth', async () => {
      mockUnauthenticated();
      const { GET } = await import('@/app/api/polls/[id]/route');
      const response = await GET(
        createRequest('/api/polls/poll-1'),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('PATCH /api/polls/[id] returns 401 without valid auth', async () => {
      mockUnauthenticated();
      const { PATCH } = await import('@/app/api/polls/[id]/route');
      const response = await PATCH(
        createRequest('/api/polls/poll-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Updated' }),
        }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('DELETE /api/polls/[id] returns 401 without valid auth', async () => {
      mockUnauthenticated();
      const { DELETE } = await import('@/app/api/polls/[id]/route');
      const response = await DELETE(
        createRequest('/api/polls/poll-1', { method: 'DELETE' }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /api/polls/[id]/clone returns 401 without valid auth', async () => {
      mockUnauthenticated();
      const { POST } = await import('@/app/api/polls/[id]/clone/route');
      const response = await POST(
        createRequest('/api/polls/poll-1/clone', { method: 'POST' }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /api/polls/[id]/reset returns 401 without valid auth', async () => {
      mockUnauthenticated();
      const { POST } = await import('@/app/api/polls/[id]/reset/route');
      const response = await POST(
        createRequest('/api/polls/poll-1/reset', { method: 'POST' }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/polls/[id]/facilitator returns 401 without valid auth', async () => {
      mockUnauthenticated();
      const { GET } = await import('@/app/api/polls/[id]/facilitator/route');
      const response = await GET(
        createRequest('/api/polls/poll-1/facilitator'),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('PATCH /api/polls/[id]/facilitator returns 401 without valid auth', async () => {
      mockUnauthenticated();
      const { PATCH } = await import('@/app/api/polls/[id]/facilitator/route');
      const response = await PATCH(
        createRequest('/api/polls/poll-1/facilitator', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ votingOpen: true }),
        }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /api/polls/[id]/questions returns 401 without valid auth', async () => {
      mockUnauthenticated();
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      const response = await POST(
        createRequest('/api/polls/poll-1/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Q?', options: ['A', 'B'], displayOrder: 0 }),
        }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Admin routes allow authenticated requests', () => {
    it('GET /api/polls succeeds with valid auth', async () => {
      mockAuthenticated();
      const { GET } = await import('@/app/api/polls/route');
      const response = await GET(createRequest('/api/polls'), {} as any);

      expect(response.status).toBe(200);
    });

    it('GET /api/polls/[id] succeeds with valid auth', async () => {
      mockAuthenticated();
      const { GET } = await import('@/app/api/polls/[id]/route');
      const response = await GET(
        createRequest('/api/polls/poll-1'),
        { params: { id: 'poll-1' } } as any
      );

      expect(response.status).toBe(200);
    });

    it('POST /api/polls/[id]/clone succeeds with valid auth', async () => {
      mockAuthenticated();
      const { POST } = await import('@/app/api/polls/[id]/clone/route');
      const response = await POST(
        createRequest('/api/polls/poll-1/clone', { method: 'POST' }),
        { params: { id: 'poll-1' } } as any
      );

      expect(response.status).toBe(201);
    });

    it('GET /api/polls/[id]/facilitator succeeds with valid auth', async () => {
      mockAuthenticated();
      const { GET } = await import('@/app/api/polls/[id]/facilitator/route');
      const response = await GET(
        createRequest('/api/polls/poll-1/facilitator'),
        { params: { id: 'poll-1' } } as any
      );

      expect(response.status).toBe(200);
    });
  });
});
