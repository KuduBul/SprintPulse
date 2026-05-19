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
  questionService: {
    createQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
  },
}));

import { pollService, questionService } from '@/lib/services';
import { createClient } from '@/lib/supabase/server';

function createRequest(url: string, options: RequestInit = {}): Request {
  return new Request(`http://localhost${url}`, options);
}

describe('Integration: Question CRUD API Routes', () => {
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

  describe('POST /api/polls/[id]/questions — Create question', () => {
    it('creates a question with valid data', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue({ id: 'poll-1' } as any);
      const mockQuestion = {
        id: 'q-1',
        text: 'What is your favourite colour?',
        options: ['Red', 'Blue', 'Green'],
        allowCustom: false,
        displayOrder: 0,
      };
      vi.mocked(questionService.createQuestion).mockResolvedValue(mockQuestion as any);

      const response = await POST(
        createRequest('/api/polls/poll-1/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'What is your favourite colour?',
            options: ['Red', 'Blue', 'Green'],
            allowCustom: false,
            displayOrder: 0,
          }),
        }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.text).toBe('What is your favourite colour?');
      expect(body.options).toEqual(['Red', 'Blue', 'Green']);
    });

    it('returns 400 for missing question text', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue({ id: 'poll-1' } as any);

      const response = await POST(
        createRequest('/api/polls/poll-1/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            options: ['A', 'B'],
            displayOrder: 0,
          }),
        }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for fewer than 2 options', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue({ id: 'poll-1' } as any);

      const response = await POST(
        createRequest('/api/polls/poll-1/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Question?',
            options: ['Only one'],
            displayOrder: 0,
          }),
        }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for more than 10 options', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue({ id: 'poll-1' } as any);

      const response = await POST(
        createRequest('/api/polls/poll-1/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Question?',
            options: Array.from({ length: 11 }, (_, i) => `Option ${i + 1}`),
            displayOrder: 0,
          }),
        }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when parent poll not found', async () => {
      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await POST(
        createRequest('/api/polls/nonexistent/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Question?',
            options: ['A', 'B'],
            displayOrder: 0,
          }),
        }),
        { params: { id: 'nonexistent' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
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

      const { POST } = await import('@/app/api/polls/[id]/questions/route');
      const response = await POST(
        createRequest('/api/polls/poll-1/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Question?',
            options: ['A', 'B'],
            displayOrder: 0,
          }),
        }),
        { params: { id: 'poll-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PATCH /api/polls/[id]/questions/[qId] — Update question', () => {
    it('updates a question with valid data', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/questions/[qId]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue({ id: 'poll-1' } as any);
      const updatedQuestion = { id: 'q-1', text: 'Updated question text' };
      vi.mocked(questionService.updateQuestion).mockResolvedValue(updatedQuestion as any);

      const response = await PATCH(
        createRequest('/api/polls/poll-1/questions/q-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Updated question text' }),
        }),
        { params: { id: 'poll-1', qId: 'q-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.text).toBe('Updated question text');
    });

    it('returns 404 when parent poll not found', async () => {
      const { PATCH } = await import('@/app/api/polls/[id]/questions/[qId]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await PATCH(
        createRequest('/api/polls/nonexistent/questions/q-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Updated' }),
        }),
        { params: { id: 'nonexistent', qId: 'q-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/polls/[id]/questions/[qId] — Delete question', () => {
    it('deletes a question successfully', async () => {
      const { DELETE } = await import('@/app/api/polls/[id]/questions/[qId]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue({ id: 'poll-1' } as any);
      vi.mocked(questionService.deleteQuestion).mockResolvedValue(undefined);

      const response = await DELETE(
        createRequest('/api/polls/poll-1/questions/q-1', { method: 'DELETE' }),
        { params: { id: 'poll-1', qId: 'q-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toBe('Question deleted');
    });

    it('returns 404 when parent poll not found', async () => {
      const { DELETE } = await import('@/app/api/polls/[id]/questions/[qId]/route');
      vi.mocked(pollService.getPoll).mockResolvedValue(null);

      const response = await DELETE(
        createRequest('/api/polls/nonexistent/questions/q-1', { method: 'DELETE' }),
        { params: { id: 'nonexistent', qId: 'q-1' } } as any
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
