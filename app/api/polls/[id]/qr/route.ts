import { withAuth } from '@/middleware/authGuard';
import { pollService, tokenService, qrService } from '@/lib/services';
import { notFoundError, internalError } from '@/lib/api/errors';

/**
 * GET /api/polls/[id]/qr — Generate and return a QR code PNG for the poll's access URL.
 * Requires authentication. Facilitator must own the poll.
 * Returns PNG image with Content-Type: image/png header.
 */
export const GET = withAuth(async (_request: Request, context: { userId: string; params?: { id: string } }) => {
  try {
    const { id } = context.params!;

    // Verify poll exists and belongs to the authenticated user
    const poll = await pollService.getPoll(id, context.userId);

    if (!poll) {
      return notFoundError('Poll not found');
    }

    // Generate the full poll URL from the access token
    const pollUrl = tokenService.buildPollUrl(poll.accessToken);

    // Generate QR code as PNG buffer
    const buffer = await qrService.generateQRCodeBuffer(pollUrl);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return internalError();
  }
});
