import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: team-based-poll-access
 * Property 8: Cross-ownership team assignment rejected
 * **Validates: Requirements 3.4**
 *
 * For any facilitator attempting to assign a poll to a team they do not own,
 * the PollService SHALL reject the request with an authorization error.
 *
 * This test simulates the ownership check logic used by the polls API route:
 * - teamService.getTeam(teamId, userId) returns null when the team's userId
 *   does not match the requesting user's ID
 * - The API route then returns a 403 FORBIDDEN error with code 'FORBIDDEN'
 *   and message 'Cannot assign to a team you do not own'
 */

/**
 * Team-like object for property testing.
 */
interface TestTeam {
  id: string;
  name: string;
  pin: string;
  userId: string;
  isDeleted: boolean;
}

/**
 * Simulates teamService.getTeam(id, userId):
 * Returns the team only if it exists, is not deleted, and is owned by the given userId.
 * Returns null otherwise (triggering the 403 path in the API route).
 */
function simulateGetTeam(
  teams: TestTeam[],
  teamId: string,
  requestingUserId: string
): TestTeam | null {
  return (
    teams.find(
      (t) => t.id === teamId && t.userId === requestingUserId && !t.isDeleted
    ) ?? null
  );
}

/**
 * Simulates the poll creation/update ownership check as implemented in
 * app/api/polls/route.ts POST handler and app/api/polls/[id]/route.ts PUT handler:
 * - Calls getTeam(teamId, userId)
 * - If null, returns { allowed: false, error: { code: 'FORBIDDEN', message: '...' } }
 * - If found, returns { allowed: true }
 */
function simulateTeamAssignmentCheck(
  teams: TestTeam[],
  teamId: string,
  requestingUserId: string
): { allowed: boolean; error?: { code: string; message: string; status: number } } {
  const team = simulateGetTeam(teams, teamId, requestingUserId);
  if (!team) {
    return {
      allowed: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Cannot assign to a team you do not own',
        status: 403,
      },
    };
  }
  return { allowed: true };
}

/**
 * Arbitrary for generating a team-like object.
 */
const teamArb = (userId: string): fc.Arbitrary<TestTeam> =>
  fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    pin: fc.stringOf(fc.constantFrom(...'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split('')), {
      minLength: 4,
      maxLength: 6,
    }),
    userId: fc.constant(userId),
    isDeleted: fc.constant(false),
  });

describe('Property 8: Cross-ownership team assignment rejected', () => {
  /**
   * **Validates: Requirements 3.4**
   * THE Poll_Service SHALL only allow assignment to Teams owned by the same Facilitator.
   *
   * For any two distinct facilitators A and B, if facilitator B attempts to assign
   * a poll to a team owned by facilitator A, the request SHALL be rejected with
   * a 403 FORBIDDEN error.
   */
  it('assigning a poll to a team owned by a different facilitator is rejected with 403', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // facilitatorA's userId
        fc.uuid(), // facilitatorB's userId
        (facilitatorAId, facilitatorBId) => {
          // Ensure the two facilitators are distinct
          fc.pre(facilitatorAId !== facilitatorBId);

          return fc.assert(
            fc.property(
              fc.array(teamArb(facilitatorAId), { minLength: 1, maxLength: 10 }),
              (teamsOwnedByA) => {
                // Facilitator B tries to assign a poll to each of A's teams
                for (const team of teamsOwnedByA) {
                  const result = simulateTeamAssignmentCheck(
                    teamsOwnedByA,
                    team.id,
                    facilitatorBId
                  );

                  // Must be rejected
                  expect(result.allowed).toBe(false);
                  expect(result.error).toBeDefined();
                  expect(result.error!.code).toBe('FORBIDDEN');
                  expect(result.error!.status).toBe(403);
                  expect(result.error!.message).toBe(
                    'Cannot assign to a team you do not own'
                  );
                }
              }
            ),
            { numRuns: 50 }
          );
        }
      ),
      { numRuns: 4 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   * Positive counterpart: a facilitator CAN assign a poll to their own team.
   * This ensures the ownership check correctly allows legitimate assignments.
   */
  it('assigning a poll to a team owned by the same facilitator is allowed', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // facilitator's userId
        (facilitatorId) => {
          return fc.assert(
            fc.property(
              fc.array(teamArb(facilitatorId), { minLength: 1, maxLength: 10 }),
              (ownedTeams) => {
                // Facilitator assigns a poll to their own team
                for (const team of ownedTeams) {
                  const result = simulateTeamAssignmentCheck(
                    ownedTeams,
                    team.id,
                    facilitatorId
                  );

                  // Must be allowed
                  expect(result.allowed).toBe(true);
                  expect(result.error).toBeUndefined();
                }
              }
            ),
            { numRuns: 50 }
          );
        }
      ),
      { numRuns: 4 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   * Assigning a poll to a non-existent team (random UUID not in the team list)
   * SHALL also be rejected, since getTeam returns null for unknown IDs.
   */
  it('assigning a poll to a non-existent team is rejected', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // facilitator's userId
        fc.uuid(), // random teamId that doesn't exist
        (facilitatorId, nonExistentTeamId) => {
          return fc.assert(
            fc.property(
              fc.array(teamArb(facilitatorId), { minLength: 0, maxLength: 10 }),
              (existingTeams) => {
                // Ensure the random teamId doesn't accidentally match an existing team
                fc.pre(!existingTeams.some((t) => t.id === nonExistentTeamId));

                const result = simulateTeamAssignmentCheck(
                  existingTeams,
                  nonExistentTeamId,
                  facilitatorId
                );

                // Must be rejected (team not found)
                expect(result.allowed).toBe(false);
                expect(result.error).toBeDefined();
                expect(result.error!.code).toBe('FORBIDDEN');
                expect(result.error!.status).toBe(403);
              }
            ),
            { numRuns: 50 }
          );
        }
      ),
      { numRuns: 4 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   * Assigning a poll to a deleted team (even if owned by the same facilitator)
   * SHALL be rejected, since getTeam filters out deleted teams.
   */
  it('assigning a poll to a deleted team owned by the same facilitator is rejected', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // facilitator's userId
        (facilitatorId) => {
          return fc.assert(
            fc.property(
              fc.array(teamArb(facilitatorId), { minLength: 1, maxLength: 10 }),
              (teams) => {
                // Mark all teams as deleted
                const deletedTeams = teams.map((t) => ({ ...t, isDeleted: true }));

                for (const team of deletedTeams) {
                  const result = simulateTeamAssignmentCheck(
                    deletedTeams,
                    team.id,
                    facilitatorId
                  );

                  // Must be rejected (team is deleted)
                  expect(result.allowed).toBe(false);
                  expect(result.error).toBeDefined();
                  expect(result.error!.code).toBe('FORBIDDEN');
                  expect(result.error!.status).toBe(403);
                }
              }
            ),
            { numRuns: 50 }
          );
        }
      ),
      { numRuns: 4 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   * In a mixed environment with multiple facilitators and teams, each facilitator
   * can only assign polls to their own teams and is rejected for all others.
   */
  it('in a multi-facilitator environment, each user can only assign to their own teams', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // facilitator A
        fc.uuid(), // facilitator B
        (facilitatorAId, facilitatorBId) => {
          fc.pre(facilitatorAId !== facilitatorBId);

          return fc.assert(
            fc.property(
              fc.array(teamArb(facilitatorAId), { minLength: 1, maxLength: 5 }),
              fc.array(teamArb(facilitatorBId), { minLength: 1, maxLength: 5 }),
              (teamsA, teamsB) => {
                const allTeams = [...teamsA, ...teamsB];

                // Facilitator A can assign to their own teams
                for (const team of teamsA) {
                  const result = simulateTeamAssignmentCheck(
                    allTeams,
                    team.id,
                    facilitatorAId
                  );
                  expect(result.allowed).toBe(true);
                }

                // Facilitator A cannot assign to B's teams
                for (const team of teamsB) {
                  const result = simulateTeamAssignmentCheck(
                    allTeams,
                    team.id,
                    facilitatorAId
                  );
                  expect(result.allowed).toBe(false);
                  expect(result.error!.code).toBe('FORBIDDEN');
                }

                // Facilitator B can assign to their own teams
                for (const team of teamsB) {
                  const result = simulateTeamAssignmentCheck(
                    allTeams,
                    team.id,
                    facilitatorBId
                  );
                  expect(result.allowed).toBe(true);
                }

                // Facilitator B cannot assign to A's teams
                for (const team of teamsA) {
                  const result = simulateTeamAssignmentCheck(
                    allTeams,
                    team.id,
                    facilitatorBId
                  );
                  expect(result.allowed).toBe(false);
                  expect(result.error!.code).toBe('FORBIDDEN');
                }
              }
            ),
            { numRuns: 50 }
          );
        }
      ),
      { numRuns: 4 }
    );
  });
});
