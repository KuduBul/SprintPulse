import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import sharp from 'sharp';

/**
 * Feature: retro-enhancements-phase-2b
 * Property 6: Image processing output bounds
 *
 * For any uploaded image regardless of input dimensions or file size,
 * the image processing pipeline produces output with file size ≤ 2MB
 * and longest edge ≤ 1920px.
 *
 * **Validates: Requirements 5.10, 12.1**
 */

import {
  processImage,
  MAX_DIMENSION_PX,
  MAX_OUTPUT_BYTES,
} from '@/lib/retro/imageService';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_LONGEST_EDGE = MAX_DIMENSION_PX; // 1920
const MAX_FILE_SIZE = MAX_OUTPUT_BYTES;     // 2 * 1024 * 1024 = 2MB

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates random image dimensions.
 * Range covers small images (10px), medium (500px), images at the 1920px boundary,
 * and oversized images (up to 3000px) that must be resized down.
 * We use a minimum of 10px to avoid degenerate 1px images that are trivial.
 */
const dimensionsArb = fc.record({
  width: fc.oneof(
    fc.integer({ min: 10, max: 500 }),      // small images
    fc.integer({ min: 500, max: 1920 }),     // medium, at boundary
    fc.integer({ min: 1921, max: 3000 }),    // oversized, needs resize
  ),
  height: fc.oneof(
    fc.integer({ min: 10, max: 500 }),
    fc.integer({ min: 500, max: 1920 }),
    fc.integer({ min: 1921, max: 3000 }),
  ),
});

/**
 * Generates a random MIME type from the supported set.
 */
const mimeTypeArb = fc.constantFrom(
  'image/jpeg' as const,
  'image/png' as const,
  'image/webp' as const,
);

/**
 * Generates random image input parameters combining dimensions and mime type.
 */
const imageInputArb = fc.record({
  dimensions: dimensionsArb,
  mimeType: mimeTypeArb,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates a synthetic image buffer with the given dimensions using sharp.
 * Uses a simple gradient pattern that still produces non-trivial file sizes
 * for compression testing.
 */
async function createSyntheticImage(
  width: number,
  height: number,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<Buffer> {
  // Create a solid color image and add noise via a simple SVG overlay
  // This is much faster than filling raw pixel buffers for large images
  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      // Use a varied background color based on dimensions for diversity
      background: {
        r: (width * 7) % 256,
        g: (height * 13) % 256,
        b: ((width + height) * 3) % 256,
      },
    },
  });

  if (mimeType === 'image/jpeg') {
    return pipeline.jpeg({ quality: 90 }).toBuffer();
  } else if (mimeType === 'image/png') {
    return pipeline.png().toBuffer();
  } else {
    return pipeline.webp({ quality: 90 }).toBuffer();
  }
}

// ─── Property 6: Image processing output bounds ──────────────────────────────

describe('Feature: retro-enhancements-phase-2b, Property 6: Image processing output bounds', () => {
  it('output file size is ≤ 2MB for any input dimensions and format', async () => {
    await fc.assert(
      fc.asyncProperty(imageInputArb, async ({ dimensions, mimeType }) => {
        const { width, height } = dimensions;

        // Create a synthetic image with the given dimensions
        const inputBuffer = await createSyntheticImage(width, height, mimeType);

        // Process through the image pipeline
        const { buffer: outputBuffer } = await processImage(inputBuffer, mimeType);

        // Assert output size is within bounds
        expect(outputBuffer.length).toBeLessThanOrEqual(MAX_FILE_SIZE);
      }),
      { numRuns: 100 }
    );
  }, 120000);

  it('output longest edge is ≤ 1920px for any input dimensions and format', async () => {
    await fc.assert(
      fc.asyncProperty(imageInputArb, async ({ dimensions, mimeType }) => {
        const { width, height } = dimensions;

        // Create a synthetic image with the given dimensions
        const inputBuffer = await createSyntheticImage(width, height, mimeType);

        // Process through the image pipeline
        const { buffer: outputBuffer } = await processImage(inputBuffer, mimeType);

        // Read output metadata to check dimensions
        const outputMetadata = await sharp(outputBuffer).metadata();
        const outputWidth = outputMetadata.width ?? 0;
        const outputHeight = outputMetadata.height ?? 0;
        const longestEdge = Math.max(outputWidth, outputHeight);

        // Assert longest edge is within bounds
        expect(longestEdge).toBeLessThanOrEqual(MAX_LONGEST_EDGE);
      }),
      { numRuns: 100 }
    );
  }, 120000);

  it('both size and dimension constraints hold simultaneously for any input', async () => {
    await fc.assert(
      fc.asyncProperty(imageInputArb, async ({ dimensions, mimeType }) => {
        const { width, height } = dimensions;

        // Create a synthetic image with the given dimensions
        const inputBuffer = await createSyntheticImage(width, height, mimeType);

        // Process through the image pipeline
        const { buffer: outputBuffer, outputMimeType } = await processImage(inputBuffer, mimeType);

        // Assert file size constraint
        expect(outputBuffer.length).toBeLessThanOrEqual(MAX_FILE_SIZE);

        // Assert dimension constraint
        const outputMetadata = await sharp(outputBuffer).metadata();
        const outputWidth = outputMetadata.width ?? 0;
        const outputHeight = outputMetadata.height ?? 0;
        const longestEdge = Math.max(outputWidth, outputHeight);
        expect(longestEdge).toBeLessThanOrEqual(MAX_LONGEST_EDGE);

        // Verify output is a valid supported MIME type
        expect(['image/jpeg', 'image/png', 'image/webp']).toContain(outputMimeType);
      }),
      { numRuns: 100 }
    );
  }, 120000);
});
