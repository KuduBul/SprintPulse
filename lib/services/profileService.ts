import { prisma } from '@/lib/db/client';

/**
 * Represents a facilitator profile.
 */
export interface FacilitatorProfile {
  id: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for the Profile Service.
 */
export interface ProfileService {
  getProfile(userId: string): Promise<FacilitatorProfile | null>;
  createProfile(userId: string, displayName: string): Promise<FacilitatorProfile>;
  updateProfile(userId: string, displayName: string): Promise<FacilitatorProfile | null>;
}

/**
 * Creates a ProfileService instance for managing facilitator profiles.
 * Uses raw SQL queries since facilitator_profiles is not in the Prisma schema
 * (it references auth.users which is managed by Supabase).
 */
export function createProfileService(): ProfileService {
  return {
    async getProfile(userId: string): Promise<FacilitatorProfile | null> {
      const results = await prisma.$queryRaw<FacilitatorProfile[]>`
        SELECT "id", "displayName", "createdAt", "updatedAt"
        FROM "facilitator_profiles"
        WHERE "id" = ${userId}::uuid
        LIMIT 1
      `;

      return results.length > 0 ? results[0] : null;
    },

    async createProfile(userId: string, displayName: string): Promise<FacilitatorProfile> {
      const results = await prisma.$queryRaw<FacilitatorProfile[]>`
        INSERT INTO "facilitator_profiles" ("id", "displayName", "createdAt", "updatedAt")
        VALUES (${userId}::uuid, ${displayName}, NOW(), NOW())
        RETURNING "id", "displayName", "createdAt", "updatedAt"
      `;

      return results[0];
    },

    async updateProfile(userId: string, displayName: string): Promise<FacilitatorProfile | null> {
      const trimmed = displayName.trim();

      if (trimmed.length < 1 || trimmed.length > 100) {
        throw new Error('Display name must be between 1 and 100 characters');
      }

      const results = await prisma.$queryRaw<FacilitatorProfile[]>`
        UPDATE "facilitator_profiles"
        SET "displayName" = ${trimmed}, "updatedAt" = NOW()
        WHERE "id" = ${userId}::uuid
        RETURNING "id", "displayName", "createdAt", "updatedAt"
      `;

      return results.length > 0 ? results[0] : null;
    },
  };
}

/**
 * Singleton profile service instance for use across the application.
 */
export const profileService = createProfileService();
