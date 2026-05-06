import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the retentionService module
vi.mock('@/lib/services', () => ({
  retentionService: {
    purge: vi.fn(),
  },
}));

import { retentionService } from '@/lib/services';

describe('app/api/system/purge/route.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/system/purge', () => {
    it('returns 200 with PurgeResult on success', async () => {
      const { POST } = await import('@/app/api/system/purge/route');
      const mockResult = {
        responsesDeleted: 5,
        auditLogsDeleted: 10,
        pollsHardDeleted: 2,
      };
      vi.mocked(retentionService.purge).mockResolvedValue(mockResult);

      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(mockResult);
      expect(retentionService.purge).toHaveBeenCalledOnce();
    });

    it('returns 200 with zero counts when nothing to purge', async () => {
      const { POST } = await import('@/app/api/system/purge/route');
      const mockResult = {
        responsesDeleted: 0,
        auditLogsDeleted: 0,
        pollsHardDeleted: 0,
      };
      vi.mocked(retentionService.purge).mockResolvedValue(mockResult);

      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(mockResult);
    });

    it('returns 500 on internal error', async () => {
      const { POST } = await import('@/app/api/system/purge/route');
      vi.mocked(retentionService.purge).mockRejectedValue(new Error('DB connection failed'));

      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
