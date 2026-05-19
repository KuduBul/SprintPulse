import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProfileService } from '@/lib/services/profileService';

// Use vi.hoisted to define mocks before vi.mock hoisting
const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: mockPrisma,
}));

describe('ProfileService', () => {
  let profileService: ReturnType<typeof createProfileService>;

  beforeEach(() => {
    vi.clearAllMocks();
    profileService = createProfileService();
  });

  describe('updateProfile', () => {
    it('rejects names longer than 100 characters', async () => {
      const longName = 'a'.repeat(101);

      await expect(
        profileService.updateProfile('user-123', longName)
      ).rejects.toThrow('Display name must be between 1 and 100 characters');

      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('rejects empty string names', async () => {
      await expect(
        profileService.updateProfile('user-123', '')
      ).rejects.toThrow('Display name must be between 1 and 100 characters');

      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only names', async () => {
      await expect(
        profileService.updateProfile('user-123', '   ')
      ).rejects.toThrow('Display name must be between 1 and 100 characters');

      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('rejects names that are only tabs and newlines', async () => {
      await expect(
        profileService.updateProfile('user-123', '\t\n\r')
      ).rejects.toThrow('Display name must be between 1 and 100 characters');

      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('accepts a valid name within 100 characters', async () => {
      const validName = 'John Doe';
      const mockProfile = {
        id: 'user-123',
        displayName: validName,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$queryRaw.mockResolvedValue([mockProfile]);

      const result = await profileService.updateProfile('user-123', validName);

      expect(result).toEqual(mockProfile);
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('accepts a name that is exactly 100 characters', async () => {
      const exactName = 'a'.repeat(100);
      const mockProfile = {
        id: 'user-123',
        displayName: exactName,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$queryRaw.mockResolvedValue([mockProfile]);

      const result = await profileService.updateProfile('user-123', exactName);

      expect(result).toEqual(mockProfile);
    });
  });

  describe('getProfile', () => {
    it('returns null for a non-existent user', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await profileService.getProfile('non-existent-user-id');

      expect(result).toBeNull();
    });

    it('returns the profile when user exists', async () => {
      const mockProfile = {
        id: 'user-123',
        displayName: 'Jane Doe',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.$queryRaw.mockResolvedValue([mockProfile]);

      const result = await profileService.getProfile('user-123');

      expect(result).toEqual(mockProfile);
    });
  });
});
