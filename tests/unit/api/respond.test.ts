import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the responseService module
vi.mock('@/lib/services', () => ({
  responseService: {
    submitResponses: vi.fn(),
  },
}));

// Mock the rateLimit middleware to pass through
vi.mock('@/middleware/rateLimit', () => ({
  withRateLimit: (handler: Function) => handler,
}));

import { responseService } from '@/lib/services';

const validSubmission = {
  participantName: 'John Doe',
  sessionToken: '123e4567-e89b-12d3-a456-426614174000',
  answers: [
    {
      questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      selectedOption: 'Option A',
    },
  ],
  isTest: false,
};

function createRequest(body: unknown): Request {
  return new Request('http://localhost/api/polls/poll-123/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('app/api/polls/[id]/respond/route.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/polls/[id]/respond', () => {
    it('submits responses successfully', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');
      vi.mocked(responseService.submitResponses).mockResolvedValue(undefined);

      const context = { params: { id: 'poll-123' } };
      const response = await POST(createRequest(validSubmission), context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toBe('Responses submitted');
      expect(responseService.submitResponses).toHaveBeenCalledWith('poll-123', validSubmission);
    });

    it('returns 400 for invalid body (missing participantName)', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');

      const context = { params: { id: 'poll-123' } };
      const response = await POST(
        createRequest({ sessionToken: validSubmission.sessionToken, answers: validSubmission.answers }),
        context
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid sessionToken (not UUID)', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');

      const context = { params: { id: 'poll-123' } };
      const response = await POST(
        createRequest({ ...validSubmission, sessionToken: 'not-a-uuid' }),
        context
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for empty answers array', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');

      const context = { params: { id: 'poll-123' } };
      const response = await POST(
        createRequest({ ...validSubmission, answers: [] }),
        context
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for participantName too short', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');

      const context = { params: { id: 'poll-123' } };
      const response = await POST(
        createRequest({ ...validSubmission, participantName: 'A' }),
        context
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 410 when voting is closed', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');
      const error = new Error('Voting is currently closed');
      (error as any).code = 'VOTING_CLOSED';
      vi.mocked(responseService.submitResponses).mockRejectedValue(error);

      const context = { params: { id: 'poll-123' } };
      const response = await POST(createRequest(validSubmission), context);
      const body = await response.json();

      expect(response.status).toBe(410);
      expect(body.error.code).toBe('VOTING_CLOSED');
    });

    it('returns 409 for duplicate session token submission', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');
      const error = new Error('Already submitted for this poll');
      (error as any).code = 'CONFLICT';
      vi.mocked(responseService.submitResponses).mockRejectedValue(error);

      const context = { params: { id: 'poll-123' } };
      const response = await POST(createRequest(validSubmission), context);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('returns 400 for validation errors from service', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');
      const error = new Error('All questions must be answered');
      (error as any).code = 'VALIDATION_ERROR';
      vi.mocked(responseService.submitResponses).mockRejectedValue(error);

      const context = { params: { id: 'poll-123' } };
      const response = await POST(createRequest(validSubmission), context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 500 on unexpected internal error', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');
      vi.mocked(responseService.submitResponses).mockRejectedValue(new Error('DB error'));

      const context = { params: { id: 'poll-123' } };
      const response = await POST(createRequest(validSubmission), context);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('does not require admin authentication', async () => {
      const { POST } = await import('@/app/api/polls/[id]/respond/route');
      vi.mocked(responseService.submitResponses).mockResolvedValue(undefined);

      // No admin token header — should still succeed
      const context = { params: { id: 'poll-123' } };
      const response = await POST(createRequest(validSubmission), context);

      expect(response.status).toBe(200);
    });
  });
});
