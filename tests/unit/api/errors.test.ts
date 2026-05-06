import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validationError,
  unauthorizedError,
  notFoundError,
  conflictError,
  votingClosedError,
  rateLimitedError,
  internalError,
  formatZodError,
} from '@/lib/api/errors';

describe('lib/api/errors', () => {
  describe('formatZodError', () => {
    it('formats a single field error', () => {
      const schema = z.object({ title: z.string().max(200) });
      const result = schema.safeParse({ title: 'a'.repeat(201) });

      if (result.success) throw new Error('Expected validation to fail');

      const formatted = formatZodError(result.error);

      expect(formatted).toHaveLength(1);
      expect(formatted[0].path).toEqual(['title']);
      expect(formatted[0].message).toContain('200');
    });

    it('formats multiple field errors', () => {
      const schema = z.object({
        title: z.string().min(1),
        description: z.string().max(10),
      });
      const result = schema.safeParse({ title: '', description: 'a'.repeat(11) });

      if (result.success) throw new Error('Expected validation to fail');

      const formatted = formatZodError(result.error);

      expect(formatted.length).toBeGreaterThanOrEqual(2);
      const paths = formatted.map((e) => e.path[0]);
      expect(paths).toContain('title');
      expect(paths).toContain('description');
    });

    it('formats nested path errors', () => {
      const schema = z.object({
        answers: z.array(
          z.object({ questionId: z.string().uuid() })
        ),
      });
      const result = schema.safeParse({ answers: [{ questionId: 'not-a-uuid' }] });

      if (result.success) throw new Error('Expected validation to fail');

      const formatted = formatZodError(result.error);

      expect(formatted).toHaveLength(1);
      expect(formatted[0].path).toEqual(['answers', 0, 'questionId']);
    });

    it('returns empty array for valid input (no errors)', () => {
      const schema = z.object({ title: z.string() });
      const result = schema.safeParse({ title: 'valid' });

      if (!result.success) throw new Error('Expected validation to pass');

      // ZodError won't exist for valid input, but we test the function handles empty issues
      const emptyError = new z.ZodError([]);
      const formatted = formatZodError(emptyError);

      expect(formatted).toEqual([]);
    });
  });

  describe('validationError', () => {
    it('returns 400 status with VALIDATION_ERROR code', async () => {
      const details = [{ path: ['title'], message: 'Required' }];
      const response = validationError(details);

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Invalid input');
      expect(body.error.details).toEqual(details);
    });

    it('includes arbitrary details', async () => {
      const details = { custom: 'data' };
      const response = validationError(details);
      const body = await response.json();

      expect(body.error.details).toEqual({ custom: 'data' });
    });
  });

  describe('unauthorizedError', () => {
    it('returns 401 status with UNAUTHORIZED code and default message', async () => {
      const response = unauthorizedError();

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Invalid or missing admin token');
    });

    it('accepts a custom message', async () => {
      const response = unauthorizedError('Token expired');
      const body = await response.json();

      expect(body.error.message).toBe('Token expired');
    });
  });

  describe('notFoundError', () => {
    it('returns 404 status with NOT_FOUND code and default message', async () => {
      const response = notFoundError();

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Resource not found');
    });

    it('accepts a custom message', async () => {
      const response = notFoundError('Poll not found');
      const body = await response.json();

      expect(body.error.message).toBe('Poll not found');
    });
  });

  describe('conflictError', () => {
    it('returns 409 status with CONFLICT code and default message', async () => {
      const response = conflictError();

      expect(response.status).toBe(409);

      const body = await response.json();
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toBe('Duplicate submission');
    });

    it('accepts a custom message', async () => {
      const response = conflictError('Session already submitted');
      const body = await response.json();

      expect(body.error.message).toBe('Session already submitted');
    });
  });

  describe('votingClosedError', () => {
    it('returns 410 status with VOTING_CLOSED code', async () => {
      const response = votingClosedError();

      expect(response.status).toBe(410);

      const body = await response.json();
      expect(body.error.code).toBe('VOTING_CLOSED');
      expect(body.error.message).toBe('Voting is currently closed');
    });
  });

  describe('rateLimitedError', () => {
    it('returns 429 status with RATE_LIMITED code', async () => {
      const response = rateLimitedError();

      expect(response.status).toBe(429);

      const body = await response.json();
      expect(body.error.code).toBe('RATE_LIMITED');
      expect(body.error.message).toBe('Too many requests, please try again later');
    });
  });

  describe('internalError', () => {
    it('returns 500 status with INTERNAL_ERROR code and default message', async () => {
      const response = internalError();

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('An unexpected error occurred');
    });

    it('accepts a custom message', async () => {
      const response = internalError('Database connection failed');
      const body = await response.json();

      expect(body.error.message).toBe('Database connection failed');
    });
  });

  describe('API error format consistency', () => {
    it('all error responses have the standard ApiError shape', async () => {
      const responses = [
        validationError([]),
        unauthorizedError(),
        notFoundError(),
        conflictError(),
        votingClosedError(),
        rateLimitedError(),
        internalError(),
      ];

      for (const response of responses) {
        const body = await response.json();
        expect(body).toHaveProperty('error');
        expect(body.error).toHaveProperty('code');
        expect(body.error).toHaveProperty('message');
        expect(typeof body.error.code).toBe('string');
        expect(typeof body.error.message).toBe('string');
      }
    });
  });
});
