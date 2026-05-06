import { describe, it, expect } from 'vitest';
import {
  isAllowedImageType,
  isAllowedImageSize,
  validateImage,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/validators/imageValidator';

describe('isAllowedImageType', () => {
  it('accepts image/jpeg', () => {
    expect(isAllowedImageType('image/jpeg')).toBe(true);
  });

  it('accepts image/png', () => {
    expect(isAllowedImageType('image/png')).toBe(true);
  });

  it('accepts image/webp', () => {
    expect(isAllowedImageType('image/webp')).toBe(true);
  });

  it('rejects image/gif', () => {
    expect(isAllowedImageType('image/gif')).toBe(false);
  });

  it('rejects image/svg+xml', () => {
    expect(isAllowedImageType('image/svg+xml')).toBe(false);
  });

  it('rejects application/pdf', () => {
    expect(isAllowedImageType('application/pdf')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isAllowedImageType('')).toBe(false);
  });

  it('rejects text/plain', () => {
    expect(isAllowedImageType('text/plain')).toBe(false);
  });
});

describe('isAllowedImageSize', () => {
  it('accepts 1 byte (minimum valid)', () => {
    expect(isAllowedImageSize(1)).toBe(true);
  });

  it('accepts exactly 5MB', () => {
    expect(isAllowedImageSize(MAX_FILE_SIZE_BYTES)).toBe(true);
  });

  it('rejects 5MB + 1 byte', () => {
    expect(isAllowedImageSize(MAX_FILE_SIZE_BYTES + 1)).toBe(false);
  });

  it('rejects 0 bytes (empty file)', () => {
    expect(isAllowedImageSize(0)).toBe(false);
  });

  it('rejects negative size', () => {
    expect(isAllowedImageSize(-1)).toBe(false);
  });

  it('accepts a typical image size (2MB)', () => {
    expect(isAllowedImageSize(2 * 1024 * 1024)).toBe(true);
  });
});

describe('validateImage', () => {
  it('returns valid for allowed type and size', () => {
    const result = validateImage('image/jpeg', 1024 * 1024);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns error for disallowed type', () => {
    const result = validateImage('image/gif', 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid file type');
    expect(result.error).toContain('image/gif');
  });

  it('returns error for oversized file', () => {
    const result = validateImage('image/png', MAX_FILE_SIZE_BYTES + 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds the maximum');
  });

  it('returns error for empty file', () => {
    const result = validateImage('image/png', 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('checks type before size (invalid type takes precedence)', () => {
    const result = validateImage('image/gif', MAX_FILE_SIZE_BYTES + 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid file type');
  });
});
