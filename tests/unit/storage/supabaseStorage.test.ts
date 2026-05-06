import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the @supabase/supabase-js module
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockFrom = vi.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));
const mockCreateClient = vi.fn(() => ({
  storage: { from: mockFrom },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

describe('uploadPollBackground', () => {
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
    mockFrom.mockReset().mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    });
    mockCreateClient.mockReset().mockReturnValue({
      storage: { from: mockFrom },
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function getUploadFn() {
    const mod = await import('@/lib/storage/supabaseStorage');
    return mod.uploadPollBackground;
  }

  it('uploads a valid JPEG file and returns the public URL', async () => {
    const uploadPollBackground = await getUploadFn();
    const file = Buffer.from('fake-jpeg-data');
    const pollId = 'poll-123';
    const mimeType = 'image/jpeg';

    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://test-project.supabase.co/storage/v1/object/public/poll-backgrounds/poll-123/12345.jpg' },
    });

    const result = await uploadPollBackground(pollId, file, mimeType);

    expect(mockFrom).toHaveBeenCalledWith('poll-backgrounds');
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^poll-123\/\d+\.jpg$/),
      file,
      { contentType: 'image/jpeg', upsert: false }
    );
    expect(result).toContain('poll-backgrounds/poll-123/');
    expect(result).toContain('.jpg');
  });

  it('uploads a valid PNG file with correct extension', async () => {
    const uploadPollBackground = await getUploadFn();
    const file = Buffer.from('fake-png-data');

    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/poll-backgrounds/poll-456/99999.png' },
    });

    const result = await uploadPollBackground('poll-456', file, 'image/png');

    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^poll-456\/\d+\.png$/),
      file,
      { contentType: 'image/png', upsert: false }
    );
    expect(result).toContain('.png');
  });

  it('uploads a valid WebP file with correct extension', async () => {
    const uploadPollBackground = await getUploadFn();
    const file = Buffer.from('fake-webp-data');

    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/poll-backgrounds/poll-789/11111.webp' },
    });

    const result = await uploadPollBackground('poll-789', file, 'image/webp');

    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^poll-789\/\d+\.webp$/),
      file,
      { contentType: 'image/webp', upsert: false }
    );
    expect(result).toContain('.webp');
  });

  it('throws an error for invalid MIME type', async () => {
    const uploadPollBackground = await getUploadFn();
    const file = Buffer.from('fake-gif-data');

    await expect(
      uploadPollBackground('poll-123', file, 'image/gif')
    ).rejects.toThrow('Invalid file type');
  });

  it('throws an error for file exceeding 5MB', async () => {
    const uploadPollBackground = await getUploadFn();
    const file = Buffer.alloc(5 * 1024 * 1024 + 1); // 5MB + 1 byte

    await expect(
      uploadPollBackground('poll-123', file, 'image/jpeg')
    ).rejects.toThrow('exceeds the maximum');
  });

  it('throws an error for empty file', async () => {
    const uploadPollBackground = await getUploadFn();
    const file = Buffer.alloc(0);

    await expect(
      uploadPollBackground('poll-123', file, 'image/jpeg')
    ).rejects.toThrow('empty');
  });

  it('throws an error when Supabase upload fails', async () => {
    const uploadPollBackground = await getUploadFn();
    const file = Buffer.from('fake-jpeg-data');

    mockUpload.mockResolvedValue({
      error: { message: 'Storage quota exceeded' },
    });

    await expect(
      uploadPollBackground('poll-123', file, 'image/jpeg')
    ).rejects.toThrow('Failed to upload image: Storage quota exceeded');
  });

  it('throws when SUPABASE_URL is not set', async () => {
    delete process.env.SUPABASE_URL;

    const uploadPollBackground = await getUploadFn();
    const file = Buffer.from('fake-jpeg-data');

    await expect(
      uploadPollBackground('poll-123', file, 'image/jpeg')
    ).rejects.toThrow('Missing required environment variables');
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is not set', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const uploadPollBackground = await getUploadFn();
    const file = Buffer.from('fake-jpeg-data');

    await expect(
      uploadPollBackground('poll-123', file, 'image/jpeg')
    ).rejects.toThrow('Missing required environment variables');
  });

  it('uses correct file path format: {pollId}/{timestamp}.{ext}', async () => {
    const uploadPollBackground = await getUploadFn();
    const file = Buffer.from('fake-jpeg-data');
    const beforeTimestamp = Date.now();

    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/poll-backgrounds/my-poll/12345.jpg' },
    });

    await uploadPollBackground('my-poll', file, 'image/jpeg');

    const afterTimestamp = Date.now();
    const uploadCall = mockUpload.mock.calls[0];
    const filePath = uploadCall[0] as string;

    // Verify path format
    expect(filePath).toMatch(/^my-poll\/\d+\.jpg$/);

    // Verify timestamp is reasonable
    const parts = filePath.split('/');
    const filename = parts[1];
    const timestamp = parseInt(filename.split('.')[0], 10);
    expect(timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
    expect(timestamp).toBeLessThanOrEqual(afterTimestamp);
  });
});
