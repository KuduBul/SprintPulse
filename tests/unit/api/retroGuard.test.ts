import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextResponse } from 'next/server';
import { retroFlagGuard, withRetroFlag } from '@/lib/api/retroGuard';

/**
 * Retro feature-flag server guard tests.
 *
 * The server guard is the real security boundary for production isolation
 * (Requirement 1): when `NEXT_PUBLIC_RETRO_ENABLED` is off, retro routes must
 * respond as if they do not exist (HTTP 404, code NOT_FOUND) — never 403, which
 * would betray the feature's existence.
 *
 * `retroFlagGuard`/`withRetroFlag` call `isRetroEnabled()` (which reads
 * `process.env` at call time), so these tests manipulate the env var directly
 * and restore it afterwards.
 *
 * Requirements: 1.2, 1.3, 1.4
 */

const FLAG = 'NEXT_PUBLIC_RETRO_ENABLED';

describe('lib/api/retroGuard', () => {
  let originalFlag: string | undefined;

  beforeEach(() => {
    // Snapshot the real env so test mutations never leak between tests.
    originalFlag = process.env[FLAG];
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env[FLAG];
    } else {
      process.env[FLAG] = originalFlag;
    }
    vi.restoreAllMocks();
  });

  describe('retroFlagGuard', () => {
    it('returns a 404 NOT_FOUND response when the flag is unset (production-like)', async () => {
      // Requirements 1.2, 1.3 — absent flag is the production default.
      delete process.env[FLAG];

      const response = retroFlagGuard();

      expect(response).not.toBeNull();
      expect(response!.status).toBe(404);

      const body = await response!.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns null (proceed) when the flag is exactly "true"', () => {
      // Requirement 1.4 — only the literal string "true" enables retro.
      process.env[FLAG] = 'true';

      expect(retroFlagGuard()).toBeNull();
    });

    it.each(['false', 'TRUE', 'True', '1', '0', '', 'yes', 'on'])(
      'returns 404 for the non-enabling value %j (treated as disabled)',
      async (value) => {
        // Requirement 1.3 — anything other than "true" is disabled.
        process.env[FLAG] = value;

        const response = retroFlagGuard();

        expect(response).not.toBeNull();
        expect(response!.status).toBe(404);

        const body = await response!.json();
        expect(body.error.code).toBe('NOT_FOUND');
      }
    );

    it('does not return a 403 when disabled (must look like a missing route, not forbidden)', () => {
      // Requirement 1.2 — 404, never 403.
      delete process.env[FLAG];

      const response = retroFlagGuard();

      expect(response!.status).toBe(404);
      expect(response!.status).not.toBe(403);
    });
  });

  describe('withRetroFlag', () => {
    it('does NOT invoke the wrapped handler and returns 404 when the flag is unset', async () => {
      // Requirements 1.2, 1.3 — handler is never reached while disabled.
      delete process.env[FLAG];

      const handler = vi.fn(() => NextResponse.json({ ok: true }, { status: 200 }));
      const wrapped = withRetroFlag(handler);

      const response = await wrapped();

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('invokes the wrapped handler and returns its response when the flag is "true"', async () => {
      // Requirement 1.4 — handler runs normally when enabled.
      process.env[FLAG] = 'true';

      const handlerResponse = NextResponse.json({ ok: true }, { status: 200 });
      const handler = vi.fn(() => handlerResponse);
      const wrapped = withRetroFlag(handler);

      const response = await wrapped();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(response).toBe(handlerResponse);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    it('forwards handler arguments unchanged when enabled', async () => {
      process.env[FLAG] = 'true';

      const handler = vi.fn((_request: Request, context: { params: { boardId: string } }) =>
        NextResponse.json({ boardId: context.params.boardId }, { status: 200 })
      );
      const wrapped = withRetroFlag(handler);

      const request = new Request('http://localhost/api/retro/board-123');
      const context = { params: { boardId: 'board-123' } };
      const response = await wrapped(request, context);

      expect(handler).toHaveBeenCalledWith(request, context);
      const body = await response.json();
      expect(body.boardId).toBe('board-123');
    });

    it.each(['false', 'TRUE', '1', ''])(
      'short-circuits to 404 without invoking the handler for non-enabling value %j',
      async (value) => {
        // Requirement 1.3 — non-"true" values keep the route invisible.
        process.env[FLAG] = value;

        const handler = vi.fn(() => NextResponse.json({ ok: true }, { status: 200 }));
        const wrapped = withRetroFlag(handler);

        const response = await wrapped();

        expect(handler).not.toHaveBeenCalled();
        expect(response.status).toBe(404);
      }
    );
  });
});
