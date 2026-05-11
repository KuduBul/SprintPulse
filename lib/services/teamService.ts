import { Team, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';

/**
 * Charset for PIN generation.
 * Excludes ambiguous characters: I, O, 0, 1 for readability during verbal sharing.
 */
const PIN_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 6;
const MAX_PIN_ATTEMPTS = 10;

/**
 * Interface for the Team Service.
 */
export interface TeamService {
  createTeam(name: string, userId: string): Promise<Team>;
  listTeams(userId: string): Promise<Team[]>;
  getTeam(id: string, userId: string): Promise<Team | null>;
  updateTeam(id: string, name: string, userId: string): Promise<Team | null>;
  deleteTeam(id: string, userId: string): Promise<boolean>;
  validatePin(pin: string): Promise<{ teamId: string; teamName: string } | null>;
  generateUniquePin(): Promise<string>;
}

/**
 * Creates a TeamService instance with all team management operations.
 */
export function createTeamService(): TeamService {
  return {
    async createTeam(name: string, userId: string): Promise<Team> {
      const pin = await this.generateUniquePin();

      const team = await prisma.team.create({
        data: {
          name,
          pin,
          userId,
        },
      });

      return team;
    },

    async listTeams(userId: string): Promise<Team[]> {
      return prisma.team.findMany({
        where: { userId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
      });
    },

    async getTeam(id: string, userId: string): Promise<Team | null> {
      return prisma.team.findFirst({
        where: { id, userId, isDeleted: false },
      });
    },

    async updateTeam(id: string, name: string, userId: string): Promise<Team | null> {
      const existing = await prisma.team.findFirst({
        where: { id, userId, isDeleted: false },
      });

      if (!existing) {
        return null;
      }

      return prisma.team.update({
        where: { id },
        data: { name },
      });
    },

    async deleteTeam(id: string, userId: string): Promise<boolean> {
      const existing = await prisma.team.findFirst({
        where: { id, userId, isDeleted: false },
      });

      if (!existing) {
        return false;
      }

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Soft-delete the team
        await tx.team.update({
          where: { id },
          data: { isDeleted: true },
        });

        // Disassociate all polls from this team
        await tx.poll.updateMany({
          where: { teamId: id },
          data: { teamId: null },
        });
      });

      return true;
    },

    async validatePin(pin: string): Promise<{ teamId: string; teamName: string } | null> {
      const team = await prisma.team.findFirst({
        where: { pin: pin.toUpperCase(), isDeleted: false },
      });

      if (!team) {
        return null;
      }

      return { teamId: team.id, teamName: team.name };
    },

    async generateUniquePin(): Promise<string> {
      for (let attempt = 0; attempt < MAX_PIN_ATTEMPTS; attempt++) {
        // Generate a random length between 4 and 6
        const length = PIN_MIN_LENGTH + Math.floor(Math.random() * (PIN_MAX_LENGTH - PIN_MIN_LENGTH + 1));
        let pin = '';
        for (let i = 0; i < length; i++) {
          pin += PIN_CHARSET[Math.floor(Math.random() * PIN_CHARSET.length)];
        }

        // Check if PIN already exists
        const existing = await prisma.team.findFirst({
          where: { pin },
        });

        if (!existing) {
          return pin;
        }
      }

      throw new Error('Unable to generate unique PIN after maximum attempts');
    },
  };
}

/**
 * Singleton team service instance for use across the application.
 */
export const teamService = createTeamService();
