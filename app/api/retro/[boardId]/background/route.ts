import { NextResponse } from 'next/server';
import { isRetroEnabled } from '@/lib/featureFlags';
import { withAuth } from '@/middleware/authGuard';
import { notFoundError, internalError } from '@/lib/api/errors';
import { uploadBackgroundImage, deleteBackgroundImage } from '@/lib/retro/imageService';
import { prisma } from '@/lib/db/client';

// Force dynamic rendering — these routes hit the database on every request.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/retro/[boardId]/background — Upload a background image for the board.
 *
 * Accepts multipart/form-data with:
 *   - file: The image file (JPEG, PNG, or WebP, max 10MB)
 *   - opacity: (optional) number 0–100, defaults to 100
 *   - displayMode: (optional) "cover" | "contain", defaults to "cover"
 *
 * Facilitator-only (authenticated via withAuth).
 * Processes the image (resize/compress) and uploads to Supabase Storage.
 * Stores the result in RetroBoard.backgroundImage JSON field.
 *
 * Returns 200 with { url, storagePath, opacity, displayMode }.
 * Returns 400 INVALID_FILE_TYPE for unsupported file types.
 * Returns 400 FILE_TOO_LARGE for files exceeding 10MB.
 * Returns 404 when RETRO_ENABLED is false or board not found.
 * Returns 500 UPLOAD_FAILED on storage errors.
 *
 * Requirements: 5.6, 5.7, 12.1, 12.3
 */
export const POST = withAuth(async (request: Request, context: { userId: string; params?: { boardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { boardId } = context.params!;

    // Verify the board exists
    const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
    if (!board) {
      return notFoundError('Retro board not found');
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'A file is required' } },
        { status: 400 }
      );
    }

    // Extract optional parameters
    const opacityRaw = formData.get('opacity');
    const displayModeRaw = formData.get('displayMode');

    const opacity = opacityRaw ? Math.min(100, Math.max(0, Number(opacityRaw))) : 100;
    const displayMode = displayModeRaw === 'contain' ? 'contain' : 'cover';

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type;

    // Upload and process the image
    const result = await uploadBackgroundImage(boardId, buffer, mimeType);

    // Store the background image metadata in the board's JSON field
    const backgroundImage = {
      url: result.url,
      storagePath: result.storagePath,
      opacity,
      displayMode,
    };

    await prisma.retroBoard.update({
      where: { id: boardId },
      data: { backgroundImage: backgroundImage as any },
    });

    return NextResponse.json(backgroundImage, { status: 200 });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    if (err.code === 'INVALID_FILE_TYPE') {
      return NextResponse.json(
        { error: { code: 'INVALID_FILE_TYPE', message: err.message } },
        { status: 400 }
      );
    }
    if (err.code === 'FILE_TOO_LARGE') {
      return NextResponse.json(
        { error: { code: 'FILE_TOO_LARGE', message: err.message } },
        { status: 400 }
      );
    }
    if (err.code === 'UPLOAD_FAILED') {
      return NextResponse.json(
        { error: { code: 'UPLOAD_FAILED', message: err.message } },
        { status: 500 }
      );
    }
    return internalError();
  }
});

/**
 * DELETE /api/retro/[boardId]/background — Remove the background image from the board.
 *
 * Facilitator-only (authenticated via withAuth).
 * Removes the image from Supabase Storage and clears the backgroundImage field.
 *
 * Returns 204 on success.
 * Returns 404 when RETRO_ENABLED is false or board not found.
 *
 * Requirements: 12.3
 */
export const DELETE = withAuth(async (_request: Request, context: { userId: string; params?: { boardId: string } }) => {
  if (!isRetroEnabled()) {
    return notFoundError();
  }

  try {
    const { boardId } = context.params!;

    // Verify the board exists
    const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
    if (!board) {
      return notFoundError('Retro board not found');
    }

    // Delete from storage and clear the backgroundImage field
    await deleteBackgroundImage(boardId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'NOT_FOUND') {
      return notFoundError(err.message);
    }
    return internalError();
  }
});
