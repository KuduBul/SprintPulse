import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Consistent API error response format.
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Format a Zod error into field-level validation details.
 */
export function formatZodError(
  zodError: ZodError
): Array<{ path: (string | number)[]; message: string }> {
  return zodError.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  }));
}

/**
 * 400 — Validation error with field-level details from Zod.
 */
export function validationError(details: unknown): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details,
      },
    },
    { status: 400 }
  );
}

/**
 * 401 — Unauthorized (missing or invalid admin token).
 */
export function unauthorizedError(
  message = 'Invalid or missing admin token'
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: {
        code: 'UNAUTHORIZED',
        message,
      },
    },
    { status: 401 }
  );
}

/**
 * 403 — Forbidden (insufficient permissions).
 */
export function forbiddenError(
  message = 'You do not have permission to perform this action'
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: {
        code: 'FORBIDDEN',
        message,
      },
    },
    { status: 403 }
  );
}

/**
 * 404 — Resource not found.
 */
export function notFoundError(
  message = 'Resource not found'
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: {
        code: 'NOT_FOUND',
        message,
      },
    },
    { status: 404 }
  );
}

/**
 * 409 — Conflict (e.g. duplicate submission).
 */
export function conflictError(
  message = 'Duplicate submission'
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: {
        code: 'CONFLICT',
        message,
      },
    },
    { status: 409 }
  );
}

/**
 * 410 — Voting closed.
 */
export function votingClosedError(): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: {
        code: 'VOTING_CLOSED',
        message: 'Voting is currently closed',
      },
    },
    { status: 410 }
  );
}

/**
 * 410 — Token expired (poll link is no longer valid).
 */
export function tokenExpiredError(
  message = 'This poll link has expired'
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: {
        code: 'TOKEN_EXPIRED',
        message,
      },
    },
    { status: 410 }
  );
}

/**
 * 429 — Rate limited.
 */
export function rateLimitedError(): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
      },
    },
    { status: 429 }
  );
}

/**
 * 500 — Internal server error.
 */
export function internalError(
  message = 'An unexpected error occurred'
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    },
    { status: 500 }
  );
}
