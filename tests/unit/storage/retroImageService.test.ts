import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the @supabase/supabase-js module
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockRemove = vi.fn();
const mockFrom = vi.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
  remove: mockRemove,
}));
const mockCreateClient = vi.fn((..._args: unknown[]) => ({
  storage: { from: mockFrom },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

// Mock sharp
const mockToBuffer = vi.fn();
const mockResize = vi.fn();
const mockJpeg = vi.fn();
const mockPng = vi.fn();
const mockWebp = vi.fn();
const mockMetadata = vi.fn();

const mockSharpInstance = {
  metadata: mockMetadata,
  resize: mockResize,
  jpeg: mockJpeg,
  png: mockPng,
  webp: mockWebp,
  toBuffer: mockToBuffer,
};

// Chain all methods back to the instance
mockResize.mockReturnValue(mockSharpInstance);
mockJpeg.mockReturnValue(mockSharpInstance);
mockPng.mockReturnValue(mockSharpInstance);
mockWebp.mockReturnValue(mockSharpInstance);

vi.mock('sharp', () => ({
  default: vi.fn(() => mockSharpInstance),
}));

// Mock Prisma
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    retroBoard: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

describe('imageService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'https://test-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    };
    mockUpload.mockReset();
    mockGetPublicUrl.mockReset();
    mockRemove.mockReset();
    mockFrom.mockReset().mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
      remove: mockRemove,
    });
    mockCreateClient.mockReset().mockReturnValue({
      storage: { from: mockFrom },
    });
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockMetadata.mockReset();
    mockToBuffer.mockReset();
    mockResize.mockReset().mockReturnValue(mockSharpInstance);
    mockJpeg.mockReset().mockReturnValue(mockSharpInstance);
    mockPng.mockReset().mockReturnValue(mockSharpInstance);
    mockWebp.mockReset().mockReturnValue(mockSharpInstance);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function getImageService() {
    return await import('@/lib/retro/imageService');
  }

  describe('uploadBackgroundImage', () => {
    it('rejects invalid MIME type with INVALID_FILE_TYPE code', async () => {
      const { uploadBackgroundImage } = await getImageService();
      const file = Buffer.from('fake-gif-data');

      try {
        await uploadBackgroundImage('board-1', file, 'image/gif');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('Invalid file type');
        expect(err.code).toBe('INVALID_FILE_TYPE');
      }
    });

    it('rejects empty file', async () => {
      const { uploadBackgroundImage } = await getImageService();
      const file = Buffer.alloc(0);

      try {
        await uploadBackgroundImage('board-1', file, 'image/jpeg');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('empty');
        expect(err.code).toBe('INVALID_FILE_TYPE');
      }
    });

    it('rejects file exceeding 10MB upload limit with FILE_TOO_LARGE code', async () => {
      const { uploadBackgroundImage } = await getImageService();
      const file = Buffer.alloc(10 * 1024 * 1024 + 1);

      try {
        await uploadBackgroundImage('board-1', file, 'image/jpeg');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('exceeds');
        expect(err.code).toBe('FILE_TOO_LARGE');
      }
    });

    it('processes and uploads a valid JPEG, returning URL and storagePath', async () => {
      const { uploadBackgroundImage } = await getImageService();
      const file = Buffer.from('fake-jpeg-data');

      // Mock sharp pipeline
      mockMetadata.mockResolvedValue({ width: 800, height: 600 });
      const processedBuffer = Buffer.from('processed-jpeg');
      mockToBuffer.mockResolvedValue(processedBuffer);

      // Mock Supabase upload
      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/retro-backgrounds/board-1/12345.jpg' },
      });

      const result = await uploadBackgroundImage('board-1', file, 'image/jpeg');

      expect(mockFrom).toHaveBeenCalledWith('retro-backgrounds');
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringMatching(/^board-1\/\d+\.jpg$/),
        processedBuffer,
        {
          contentType: 'image/jpeg',
          cacheControl: 'public, max-age=3600',
          upsert: false,
        }
      );
      expect(result.url).toContain('retro-backgrounds/board-1/');
      expect(result.storagePath).toMatch(/^board-1\/\d+\.jpg$/);
    });

    it('resizes images with longest edge > 1920px', async () => {
      const { uploadBackgroundImage } = await getImageService();
      const file = Buffer.from('large-image-data');

      mockMetadata.mockResolvedValue({ width: 4000, height: 2000 });
      mockToBuffer.mockResolvedValue(Buffer.from('resized'));
      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/retro-backgrounds/board-1/12345.jpg' },
      });

      await uploadBackgroundImage('board-1', file, 'image/jpeg');

      expect(mockResize).toHaveBeenCalledWith({
        width: 1920,
        height: undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    });

    it('does not resize images within 1920px', async () => {
      const { uploadBackgroundImage } = await getImageService();
      const file = Buffer.from('small-image-data');

      mockMetadata.mockResolvedValue({ width: 1000, height: 800 });
      mockToBuffer.mockResolvedValue(Buffer.from('same'));
      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/retro-backgrounds/board-1/12345.jpg' },
      });

      await uploadBackgroundImage('board-1', file, 'image/jpeg');

      expect(mockResize).not.toHaveBeenCalled();
    });

    it('throws UPLOAD_FAILED when Supabase upload fails', async () => {
      const { uploadBackgroundImage } = await getImageService();
      const file = Buffer.from('fake-jpeg-data');

      mockMetadata.mockResolvedValue({ width: 800, height: 600 });
      mockToBuffer.mockResolvedValue(Buffer.from('processed'));
      mockUpload.mockResolvedValue({ error: { message: 'Bucket not found' } });

      try {
        await uploadBackgroundImage('board-1', file, 'image/jpeg');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('Failed to upload image');
        expect(err.code).toBe('UPLOAD_FAILED');
      }
    });

    it('sets correct cache-control header on upload', async () => {
      const { uploadBackgroundImage } = await getImageService();
      const file = Buffer.from('fake-png-data');

      mockMetadata.mockResolvedValue({ width: 800, height: 600 });
      mockToBuffer.mockResolvedValue(Buffer.from('processed'));
      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/retro-backgrounds/board-1/12345.png' },
      });

      await uploadBackgroundImage('board-1', file, 'image/png');

      const uploadOptions = mockUpload.mock.calls[0][2];
      expect(uploadOptions.cacheControl).toBe('public, max-age=3600');
    });
  });

  describe('deleteBackgroundImage', () => {
    it('does nothing if board has no background image', async () => {
      const { deleteBackgroundImage } = await getImageService();

      mockFindUnique.mockResolvedValue({ backgroundImage: null });

      await deleteBackgroundImage('board-1');

      expect(mockRemove).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('does nothing if board does not exist', async () => {
      const { deleteBackgroundImage } = await getImageService();

      mockFindUnique.mockResolvedValue(null);

      await deleteBackgroundImage('non-existent');

      expect(mockRemove).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('removes file from storage and clears DB field', async () => {
      const { deleteBackgroundImage } = await getImageService();

      mockFindUnique.mockResolvedValue({
        backgroundImage: {
          url: 'https://test.supabase.co/storage/v1/object/public/retro-backgrounds/board-1/12345.jpg',
          storagePath: 'board-1/12345.jpg',
          opacity: 80,
          displayMode: 'cover',
        },
      });
      mockRemove.mockResolvedValue({ error: null });
      mockUpdate.mockResolvedValue({});

      await deleteBackgroundImage('board-1');

      expect(mockFrom).toHaveBeenCalledWith('retro-backgrounds');
      expect(mockRemove).toHaveBeenCalledWith(['board-1/12345.jpg']);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'board-1' },
        })
      );
    });

    it('throws when storage deletion fails', async () => {
      const { deleteBackgroundImage } = await getImageService();

      mockFindUnique.mockResolvedValue({
        backgroundImage: {
          storagePath: 'board-1/12345.jpg',
        },
      });
      mockRemove.mockResolvedValue({ error: { message: 'Permission denied' } });

      await expect(
        deleteBackgroundImage('board-1')
      ).rejects.toThrow('Failed to delete image');
    });
  });
});
