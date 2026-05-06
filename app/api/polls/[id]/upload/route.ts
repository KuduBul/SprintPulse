import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/middleware/adminAuth';
import { pollService } from '@/lib/services';
import { validateImage } from '@/lib/validators/imageValidator';
import { uploadPollBackground } from '@/lib/storage/supabaseStorage';
import { notFoundError, internalError, validationError } from '@/lib/api/errors';

/**
 * POST /api/polls/[id]/upload — Upload a background image for a poll (admin auth required).
 *
 * Accepts multipart form data with a `file` field.
 * Validates file type (JPEG, PNG, WebP) and size (≤5MB).
 * Uploads to Supabase Storage and updates the poll's backgroundImageUrl.
 */
export const POST = withAdminAuth(async (request: Request, context: { params: { id: string } }) => {
  try {
    const { id } = context.params;

    // Verify poll exists
    const poll = await pollService.getPoll(id);
    if (!poll) {
      return notFoundError('Poll not found');
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return validationError([{ path: ['file'], message: 'A file is required' }]);
    }

    // Validate file type and size
    const validation = validateImage(file.type, file.size);
    if (!validation.valid) {
      return validationError([{ path: ['file'], message: validation.error! }]);
    }

    // Convert File to Buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    let publicUrl: string;
    try {
      publicUrl = await uploadPollBackground(id, buffer, file.type);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Upload failed';
      return internalError(`Image upload failed: ${message}`);
    }

    // Update poll with new background image URL
    const updatedPoll = await pollService.updatePoll(id, {
      backgroundImageUrl: publicUrl,
    });

    return NextResponse.json(updatedPoll);
  } catch (error) {
    return internalError();
  }
});
