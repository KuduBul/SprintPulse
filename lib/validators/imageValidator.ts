/**
 * Image validation for poll background uploads.
 * Validates file type (JPEG, PNG, WebP) and size (≤5MB).
 */

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a MIME type is one of the allowed image formats.
 */
export function isAllowedImageType(mimeType: string): mimeType is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Validates that a file size does not exceed the maximum allowed size (5MB).
 */
export function isAllowedImageSize(sizeInBytes: number): boolean {
  return sizeInBytes > 0 && sizeInBytes <= MAX_FILE_SIZE_BYTES;
}

/**
 * Validates an image file for both type and size constraints.
 * Returns a result object indicating validity and any error message.
 */
export function validateImage(mimeType: string, sizeInBytes: number): ImageValidationResult {
  if (!isAllowedImageType(mimeType)) {
    return {
      valid: false,
      error: `Invalid file type "${mimeType}". Allowed types: JPEG, PNG, WebP.`,
    };
  }

  if (!isAllowedImageSize(sizeInBytes)) {
    if (sizeInBytes <= 0) {
      return {
        valid: false,
        error: 'File is empty.',
      };
    }
    return {
      valid: false,
      error: `File size (${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed size of 5 MB.`,
    };
  }

  return { valid: true };
}

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES };
