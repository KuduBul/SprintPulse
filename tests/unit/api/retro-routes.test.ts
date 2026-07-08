import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Route-level tests for retro API endpoints verifying:
 *  1. Feature-flag guard (404 when disabled) — Requirement 1.2
 *  2. Phase rules (409 WRONG_PHASE) — Requirements 5.6, 7.4, 8.3
 *  3. Vote cap enforcement (409 VOTE_CAP_EXCEEDED) — Requirements 7.2, 7.3
 *  4. Ownership guard (403 NOT_CARD_OWNER) — Requirement 5.4
 *  5. Validation errors (400) — input validation
 */

const MOCK_USER_ID = 'test-user-id';
const FLAG = 'NEXT_PUBLIC_RETRO_ENABLED';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock the authGuard middleware to pass through with a fake userId
vi.mock('@/middleware/authGuard', () => ({
  withAuth: (handler: Function) => (request: Request, context?: any) =>
    handler(request, { userId: MOCK_USER_ID, ...context }),
}));

// Mock the retroService — we test the route layer's error-to-HTTP mapping,
// not the service's internals (those are covered by property and unit tests).
const mockRetroService = {
  createBoard: vi.fn(),
  getBoard: vi.fn(),
  addCard: vi.fn(),
  editCard: vi.fn(),
  deleteCard: vi.fn(),
  castVote: vi.fn(),
  removeVote: vi.fn(),
  setPhase: vi.fn(),
  exportBoard: vi.fn(),
};

vi.mock('@/lib/services/retroService', () => ({
  retroService: mockRetroService,
  createRetroService: () => mockRetroService,
}));

// Mock the prisma client (used by the GET board route to resolve boardId)
const mockPrisma = {
  retroBoard: {
    findUnique: vi.fn(),
  },
};

vi.mock('@/lib/db/client', () => ({
  prisma: mockPrisma,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createRequest(url: string, body?: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function serviceError(message: string, code: string): Error {
  const error = new Error(message);
  (error as Error & { code?: string }).code = code;
  return error;
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

describe('Retro API Routes', () => {
  let originalFlag: string | undefined;

  beforeEach(() => {
    originalFlag = process.env[FLAG];
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env[FLAG];
    } else {
      process.env[FLAG] = originalFlag;
    }
    vi.restoreAllMocks();
  });

  // ─── 1. Feature Flag Guard ───────────────────────────────────────────────

  describe('Feature flag guard (Requirement 1.2)', () => {
    beforeEach(() => {
      delete process.env[FLAG]; // disabled
    });

    it('GET /api/retro/[boardId] returns 404 when flag is off', async () => {
      const { GET } = await import('@/app/api/retro/[boardId]/route');
      const request = createRequest('http://localhost/api/retro/board-1', undefined, 'GET');
      const context = { params: { boardId: 'board-1' } };

      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('POST /api/retro/[boardId]/cards returns 404 when flag is off', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/cards/route');
      const request = createRequest('http://localhost/api/retro/board-1/cards', {
        laneId: '00000000-0000-0000-0000-000000000001',
        authorToken: 'tok-1',
        authorName: 'Alice',
        text: 'Some card',
      });
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('PATCH /api/retro/[boardId]/cards/[cardId] returns 404 when flag is off', async () => {
      const { PATCH } = await import('@/app/api/retro/[boardId]/cards/[cardId]/route');
      const request = createRequest(
        'http://localhost/api/retro/board-1/cards/card-1',
        { authorToken: 'tok-1', text: 'Updated' },
        'PATCH'
      );
      const context = { params: { boardId: 'board-1', cardId: 'card-1' } };

      const response = await PATCH(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('DELETE /api/retro/[boardId]/cards/[cardId] returns 404 when flag is off', async () => {
      const { DELETE } = await import('@/app/api/retro/[boardId]/cards/[cardId]/route');
      const request = createRequest(
        'http://localhost/api/retro/board-1/cards/card-1',
        { authorToken: 'tok-1' },
        'DELETE'
      );
      const context = { params: { boardId: 'board-1', cardId: 'card-1' } };

      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('POST /api/retro/[boardId]/votes returns 404 when flag is off', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/votes/route');
      const request = createRequest('http://localhost/api/retro/board-1/votes', {
        cardId: '00000000-0000-0000-0000-000000000001',
        voterToken: 'tok-1',
      });
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('DELETE /api/retro/[boardId]/votes returns 404 when flag is off', async () => {
      const { DELETE } = await import('@/app/api/retro/[boardId]/votes/route');
      const request = createRequest(
        'http://localhost/api/retro/board-1/votes',
        { cardId: '00000000-0000-0000-0000-000000000001', voterToken: 'tok-1' },
        'DELETE'
      );
      const context = { params: { boardId: 'board-1' } };

      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('POST /api/retro/[boardId]/phase returns 404 when flag is off', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/phase/route');
      const request = createRequest('http://localhost/api/retro/board-1/phase', {
        phase: 'vote',
      });
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // ─── 2. Phase Rules (409 WRONG_PHASE) ────────────────────────────────────

  describe('Phase rules — 409 WRONG_PHASE (Requirements 5.6, 7.4, 8.3)', () => {
    beforeEach(() => {
      process.env[FLAG] = 'true';
    });

    it('POST /cards returns 409 WRONG_PHASE when adding card outside gather', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/cards/route');
      mockRetroService.addCard.mockRejectedValue(
        serviceError('Cards can only be added during the gather phase', 'WRONG_PHASE')
      );

      const request = createRequest('http://localhost/api/retro/board-1/cards', {
        laneId: '00000000-0000-0000-0000-000000000001',
        authorToken: 'tok-1',
        authorName: 'Alice',
        text: 'Card during vote phase',
      });
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('WRONG_PHASE');
    });

    it('PATCH /cards/[cardId] returns 409 WRONG_PHASE when editing outside gather', async () => {
      const { PATCH } = await import('@/app/api/retro/[boardId]/cards/[cardId]/route');
      mockRetroService.editCard.mockRejectedValue(
        serviceError('Cards can only be edited during the gather phase', 'WRONG_PHASE')
      );

      const request = createRequest(
        'http://localhost/api/retro/board-1/cards/card-1',
        { authorToken: 'tok-1', text: 'Edit attempt' },
        'PATCH'
      );
      const context = { params: { boardId: 'board-1', cardId: 'card-1' } };

      const response = await PATCH(request, context);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('WRONG_PHASE');
    });

    it('DELETE /cards/[cardId] returns 409 WRONG_PHASE when deleting outside gather', async () => {
      const { DELETE } = await import('@/app/api/retro/[boardId]/cards/[cardId]/route');
      mockRetroService.deleteCard.mockRejectedValue(
        serviceError('Cards can only be deleted during the gather phase', 'WRONG_PHASE')
      );

      const request = createRequest(
        'http://localhost/api/retro/board-1/cards/card-1',
        { authorToken: 'tok-1' },
        'DELETE'
      );
      const context = { params: { boardId: 'board-1', cardId: 'card-1' } };

      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('WRONG_PHASE');
    });

    it('POST /votes returns 409 WRONG_PHASE when voting outside vote phase', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/votes/route');
      mockRetroService.castVote.mockRejectedValue(
        serviceError('Votes can only be cast during the vote phase', 'WRONG_PHASE')
      );

      const request = createRequest('http://localhost/api/retro/board-1/votes', {
        cardId: '00000000-0000-0000-0000-000000000001',
        voterToken: 'tok-1',
      });
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('WRONG_PHASE');
    });

    it('DELETE /votes returns 409 WRONG_PHASE when removing vote outside vote phase', async () => {
      const { DELETE } = await import('@/app/api/retro/[boardId]/votes/route');
      mockRetroService.removeVote.mockRejectedValue(
        serviceError('Votes can only be removed during the vote phase', 'WRONG_PHASE')
      );

      const request = createRequest(
        'http://localhost/api/retro/board-1/votes',
        { cardId: '00000000-0000-0000-0000-000000000001', voterToken: 'tok-1' },
        'DELETE'
      );
      const context = { params: { boardId: 'board-1' } };

      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('WRONG_PHASE');
    });

    it('POST /phase returns 409 WRONG_PHASE for invalid phase transition (backward)', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/phase/route');
      mockRetroService.setPhase.mockRejectedValue(
        serviceError('Cannot move retro phase backward from closed to gather', 'INVALID_PHASE_TRANSITION')
      );

      const request = createRequest('http://localhost/api/retro/board-1/phase', {
        phase: 'gather',
      });
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('WRONG_PHASE');
    });
  });

  // ─── 3. Vote Cap (409 VOTE_CAP_EXCEEDED) ─────────────────────────────────

  describe('Vote cap — 409 VOTE_CAP_EXCEEDED (Requirement 7.2)', () => {
    beforeEach(() => {
      process.env[FLAG] = 'true';
    });

    it('POST /votes returns 409 VOTE_CAP_EXCEEDED when voter exceeds votesPerUser', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/votes/route');
      mockRetroService.castVote.mockRejectedValue(
        serviceError('Vote cap exceeded for this voter', 'VOTE_CAP_EXCEEDED')
      );

      const request = createRequest('http://localhost/api/retro/board-1/votes', {
        cardId: '00000000-0000-0000-0000-000000000001',
        voterToken: 'tok-1',
      });
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('VOTE_CAP_EXCEEDED');
    });
  });

  // ─── 4. Ownership (403 NOT_CARD_OWNER) ───────────────────────────────────

  describe('Ownership — 403 NOT_CARD_OWNER (Requirement 5.4)', () => {
    beforeEach(() => {
      process.env[FLAG] = 'true';
    });

    it('PATCH /cards/[cardId] returns 403 NOT_CARD_OWNER when editing another user\'s card', async () => {
      const { PATCH } = await import('@/app/api/retro/[boardId]/cards/[cardId]/route');
      mockRetroService.editCard.mockRejectedValue(
        serviceError('Only the card author may edit this card', 'NOT_CARD_OWNER')
      );

      const request = createRequest(
        'http://localhost/api/retro/board-1/cards/card-1',
        { authorToken: 'wrong-token', text: 'Hijack attempt' },
        'PATCH'
      );
      const context = { params: { boardId: 'board-1', cardId: 'card-1' } };

      const response = await PATCH(request, context);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error.code).toBe('NOT_CARD_OWNER');
    });

    it('DELETE /cards/[cardId] returns 403 NOT_CARD_OWNER when deleting another user\'s card', async () => {
      const { DELETE } = await import('@/app/api/retro/[boardId]/cards/[cardId]/route');
      mockRetroService.deleteCard.mockRejectedValue(
        serviceError('Only the card author may delete this card', 'NOT_CARD_OWNER')
      );

      const request = createRequest(
        'http://localhost/api/retro/board-1/cards/card-1',
        { authorToken: 'wrong-token' },
        'DELETE'
      );
      const context = { params: { boardId: 'board-1', cardId: 'card-1' } };

      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error.code).toBe('NOT_CARD_OWNER');
    });
  });

  // ─── 5. Validation (400 VALIDATION_ERROR) ────────────────────────────────

  describe('Validation — 400 errors', () => {
    beforeEach(() => {
      process.env[FLAG] = 'true';
    });

    it('POST /cards returns 400 for empty text', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/cards/route');

      const request = createRequest('http://localhost/api/retro/board-1/cards', {
        laneId: '00000000-0000-0000-0000-000000000001',
        authorToken: 'tok-1',
        authorName: 'Alice',
        text: '',
      });
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /cards returns 400 for missing laneId', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/cards/route');

      const request = createRequest('http://localhost/api/retro/board-1/cards', {
        authorToken: 'tok-1',
        authorName: 'Alice',
        text: 'Valid text',
      });
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /cards returns 400 for missing authorToken', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/cards/route');

      const request = createRequest('http://localhost/api/retro/board-1/cards', {
        laneId: '00000000-0000-0000-0000-000000000001',
        authorName: 'Alice',
        text: 'Valid text',
      });
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('PATCH /cards/[cardId] returns 400 for empty text', async () => {
      const { PATCH } = await import('@/app/api/retro/[boardId]/cards/[cardId]/route');

      const request = createRequest(
        'http://localhost/api/retro/board-1/cards/card-1',
        { authorToken: 'tok-1', text: '' },
        'PATCH'
      );
      const context = { params: { boardId: 'board-1', cardId: 'card-1' } };

      const response = await PATCH(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('PATCH /cards/[cardId] returns 400 for missing authorToken', async () => {
      const { PATCH } = await import('@/app/api/retro/[boardId]/cards/[cardId]/route');

      const request = createRequest(
        'http://localhost/api/retro/board-1/cards/card-1',
        { text: 'Some text' },
        'PATCH'
      );
      const context = { params: { boardId: 'board-1', cardId: 'card-1' } };

      const response = await PATCH(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('DELETE /cards/[cardId] returns 400 for missing authorToken', async () => {
      const { DELETE } = await import('@/app/api/retro/[boardId]/cards/[cardId]/route');

      const request = createRequest(
        'http://localhost/api/retro/board-1/cards/card-1',
        {},
        'DELETE'
      );
      const context = { params: { boardId: 'board-1', cardId: 'card-1' } };

      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /votes returns 400 for missing cardId', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/votes/route');

      const request = createRequest('http://localhost/api/retro/board-1/votes', {
        voterToken: 'tok-1',
      });
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /votes returns 400 for invalid cardId (not UUID)', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/votes/route');

      const request = createRequest('http://localhost/api/retro/board-1/votes', {
        cardId: 'not-a-uuid',
        voterToken: 'tok-1',
      });
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /votes returns 400 for missing voterToken', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/votes/route');

      const request = createRequest('http://localhost/api/retro/board-1/votes', {
        cardId: '00000000-0000-0000-0000-000000000001',
      });
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /phase returns 400 for invalid phase value', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/phase/route');

      const request = createRequest('http://localhost/api/retro/board-1/phase', {
        phase: 'invalid_phase',
      });
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /phase returns 400 for missing phase field', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/phase/route');

      const request = createRequest('http://localhost/api/retro/board-1/phase', {});
      const context = { params: { boardId: 'board-1' } };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── 6. Participant access (no facilitator auth required) ────────────────
  //
  // Regression guard: participants are NOT authenticated facilitators. Their
  // card/vote mutations must succeed without a Supabase session — identity is
  // the authorToken/voterToken in the body. A prior bug gated these routes
  // behind withAuth, so every participant mutation returned 401 and their
  // cards vanished. These tests call the routes with NO userId in context
  // (simulating an unauthenticated participant) and assert the request reaches
  // the service rather than being rejected.

  describe('Participant access — no facilitator auth required', () => {
    beforeEach(() => {
      process.env[FLAG] = 'true';
    });

    it('POST /cards succeeds for an unauthenticated participant', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/cards/route');
      mockRetroService.addCard.mockResolvedValue({
        id: 'card-1',
        laneId: '00000000-0000-0000-0000-000000000001',
        text: 'Participant card',
        authorToken: 'participant-tok',
        authorName: 'Bob',
        createdAt: new Date(),
      });

      const request = createRequest('http://localhost/api/retro/board-1/cards', {
        laneId: '00000000-0000-0000-0000-000000000001',
        authorToken: 'participant-tok',
        authorName: 'Bob',
        text: 'Participant card',
      });
      // No userId in context — an unauthenticated participant.
      const response = await POST(request, { params: { boardId: 'board-1' } });

      expect(response.status).toBe(201);
      expect(mockRetroService.addCard).toHaveBeenCalledOnce();
    });

    it('POST /votes succeeds for an unauthenticated participant', async () => {
      const { POST } = await import('@/app/api/retro/[boardId]/votes/route');
      mockRetroService.castVote.mockResolvedValue(undefined);

      const request = createRequest('http://localhost/api/retro/board-1/votes', {
        cardId: '00000000-0000-0000-0000-000000000001',
        voterToken: 'participant-tok',
      });
      const response = await POST(request, { params: { boardId: 'board-1' } });

      expect(response.status).toBe(204);
      expect(mockRetroService.castVote).toHaveBeenCalledOnce();
    });

    it('PATCH /cards/[cardId] succeeds for an unauthenticated participant (own card)', async () => {
      const { PATCH } = await import('@/app/api/retro/[boardId]/cards/[cardId]/route');
      mockRetroService.editCard.mockResolvedValue({
        id: 'card-1',
        laneId: '00000000-0000-0000-0000-000000000001',
        text: 'Edited',
        authorToken: 'participant-tok',
        authorName: 'Bob',
        createdAt: new Date(),
      });

      const request = createRequest(
        'http://localhost/api/retro/board-1/cards/card-1',
        { authorToken: 'participant-tok', text: 'Edited' },
        'PATCH'
      );
      const response = await PATCH(request, { params: { boardId: 'board-1', cardId: 'card-1' } });

      expect(response.status).toBe(200);
      expect(mockRetroService.editCard).toHaveBeenCalledOnce();
    });

    it('DELETE /cards/[cardId] succeeds for an unauthenticated participant (own card)', async () => {
      const { DELETE } = await import('@/app/api/retro/[boardId]/cards/[cardId]/route');
      mockRetroService.deleteCard.mockResolvedValue(undefined);

      const request = createRequest(
        'http://localhost/api/retro/board-1/cards/card-1',
        { authorToken: 'participant-tok' },
        'DELETE'
      );
      const response = await DELETE(request, { params: { boardId: 'board-1', cardId: 'card-1' } });

      expect(response.status).toBe(204);
      expect(mockRetroService.deleteCard).toHaveBeenCalledOnce();
    });
  });
});
