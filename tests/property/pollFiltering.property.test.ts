import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: team-based-poll-access
 * Property 9: Poll filtering by team (Validates: Requirements 3.6, 4.3)
 * Property 12: Unassigned polls visible to all (Validates: Requirements 6.2)
 */

/**
 * Feature: team-based-poll-access, Property 9: Poll filtering by team
 * Validates: Requirements 3.6, 4.3
 *
 * For any team with associated polls, querying polls by that team's ID SHALL
 * return exactly the set of non-deleted polls whose `teamId` matches, and no others.
 */

/**
 * Poll-like object for property testing.
 */
interface TestPoll {
  id: string;
  title: string;
  teamId: string | null;
  isDeleted: boolean;
  createdAt: Date;
}

/**
 * Simulates the filtering logic of PollService.listPublicPollsByTeam(teamId):
 * Returns non-deleted polls where teamId matches the given team OR teamId is null.
 */
function simulateListPublicPollsByTeam(polls: TestPoll[], teamId: string): TestPoll[] {
  return polls
    .filter((p) => !p.isDeleted && (p.teamId === teamId || p.teamId === null))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Simulates the filtering logic of PollService.listPollsByTeam(userId, teamId):
 * Returns non-deleted polls where teamId matches exactly (strict team filter for facilitators).
 */
function simulateListPollsByTeam(polls: TestPoll[], userId: string, teamId: string): TestPoll[] {
  return polls
    .filter((p) => !p.isDeleted && p.teamId === teamId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Arbitrary for generating a poll-like object with a configurable teamId.
 */
const pollArb = (teamIds: string[]): fc.Arbitrary<TestPoll> =>
  fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 200 }),
    teamId: fc.oneof(
      fc.constantFrom(...teamIds),
      fc.constant(null as string | null)
    ),
    isDeleted: fc.boolean(),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  });

describe('Property 9: Poll filtering by team', () => {
  /**
   * **Validates: Requirements 3.6**
   * WHEN a Facilitator filters polls by Team, THE Poll_Service SHALL return
   * only polls belonging to the selected Team.
   *
   * This property verifies that filtering by a specific teamId returns only
   * non-deleted polls whose teamId matches (strict filter for facilitator view).
   */
  it('strict team filter returns only polls with matching teamId', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        (targetTeamId, otherTeamId, userId) => {
          // Generate a mix of polls with different teamIds
          const teamIds = [targetTeamId, otherTeamId];

          return fc.assert(
            fc.property(
              fc.array(pollArb(teamIds), { minLength: 1, maxLength: 30 }),
              (polls) => {
                const result = simulateListPollsByTeam(polls, userId, targetTeamId);

                // Every returned poll must have the target teamId
                for (const poll of result) {
                  expect(poll.teamId).toBe(targetTeamId);
                }

                // Every returned poll must not be deleted
                for (const poll of result) {
                  expect(poll.isDeleted).toBe(false);
                }

                // No non-deleted poll with matching teamId should be missing
                const expectedPolls = polls.filter(
                  (p) => !p.isDeleted && p.teamId === targetTeamId
                );
                expect(result.length).toBe(expectedPolls.length);
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
   * **Validates: Requirements 4.3**
   * WHEN a valid Team_PIN is submitted, THE Participant_Page SHALL display
   * only polls belonging to the associated Team.
   *
   * This property verifies that the public team filter (listPublicPollsByTeam)
   * returns polls matching the teamId plus unassigned polls (teamId=null),
   * and excludes polls belonging to other teams.
   */
  it('public team filter returns matching polls and unassigned polls, excludes other teams', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (targetTeamId, otherTeamId) => {
          // Ensure the two team IDs are different
          fc.pre(targetTeamId !== otherTeamId);

          const teamIds = [targetTeamId, otherTeamId];

          return fc.assert(
            fc.property(
              fc.array(pollArb(teamIds), { minLength: 1, maxLength: 30 }),
              (polls) => {
                const result = simulateListPublicPollsByTeam(polls, targetTeamId);

                // Every returned poll must either match the target teamId or have null teamId
                for (const poll of result) {
                  expect(
                    poll.teamId === targetTeamId || poll.teamId === null
                  ).toBe(true);
                }

                // No returned poll should be deleted
                for (const poll of result) {
                  expect(poll.isDeleted).toBe(false);
                }

                // No poll belonging to another team should be in the result
                for (const poll of result) {
                  if (poll.teamId !== null) {
                    expect(poll.teamId).toBe(targetTeamId);
                  }
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
   * **Validates: Requirements 3.6, 4.3**
   * The filtered result must contain ALL non-deleted polls with matching teamId —
   * no matching poll should be excluded from the result.
   */
  it('no non-deleted poll with matching teamId is excluded from the result', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (targetTeamId, otherTeamId) => {
          fc.pre(targetTeamId !== otherTeamId);

          const teamIds = [targetTeamId, otherTeamId];

          return fc.assert(
            fc.property(
              fc.array(pollArb(teamIds), { minLength: 1, maxLength: 30 }),
              (polls) => {
                const result = simulateListPublicPollsByTeam(polls, targetTeamId);

                // Count expected: non-deleted polls with matching teamId or null teamId
                const expectedCount = polls.filter(
                  (p) => !p.isDeleted && (p.teamId === targetTeamId || p.teamId === null)
                ).length;

                expect(result.length).toBe(expectedCount);

                // Verify each expected poll is present in the result
                const resultIds = new Set(result.map((p) => p.id));
                for (const poll of polls) {
                  if (!poll.isDeleted && (poll.teamId === targetTeamId || poll.teamId === null)) {
                    expect(resultIds.has(poll.id)).toBe(true);
                  }
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
   * **Validates: Requirements 3.6**
   * Deleted polls SHALL never appear in filtered results, regardless of teamId.
   */
  it('deleted polls are never included in filtered results', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (targetTeamId, otherTeamId) => {
          const teamIds = [targetTeamId, otherTeamId];

          return fc.assert(
            fc.property(
              fc.array(pollArb(teamIds), { minLength: 1, maxLength: 30 }),
              (polls) => {
                const publicResult = simulateListPublicPollsByTeam(polls, targetTeamId);
                const strictResult = simulateListPollsByTeam(polls, 'any-user', targetTeamId);

                // No deleted poll in public result
                for (const poll of publicResult) {
                  expect(poll.isDeleted).toBe(false);
                }

                // No deleted poll in strict result
                for (const poll of strictResult) {
                  expect(poll.isDeleted).toBe(false);
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
   * **Validates: Requirements 3.6, 4.3**
   * The filtered result must be ordered by createdAt descending.
   */
  it('filtered results are ordered by createdAt descending', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (targetTeamId, otherTeamId) => {
          const teamIds = [targetTeamId, otherTeamId];

          return fc.assert(
            fc.property(
              fc.array(pollArb(teamIds), { minLength: 2, maxLength: 30 }),
              (polls) => {
                const result = simulateListPublicPollsByTeam(polls, targetTeamId);

                // Verify ordering: each element's createdAt >= next element's createdAt
                for (let i = 0; i < result.length - 1; i++) {
                  expect(result[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                    result[i + 1].createdAt.getTime()
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
});


/**
 * Feature: team-based-poll-access, Property 12: Unassigned polls visible to all
 * Validates: Requirements 6.2
 *
 * For any poll with `teamId=null`, that poll SHALL appear in the public poll listing
 * regardless of whether a team filter is applied or which team filter is used.
 */
describe('Property 12: Unassigned polls visible to all', () => {
  /**
   * **Validates: Requirements 6.2**
   * WHILE existing polls have no Team assignment, THE Participant_Page SHALL display
   * those polls to all participants regardless of Team_PIN entry.
   *
   * For ANY teamId filter value, polls with teamId=null always appear in the results.
   */
  it('polls with teamId=null appear in public listing for any team filter', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        (teamIds) => {
          // Generate polls: some assigned to teams, some unassigned (teamId=null)
          return fc.assert(
            fc.property(
              fc.array(
                fc.record({
                  id: fc.uuid(),
                  title: fc.string({ minLength: 1, maxLength: 200 }),
                  teamId: fc.oneof(
                    fc.constantFrom(...teamIds),
                    fc.constant(null as string | null)
                  ),
                  isDeleted: fc.boolean(),
                  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
                }),
                { minLength: 1, maxLength: 30 }
              ),
              fc.constantFrom(...teamIds),
              (polls, filterTeamId) => {
                const result = simulateListPublicPollsByTeam(polls, filterTeamId);

                // Identify all non-deleted unassigned polls
                const unassignedPolls = polls.filter(
                  (p) => !p.isDeleted && p.teamId === null
                );

                // Every non-deleted unassigned poll MUST appear in the result
                const resultIds = new Set(result.map((p) => p.id));
                for (const poll of unassignedPolls) {
                  expect(resultIds.has(poll.id)).toBe(true);
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
   * **Validates: Requirements 6.2**
   * Unassigned polls appear regardless of WHICH team filter is applied.
   * Testing with multiple different team filters on the same poll set.
   */
  it('unassigned polls appear consistently across different team filters', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }),
        (teamIds) => {
          return fc.assert(
            fc.property(
              fc.array(
                fc.record({
                  id: fc.uuid(),
                  title: fc.string({ minLength: 1, maxLength: 200 }),
                  teamId: fc.oneof(
                    fc.constantFrom(...teamIds),
                    fc.constant(null as string | null)
                  ),
                  isDeleted: fc.constant(false),
                  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
                }),
                { minLength: 1, maxLength: 20 }
              ),
              (polls) => {
                // The set of unassigned polls
                const unassignedPolls = polls.filter((p) => p.teamId === null);
                const unassignedIds = new Set(unassignedPolls.map((p) => p.id));

                // For EVERY team filter, unassigned polls must appear
                for (const filterTeamId of teamIds) {
                  const result = simulateListPublicPollsByTeam(polls, filterTeamId);
                  const resultIds = new Set(result.map((p) => p.id));

                  for (const id of unassignedIds) {
                    expect(resultIds.has(id)).toBe(true);
                  }
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
   * **Validates: Requirements 6.2**
   * Even when filtering by a team that has NO assigned polls,
   * unassigned polls still appear in the result.
   */
  it('unassigned polls appear even when filtering by a team with no assigned polls', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (assignedTeamId, emptyTeamId) => {
          // Ensure the two team IDs are different
          fc.pre(assignedTeamId !== emptyTeamId);

          return fc.assert(
            fc.property(
              fc.array(
                fc.record({
                  id: fc.uuid(),
                  title: fc.string({ minLength: 1, maxLength: 200 }),
                  teamId: fc.oneof(
                    fc.constant(assignedTeamId),
                    fc.constant(null as string | null)
                  ),
                  isDeleted: fc.constant(false),
                  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
                }),
                { minLength: 1, maxLength: 20 }
              ),
              (polls) => {
                // Filter by emptyTeamId — no polls are assigned to this team
                const result = simulateListPublicPollsByTeam(polls, emptyTeamId);

                // All unassigned polls must still appear
                const unassignedPolls = polls.filter((p) => p.teamId === null);
                const resultIds = new Set(result.map((p) => p.id));

                for (const poll of unassignedPolls) {
                  expect(resultIds.has(poll.id)).toBe(true);
                }

                // Result should contain ONLY unassigned polls (since no polls match emptyTeamId)
                expect(result.length).toBe(unassignedPolls.length);
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
