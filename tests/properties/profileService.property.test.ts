import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: multi-tenant-facilitator-auth, Property 6: Profile display name round-trip
 *
 * For any valid display name (1–100 characters, non-empty after trimming),
 * calling `updateProfile(userId, displayName)` followed by `getProfile(userId)`
 * SHALL return a profile whose `displayName` field equals the provided display name.
 *
 * Validates: Requirements 7.1
 */

// ─── Mock Store ──────────────────────────────────────────────────────────────

interface MockProfile {
  id: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

let profileStore: Map<string, MockProfile>;

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const query = strings.join('?');

      if (query.includes('UPDATE')) {
        // updateProfile query: values are [trimmedDisplayName, userId]
        const displayName = values[0];
        const userId = values[1];

        const existing = profileStore.get(userId);
        if (!existing) return [];

        const updated: MockProfile = {
          ...existing,
          displayName,
          updatedAt: new Date(),
        };
        profileStore.set(userId, updated);
        return [updated];
      }

      if (query.includes('SELECT')) {
        // getProfile query: values are [userId]
        const userId = values[0];
        const profile = profileStore.get(userId);
        return profile ? [profile] : [];
      }

      if (query.includes('INSERT')) {
        // createProfile query: values are [userId, displayName]
        const userId = values[0];
        const displayName = values[1];
        const profile: MockProfile = {
          id: userId,
          displayName,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        profileStore.set(userId, profile);
        return [profile];
      }

      return [];
    }),
  },
}));

// Import after mocks
import { createProfileService } from '@/lib/services/profileService';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates a valid display name: 1–100 characters, non-empty after trim.
 * Uses printable ASCII characters to avoid edge cases with control characters.
 */
const arbDisplayName = fc
  .string({ minLength: 1, maxLength: 100, unit: 'grapheme-ascii' })
  .filter((s) => s.trim().length >= 1 && s.trim().length <= 100);

/** Generates a valid user ID (UUID) */
const arbUserId = fc.uuid();

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Feature: multi-tenant-facilitator-auth, Property 6: Profile display name round-trip', () => {
  beforeEach(() => {
    profileStore = new Map();
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 7.1**
   *
   * For any valid display name (1–100 characters, non-empty after trim),
   * calling updateProfile(userId, displayName) followed by getProfile(userId)
   * SHALL return a profile whose displayName equals the trimmed display name.
   */
  it('updateProfile then getProfile returns the same display name', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUserId,
        arbDisplayName,
        async (userId, displayName) => {
          // Reset store for each iteration
          profileStore = new Map();

          // Seed the store with an existing profile (updateProfile requires existing record)
          profileStore.set(userId, {
            id: userId,
            displayName: 'Initial Name',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          const service = createProfileService();

          // Update the profile with the generated display name
          await service.updateProfile(userId, displayName);

          // Read it back
          const profile = await service.getProfile(userId);

          // The display name should be the trimmed version of what was provided
          expect(profile).not.toBeNull();
          expect(profile!.displayName).toBe(displayName.trim());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.1**
   *
   * For any valid display name, the round-trip preserves the exact trimmed value
   * regardless of leading/trailing whitespace in the input.
   */
  it('display name is trimmed consistently on round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbUserId,
        arbDisplayName,
        fc.constantFrom('', ' ', '  ', '\t', '\n'),
        fc.constantFrom('', ' ', '  ', '\t', '\n'),
        async (userId, coreName, leadingWhitespace, trailingWhitespace) => {
          const displayName = leadingWhitespace + coreName + trailingWhitespace;
          const trimmed = displayName.trim();

          // Skip if trimmed result is invalid (empty or > 100 chars)
          fc.pre(trimmed.length >= 1 && trimmed.length <= 100);

          profileStore = new Map();

          // Seed with existing profile
          profileStore.set(userId, {
            id: userId,
            displayName: 'Old Name',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          const service = createProfileService();

          await service.updateProfile(userId, displayName);
          const profile = await service.getProfile(userId);

          expect(profile).not.toBeNull();
          expect(profile!.displayName).toBe(trimmed);
        }
      ),
      { numRuns: 100 }
    );
  });
});
