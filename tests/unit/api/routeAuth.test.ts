import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Route Auth Integration Tests
 *
 * These tests verify the auth behavior at the route level:
 * - Protected routes return 401 without auth
 * - Protected routes return 404 (ownership denied) for wrong owner
 * - Public routes work without auth
 *
 * Unlike other API tests that mock withAuth to pass through,
 * these tests let the real withAuth run and mock the Supabase client
 * to control auth state.
 *
 * Requirements: 4.2, 5.3, 6.1, 6.2, 6.3
 */

const MOCK_USER_ID = 'auth-user-id-123';
const OTHER_USER_ID = 'other-user-id-456';

// Mock the Supabase server client — this controls auth state
const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

// Mock next/headers cookies (required by supabase server client)
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

// Mock the services module
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
  facilitatorService: {
    getState: vi.fn(),
    updateState: vi.fn(),
  },
  questionService: {
    createQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
  },
  responseService: {
    submitResponses: vi.fn(),
    getResults: vi.fn(),
  },
  teamService: {
    getTeam: vi.fn().mockResolvedValue({ id: 'team-1', name: 'Test Team', pin: 'ABC123', userId: 'auth-user-id-123' }),
  },
}));

// Mock rate limit middleware to pass through
vi.mock('@/middleware/rateLimit', () => ({
  withRateLimit: (handler: Function) => handler,
}));

import { pollService, facilitatorService, questionService, responseService } from '@/lib/services';

// Helper to simulate authenticated state
function mockAuthenticated(userId = MOCK_USER_ID) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId, email: 'test@example.com' } },
    error: null,
  });
}

// Helper to simulate unauthenticated state
function mockUnauthenticated() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'No session' },
  });
}

const mockPoll = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Test Poll',
  description: 'A test poll',
  backgroundImageUrl: null,
  userId: MOCK_USER_ID,
  facilitatorState: { _v: 1, votingOpen: true, liveResults: false, anonymise: true, revealStage: 'HIDDEN' },
  isDeleted: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('Route Auth Integration: Protected routes return 401 without auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnauthenticated();
  });

  it('GET /api/polls returns 401 without auth', async () => {
    const { GET } = await import('@/app/api/polls/route');
    const response = await GET(new Request('http://localhost/api/polls'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Authentication required');
  });

  it('POST /api/polls returns 401 without auth', async () => {
    const { POST } = await import('@/app/api/polls/route');
    const response = await POST(
      new Request('http://localhost/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test', teamId: '00000000-0000-0000-0000-000000000001' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/polls/[id] returns 401 without auth', async () => {
    const { GET } = await import('@/app/api/polls/[id]/route');
    const response = await GET(
      new Request('http://localhost/api/polls/123'),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('PATCH /api/polls/[id] returns 401 without auth', async () => {
    const { PATCH } = await import('@/app/api/polls/[id]/route');
    const response = await PATCH(
      new Request('http://localhost/api/polls/123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      }),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('DELETE /api/polls/[id] returns 401 without auth', async () => {
    const { DELETE } = await import('@/app/api/polls/[id]/route');
    const response = await DELETE(
      new Request('http://localhost/api/polls/123', { method: 'DELETE' }),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/polls/[id]/clone returns 401 without auth', async () => {
    const { POST } = await import('@/app/api/polls/[id]/clone/route');
    const response = await POST(
      new Request('http://localhost/api/polls/123/clone', { method: 'POST' }),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/polls/[id]/reset returns 401 without auth', async () => {
    const { POST } = await import('@/app/api/polls/[id]/reset/route');
    const response = await POST(
      new Request('http://localhost/api/polls/123/reset', { method: 'POST' }),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/polls/[id]/facilitator returns 401 without auth', async () => {
    const { GET } = await import('@/app/api/polls/[id]/facilitator/route');
    const response = await GET(
      new Request('http://localhost/api/polls/123/facilitator'),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('PATCH /api/polls/[id]/facilitator returns 401 without auth', async () => {
    const { PATCH } = await import('@/app/api/polls/[id]/facilitator/route');
    const response = await PATCH(
      new Request('http://localhost/api/polls/123/facilitator', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votingOpen: true }),
      }),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/polls/[id]/questions returns 401 without auth', async () => {
    const { POST } = await import('@/app/api/polls/[id]/questions/route');
    const response = await POST(
      new Request('http://localhost/api/polls/123/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Question?', options: ['A', 'B'], displayOrder: 0 }),
      }),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('Route Auth Integration: Protected routes return 404 for wrong owner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Authenticate as a different user than the poll owner
    mockAuthenticated(OTHER_USER_ID);
  });

  it('GET /api/polls/[id] returns 404 when poll not owned by user', async () => {
    const { GET } = await import('@/app/api/polls/[id]/route');
    // Service returns null when userId doesn't match poll owner
    vi.mocked(pollService.getPoll).mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/polls/123'),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(pollService.getPoll).toHaveBeenCalledWith(mockPoll.id, OTHER_USER_ID);
  });

  it('PATCH /api/polls/[id] returns 404 when poll not owned by user', async () => {
    const { PATCH } = await import('@/app/api/polls/[id]/route');
    vi.mocked(pollService.updatePoll).mockResolvedValue(null);

    const response = await PATCH(
      new Request('http://localhost/api/polls/123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hacked Title' }),
      }),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(pollService.updatePoll).toHaveBeenCalledWith(mockPoll.id, { title: 'Hacked Title' }, OTHER_USER_ID);
  });

  it('DELETE /api/polls/[id] returns 404 when poll not owned by user', async () => {
    const { DELETE } = await import('@/app/api/polls/[id]/route');
    vi.mocked(pollService.deletePoll).mockResolvedValue(null as any);

    const response = await DELETE(
      new Request('http://localhost/api/polls/123', { method: 'DELETE' }),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(pollService.deletePoll).toHaveBeenCalledWith(mockPoll.id, OTHER_USER_ID);
  });

  it('POST /api/polls/[id]/clone returns 404 when poll not owned by user', async () => {
    const { POST } = await import('@/app/api/polls/[id]/clone/route');
    vi.mocked(pollService.clonePoll).mockResolvedValue(null as any);

    const response = await POST(
      new Request('http://localhost/api/polls/123/clone', { method: 'POST' }),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(pollService.clonePoll).toHaveBeenCalledWith(mockPoll.id, OTHER_USER_ID);
  });

  it('POST /api/polls/[id]/reset returns 404 when poll not owned by user', async () => {
    const { POST } = await import('@/app/api/polls/[id]/reset/route');
    vi.mocked(pollService.getPoll).mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/polls/123/reset', { method: 'POST' }),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(pollService.getPoll).toHaveBeenCalledWith(mockPoll.id, OTHER_USER_ID);
  });

  it('GET /api/polls/[id]/facilitator returns 404 when poll not owned by user', async () => {
    const { GET } = await import('@/app/api/polls/[id]/facilitator/route');
    vi.mocked(pollService.getPoll).mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/polls/123/facilitator'),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(pollService.getPoll).toHaveBeenCalledWith(mockPoll.id, OTHER_USER_ID);
  });

  it('PATCH /api/polls/[id]/facilitator returns 404 when poll not owned by user', async () => {
    const { PATCH } = await import('@/app/api/polls/[id]/facilitator/route');
    vi.mocked(pollService.getPoll).mockResolvedValue(null);

    const response = await PATCH(
      new Request('http://localhost/api/polls/123/facilitator', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votingOpen: true }),
      }),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(pollService.getPoll).toHaveBeenCalledWith(mockPoll.id, OTHER_USER_ID);
  });

  it('POST /api/polls/[id]/questions returns 404 when poll not owned by user', async () => {
    const { POST } = await import('@/app/api/polls/[id]/questions/route');
    vi.mocked(pollService.getPoll).mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/polls/123/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Question?', options: ['A', 'B'], displayOrder: 0 }),
      }),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(pollService.getPoll).toHaveBeenCalledWith(mockPoll.id, OTHER_USER_ID);
  });
});

describe('Route Auth Integration: Public routes work without auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate no auth — public routes should still work
    mockUnauthenticated();
  });

  it('GET /api/polls/[id]/public works without auth', async () => {
    const { GET } = await import('@/app/api/polls/[id]/public/route');
    vi.mocked(pollService.getPublicPoll).mockResolvedValue(mockPoll as any);

    const response = await GET(
      new Request('http://localhost/api/polls/123/public'),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.title).toBe('Test Poll');
  });

  it('POST /api/polls/[id]/respond works without auth', async () => {
    const { POST } = await import('@/app/api/polls/[id]/respond/route');
    vi.mocked(responseService.submitResponses).mockResolvedValue(undefined);

    const response = await POST(
      new Request('http://localhost/api/polls/123/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantName: 'John Doe',
          sessionToken: '123e4567-e89b-12d3-a456-426614174000',
          answers: [{ questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', selectedOption: 'Option A' }],
          isTest: false,
        }),
      }),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Responses submitted');
  });

  it('GET /api/polls/[id]/results/public works without auth', async () => {
    const { GET } = await import('@/app/api/polls/[id]/results/public/route');
    vi.mocked(pollService.getPublicPoll).mockResolvedValue(mockPoll as any);
    vi.mocked(facilitatorService.getState).mockResolvedValue({
      votingOpen: true,
      liveResults: true,
      anonymise: false,
      revealStage: 'DETAILS',
    });
    vi.mocked(responseService.getResults).mockResolvedValue({
      questions: [],
      participantCount: 0,
      submissionCount: 0,
    });

    const response = await GET(
      new Request('http://localhost/api/polls/123/results/public'),
      { params: { id: mockPoll.id } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('questions');
  });
});
