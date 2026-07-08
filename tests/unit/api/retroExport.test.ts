import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Route-level tests for GET /api/retro/[boardId]/export verifying:
 *  1. 404 when feature flag is off (Requirement 1.2)
 *  2. JSON response with correct Content-Type and Content-Disposition headers
 *  3. CSV response with correct Content-Type and Content-Disposition headers
 *  4. 400 for invalid format parameter
 *
 * Validates: Requirements 10.1, 10.2
 */

const MOCK_USER_ID = 'test-user-id';
const FLAG = 'NEXT_PUBLIC_RETRO_ENABLED';

// Mock the authGuard middleware to pass through with a fake userId
vi.mock('@/middleware/authGuard', () => ({
  withAuth: (handler: Function) => (request: Request, context?: any) =>
    handler(request, { userId: MOCK_USER_ID, ...context }),
}));

// Mock the retroService
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

// Mock the prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    retroBoard: { findUnique: vi.fn() },
  },
}));

describe('GET /api/retro/[boardId]/export', () => {
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

  function createGetRequest(boardId: string, format?: string): Request {
    const url = format
      ? `http://localhost/api/retro/${boardId}/export?format=${format}`
      : `http://localhost/api/retro/${boardId}/export`;
    return new Request(url, { method: 'GET' });
  }

  // ─── Feature flag guard ──────────────────────────────────────────────────

  describe('Feature flag guard (Requirement 1.2)', () => {
    it('returns 404 when flag is off', async () => {
      delete process.env[FLAG];

      const { GET } = await import('@/app/api/retro/[boardId]/export/route');
      const request = createGetRequest('board-1');
      const context = { params: { boardId: 'board-1' } };

      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // ─── JSON response ───────────────────────────────────────────────────────

  describe('JSON export response', () => {
    beforeEach(() => {
      process.env[FLAG] = 'true';
    });

    it('returns JSON with correct Content-Type and Content-Disposition headers', async () => {
      const jsonContent = JSON.stringify({ board: {}, lanes: [] }, null, 2);
      mockRetroService.exportBoard.mockResolvedValue({ format: 'json', content: jsonContent });

      const { GET } = await import('@/app/api/retro/[boardId]/export/route');
      const request = createGetRequest('board-1', 'json');
      const context = { params: { boardId: 'board-1' } };

      const response = await GET(request, context);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
      expect(response.headers.get('Content-Disposition')).toBe(
        'attachment; filename="retro-export-board-1.json"'
      );

      const body = await response.text();
      expect(body).toBe(jsonContent);
    });

    it('defaults to JSON format when no format parameter is given', async () => {
      const jsonContent = JSON.stringify({ board: {}, lanes: [] }, null, 2);
      mockRetroService.exportBoard.mockResolvedValue({ format: 'json', content: jsonContent });

      const { GET } = await import('@/app/api/retro/[boardId]/export/route');
      const request = createGetRequest('board-1'); // no format param
      const context = { params: { boardId: 'board-1' } };

      const response = await GET(request, context);

      expect(response.status).toBe(200);
      expect(mockRetroService.exportBoard).toHaveBeenCalledWith('board-1', 'json');
    });
  });

  // ─── CSV response ────────────────────────────────────────────────────────

  describe('CSV export response', () => {
    beforeEach(() => {
      process.env[FLAG] = 'true';
    });

    it('returns CSV with correct Content-Type and Content-Disposition headers', async () => {
      const csvContent = 'Lane,CardText,Author,VoteCount\nStart,Great work,Alice,2';
      mockRetroService.exportBoard.mockResolvedValue({ format: 'csv', content: csvContent });

      const { GET } = await import('@/app/api/retro/[boardId]/export/route');
      const request = createGetRequest('board-1', 'csv');
      const context = { params: { boardId: 'board-1' } };

      const response = await GET(request, context);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
      expect(response.headers.get('Content-Disposition')).toBe(
        'attachment; filename="retro-export-board-1.csv"'
      );

      const body = await response.text();
      expect(body).toBe(csvContent);
    });
  });

  // ─── Validation ──────────────────────────────────────────────────────────

  describe('Validation errors', () => {
    beforeEach(() => {
      process.env[FLAG] = 'true';
    });

    it('returns 400 for an invalid format parameter', async () => {
      const { GET } = await import('@/app/api/retro/[boardId]/export/route');
      const request = createGetRequest('board-1', 'xml');
      const context = { params: { boardId: 'board-1' } };

      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('json');
      expect(body.error.message).toContain('csv');
    });
  });

  // ─── NOT_FOUND ───────────────────────────────────────────────────────────

  describe('Board not found', () => {
    beforeEach(() => {
      process.env[FLAG] = 'true';
    });

    it('returns 404 when the board does not exist', async () => {
      const notFoundError = new Error('Retro board not found');
      (notFoundError as Error & { code?: string }).code = 'NOT_FOUND';
      mockRetroService.exportBoard.mockRejectedValue(notFoundError);

      const { GET } = await import('@/app/api/retro/[boardId]/export/route');
      const request = createGetRequest('nonexistent', 'json');
      const context = { params: { boardId: 'nonexistent' } };

      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
