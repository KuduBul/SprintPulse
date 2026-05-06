/**
 * Supabase Storage client for poll background image uploads.
 *
 * Uploads images to the `poll-backgrounds` bucket with path format:
 * {pollId}/{timestamp}.{ext}
 *
 * Validates file size (≤5MB) and MIME type (JPEG, PNG, WebP) before upload.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateImage, AllowedMimeType } from '@/lib/validators/imageValidator';

const BUCKET_NAME = 'poll-backgrounds';

/**
 * Map of allowed MIME types to file extensions.
 */
const MIME_TO_EXT: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Lazily initialised Supabase client singleton.
 * Uses service role key for server-side storage operations.
 */
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  return supabaseClient;
}

/**
 * Uploads a poll background image to Supabase Storage.
 *
 * @param pollId - The ID of the poll this image belongs to
 * @param file - The image file as a Buffer
 * @param mimeType - The MIME type of the file (must be image/jpeg, image/png, or image/webp)
 * @returns The public URL of the uploaded file
 * @throws Error if validation fails or upload fails
 */
export async function uploadPollBackground(
  pollId: string,
  file: Buffer,
  mimeType: string
): Promise<string> {
  // Validate file before upload
  const validation = validateImage(mimeType, file.length);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const ext = MIME_TO_EXT[mimeType as AllowedMimeType];
  const timestamp = Date.now();
  const filePath = `${pollId}/${timestamp}.${ext}`;

  const client = getSupabaseClient();

  const { error } = await client.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const { data: urlData } = client.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

export { BUCKET_NAME, MIME_TO_EXT };
