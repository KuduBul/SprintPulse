import { NextResponse } from 'next/server';
import { retroService } from '@/lib/services/retroService';
import { isRetroEnabled } from '@/lib/featureFlags';
import { withAuth } from '@/middleware/authGuard';
import {
  notFoundError,
  internalError,
  validationError,
  forbiddenError,
  formatZodError,
} from '@/lib/api/errors';
import { EditRetroCardSchema, DeleteRetroCardSchema } from '@/lib/validators/schemas';

// Force dynamic rendering.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * PATCH /api/retro/[boardId]/cards/[cardId] — Edit a card's text.
 *
 * Body: { authorToken, text }
 *
 * Phase guard: gather only — service throws WRONG_PHASE otherwise (HTTP 409).
 * Ownership guard: only the card's author may edit — service throws NOT_CARD_OWNER (HTTP 403).
 *
 * Returns 404 when RETRO_ENABLED is false (Requirement 1.2).
 */
export const PATCH = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string; cardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { cardId } = context.params!;
    const body = await request.json();
    const result = EditRetroCardSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const { authorToken, text } = result.data;
    const card = await retroService.editCard(cardId, authorToken, text);
    return NextResponse.json(card);
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    if (err.code === 'WRONG_PHASE') {
      return NextResponse.json(
        { error: { code: 'WRONG_PHASE', message: err.message } },
        { status: 409 }
      );
    }
    if (err.code === 'NOT_CARD_OWNER') {
      return NextResponse.json(
        { error: { code: 'NOT_CARD_OWNER', message: err.message } },
        { status: 403 }
      );
    }
    if (err.code === 'VALIDATION_ERROR') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: err.message } },
        { status: 400 }
      );
    }
    return internalError();
  }
});

/**
 * DELETE /api/retro/[boardId]/cards/[cardId] — Delete a card.
 *
 * Body: { authorToken }
 *
 * Phase guard: gather only — service throws WRONG_PHASE (HTTP 409).
 * Ownership guard: only the card's author — service throws NOT_CARD_OWNER (HTTP 403).
 *
 * Returns 404 when RETRO_ENABLED is false (Requirement 1.2).
 */
export const DELETE = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string; cardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { cardId } = context.params!;
    const body = await request.json();
    const result = DeleteRetroCardSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodError(result.error));
    }

    const { authorToken } = result.data;
    await retroService.deleteCard(cardId, authorToken);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    if (err.code === 'WRONG_PHASE') {
      return NextResponse.json(
        { error: { code: 'WRONG_PHASE', message: err.message } },
        { status: 409 }
      );
    }
    if (err.code === 'NOT_CARD_OWNER') {
      return NextResponse.json(
        { error: { code: 'NOT_CARD_OWNER', message: err.message } },
        { status: 403 }
      );
    }
    return internalError();
  }
});
