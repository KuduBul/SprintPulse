/**
 * Background image service for retro boards.
 *
 * Handles upload (with validation, resize, and compression via sharp)
 * and deletion of background images stored in Supabase Storage.
 *
 * Bucket: `retro-backgrounds`
 * Path format: `{boardId}/{timestamp}.{ext}`
 */

import sharp from 'sharp';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUCKET_NAME = 'retro-backgrounds';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const MIME_TO_EXT: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Maximum dimension (longest edge) after resize. */
const MAX_DIMENSION_PX = 1920;

/** Maximum output file size in bytes (2 MB). */
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

/** Maximum upload file size before processing (10 MB — rejected early). */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Supabase client (lazy singleton, service role)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface BackgroundUploadResult {
  url: string;           // Public URL from Supabase Storage
  storagePath: string;   // Path within the bucket for deletion
}

// ---------------------------------------------------------------------------
// Image processing
// ---------------------------------------------------------------------------

/**
 * Validates the MIME type of the input file.
 * @throws Error with code INVALID_FILE_TYPE if not JPEG, PNG, or WebP.
 */
function validateMimeType(mimeType: string): asserts mimeType is AllowedMimeType {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    const err = new Error(
      `Invalid file type "${mimeType}". Allowed types: JPEG, PNG, WebP.`
    );
    (err as any).code = 'INVALID_FILE_TYPE';
    throw err;
  }
}

/**
 * Validates the raw upload size (before processing).
 * @throws Error with code FILE_TOO_LARGE if > 10 MB.
 */
function validateUploadSize(sizeBytes: number): void {
  if (sizeBytes <= 0) {
    const err = new Error('File is empty.');
    (err as any).code = 'INVALID_FILE_TYPE';
    throw err;
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    const err = new Error(
      `File size (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum upload size of 10 MB.`
    );
    (err as any).code = 'FILE_TOO_LARGE';
    throw err;
  }
}

/**
 * Processes an image buffer through the sharp pipeline:
 * 1. Resize so the longest edge is at most MAX_DIMENSION_PX (1920px).
 * 2. Compress to WebP (or original format) targeting ≤ MAX_OUTPUT_BYTES (2 MB).
 *
 * Returns the processed buffer and the output MIME type.
 */
export async function processImage(
  input: Buffer,
  mimeType: AllowedMimeType
): Promise<{ buffer: Buffer; outputMimeType: AllowedMimeType }> {
  const metadata = await sharp(input).metadata();
  const { width = 0, height = 0 } = metadata;

  // Determine if resize is needed
  const longestEdge = Math.max(width, height);
  const needsResize = longestEdge > MAX_DIMENSION_PX;

  // Build pipeline: resize (if needed) then compress
  let pipeline = sharp(input);

  if (needsResize) {
    pipeline = pipeline.resize({
      width: width >= height ? MAX_DIMENSION_PX : undefined,
      height: height > width ? MAX_DIMENSION_PX : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // First pass: compress with quality 80 in original format
  let quality = 80;
  let outputBuffer: Buffer;
  let outputMimeType = mimeType;

  if (mimeType === 'image/jpeg') {
    outputBuffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
  } else if (mimeType === 'image/png') {
    outputBuffer = await pipeline.png({ quality, effort: 8 }).toBuffer();
  } else {
    // WebP
    outputBuffer = await pipeline.webp({ quality }).toBuffer();
  }

  // If still over 2MB, progressively reduce quality
  while (outputBuffer.length > MAX_OUTPUT_BYTES && quality > 20) {
    quality -= 10;
    pipeline = sharp(input);

    if (needsResize) {
      pipeline = pipeline.resize({
        width: width >= height ? MAX_DIMENSION_PX : undefined,
        height: height > width ? MAX_DIMENSION_PX : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    if (mimeType === 'image/jpeg') {
      outputBuffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    } else if (mimeType === 'image/png') {
      // PNG doesn't support quality-based compression well; switch to WebP
      outputBuffer = await pipeline.webp({ quality }).toBuffer();
      outputMimeType = 'image/webp';
    } else {
      outputBuffer = await pipeline.webp({ quality }).toBuffer();
    }
  }

  // Final fallback: if still over 2MB, convert to WebP with aggressive compression
  if (outputBuffer.length > MAX_OUTPUT_BYTES && outputMimeType !== 'image/webp') {
    pipeline = sharp(input);
    if (needsResize) {
      pipeline = pipeline.resize({
        width: width >= height ? MAX_DIMENSION_PX : undefined,
        height: height > width ? MAX_DIMENSION_PX : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    outputBuffer = await pipeline.webp({ quality: 20 }).toBuffer();
    outputMimeType = 'image/webp';
  }

  return { buffer: outputBuffer, outputMimeType };
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Uploads a background image for a retro board.
 *
 * Pipeline:
 * 1. Validate file type (JPEG, PNG, WebP only)
 * 2. Validate upload size (≤ 10 MB)
 * 3. Resize to max 1920px longest edge
 * 4. Compress to max 2 MB output
 * 5. Upload to Supabase Storage `retro-backgrounds/{boardId}/{timestamp}.{ext}`
 * 6. Set cache headers: Cache-Control: public, max-age=3600
 * 7. Return public URL and storage path
 *
 * @param boardId - The retro board ID
 * @param file - The raw image file as a Buffer
 * @param mimeType - The MIME type of the uploaded file
 * @returns Public URL and storage path for later deletion
 * @throws Error with code INVALID_FILE_TYPE, FILE_TOO_LARGE, or UPLOAD_FAILED
 */
export async function uploadBackgroundImage(
  boardId: string,
  file: Buffer,
  mimeType: string,
): Promise<BackgroundUploadResult> {
  // Step 1: Validate MIME type
  validateMimeType(mimeType);

  // Step 2: Validate upload size
  validateUploadSize(file.length);

  // Steps 3–4: Process image (resize + compress)
  const { buffer: processedBuffer, outputMimeType } = await processImage(file, mimeType);

  // Step 5: Determine storage path
  const ext = MIME_TO_EXT[outputMimeType];
  const timestamp = Date.now();
  const storagePath = `${boardId}/${timestamp}.${ext}`;

  // Step 6: Upload to Supabase Storage with cache headers
  const client = getSupabaseClient();

  const { error } = await client.storage
    .from(BUCKET_NAME)
    .upload(storagePath, processedBuffer, {
      contentType: outputMimeType,
      cacheControl: 'public, max-age=3600',
      upsert: false,
    });

  if (error) {
    const uploadErr = new Error(`Failed to upload image: ${error.message}`);
    (uploadErr as any).code = 'UPLOAD_FAILED';
    throw uploadErr;
  }

  // Step 7: Get public URL
  const { data: urlData } = client.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);

  return {
    url: urlData.publicUrl,
    storagePath,
  };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Deletes the background image for a retro board.
 *
 * 1. Reads the board's `backgroundImage` JSON field to get the storage path.
 * 2. Removes the file from Supabase Storage.
 * 3. Clears the `backgroundImage` field on the RetroBoard record.
 *
 * If the board has no background image, this is a no-op.
 *
 * @param boardId - The retro board ID
 * @throws Error if the storage deletion fails
 */
export async function deleteBackgroundImage(boardId: string): Promise<void> {
  // Read current background metadata from the DB
  const board = await prisma.retroBoard.findUnique({
    where: { id: boardId },
    select: { backgroundImage: true },
  });

  if (!board || !board.backgroundImage) {
    // No background image set — nothing to delete
    return;
  }

  const bgMeta = board.backgroundImage as { storagePath?: string };

  if (bgMeta.storagePath) {
    // Remove file from Supabase Storage
    const client = getSupabaseClient();
    const { error } = await client.storage
      .from(BUCKET_NAME)
      .remove([bgMeta.storagePath]);

    if (error) {
      const deleteErr = new Error(`Failed to delete image: ${error.message}`);
      (deleteErr as any).code = 'UPLOAD_FAILED';
      throw deleteErr;
    }
  }

  // Clear the backgroundImage field on the board
  await prisma.retroBoard.update({
    where: { id: boardId },
    data: { backgroundImage: Prisma.DbNull },
  });
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

export {
  BUCKET_NAME,
  ALLOWED_MIME_TYPES,
  MIME_TO_EXT,
  MAX_DIMENSION_PX,
  MAX_OUTPUT_BYTES,
  MAX_UPLOAD_BYTES,
};
