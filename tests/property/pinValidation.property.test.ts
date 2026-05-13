import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ValidatePinSchema } from '../../lib/validators/schemas';

/**
 * Feature: team-based-poll-access
 * Property 10: Valid PIN returns correct team (Validates: Requirements 4.2)
 * Property 11: Invalid PIN returns error (Validates: Requirements 4.4)
 *
 * These tests simulate the PIN validation logic without database dependencies.
 * The validate-pin endpoint validates the PIN format via ValidatePinSchema,
 * then looks up a non-deleted team by PIN (case-insensitive, uppercased).
 */

/**
 * The valid charset for PIN generation.
 * Excludes ambiguous characters: I, O, 0, 1 for readability.
 */
const PIN_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 6;

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
 * Arbitrary for generating a valid PIN from the allowed charset.
 */
const validPinArb = fc.stringOf(
  fc.constantFrom(...PIN_CHARSET.split('')),
  { minLength: PIN_MIN_LENGTH, maxLength: PIN_MAX_LENGTH }
);

/**
 * Arbitrary for generating a non-deleted team with a valid PIN.
 */
const teamArb: fc.Arbitrary<TestTeam> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  pin: validPinArb,
  userId: fc.string({ minLength: 1, maxLength: 50 }),
  isDeleted: fc.constant(false),
});

/**
 * Simulates the validatePin logic from TeamService:
 * Looks up a non-deleted team by PIN (case-insensitive via toUpperCase).
 * Returns { teamId, teamName } or null.
 */
function simulateValidatePin(
  teams: TestTeam[],
  pin: string
): { teamId: string; teamName: string } | null {
  const upperPin = pin.toUpperCase();
  const team = teams.find((t) => t.pin === upperPin && !t.isDeleted);
  if (!team) {
    return null;
  }
  return { teamId: team.id, teamName: team.name };
}

/**
 * Feature: team-based-poll-access, Property 10: Valid PIN returns correct team
 * Validates: Requirements 4.2
 *
 * For any existing non-deleted team, submitting that team's PIN for validation
 * SHALL return the correct team ID and team name.
 */
describe('Property 10: Valid PIN returns correct team', () => {
  /**
   * **Validates: Requirements 4.2**
   * WHEN a Participant submits a valid Team_PIN, THE Team_Service SHALL validate
   * the PIN and return the associated Team identifier.
   */
  it('submitting an existing non-deleted team PIN returns the correct teamId and teamName', () => {
    fc.assert(
      fc.property(
        fc.array(teamArb, { minLength: 1, maxLength: 20 }).chain((teams) => {
          // Ensure unique PINs across teams
          const uniqueTeams = teams.reduce<TestTeam[]>((acc, team) => {
            if (!acc.some((t) => t.pin === team.pin)) {
              acc.push(team);
            }
            return acc;
          }, []);
          // Pick one team to validate against
          return fc.tuple(
            fc.constant(uniqueTeams),
            fc.integer({ min: 0, max: Math.max(0, uniqueTeams.length - 1) })
          );
        }),
        ([teams, targetIndex]) => {
          fc.pre(teams.length > 0);
          const targetTeam = teams[targetIndex];

          const result = simulateValidatePin(teams, targetTeam.pin);

          expect(result).not.toBeNull();
          expect(result!.teamId).toBe(targetTeam.id);
          expect(result!.teamName).toBe(targetTeam.name);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.2**
   * PIN validation is case-insensitive: submitting a lowercase version of
   * an existing PIN SHALL still return the correct team.
   */
  it('PIN validation is case-insensitive (lowercase input matches uppercase stored PIN)', () => {
    fc.assert(
      fc.property(
        teamArb,
        (team) => {
          const teams = [team];
          const lowercasePin = team.pin.toLowerCase();

          const result = simulateValidatePin(teams, lowercasePin);

          expect(result).not.toBeNull();
          expect(result!.teamId).toBe(team.id);
          expect(result!.teamName).toBe(team.name);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.2**
   * A valid PIN that matches a DELETED team SHALL NOT return that team.
   * Only non-deleted teams are returned.
   */
  it('a valid PIN matching a deleted team returns null', () => {
    fc.assert(
      fc.property(
        teamArb,
        (team) => {
          const deletedTeam: TestTeam = { ...team, isDeleted: true };
          const teams = [deletedTeam];

          const result = simulateValidatePin(teams, deletedTeam.pin);

          expect(result).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.2**
   * When multiple teams exist, the correct team is returned for each PIN.
   */
  it('returns the correct team when multiple teams exist', () => {
    fc.assert(
      fc.property(
        fc.array(teamArb, { minLength: 2, maxLength: 10 }).map((teams) => {
          // Ensure unique PINs
          const seen = new Set<string>();
          return teams.filter((t) => {
            if (seen.has(t.pin)) return false;
            seen.add(t.pin);
            return true;
          });
        }),
        (teams) => {
          fc.pre(teams.length >= 2);

          // Validate each team's PIN returns the correct team
          for (const team of teams) {
            const result = simulateValidatePin(teams, team.pin);
            expect(result).not.toBeNull();
            expect(result!.teamId).toBe(team.id);
            expect(result!.teamName).toBe(team.name);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.2**
   * The ValidatePinSchema accepts PINs of valid length (4-6 characters).
   */
  it('ValidatePinSchema accepts PINs of valid length (4-6 chars)', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...PIN_CHARSET.split('')), {
          minLength: PIN_MIN_LENGTH,
          maxLength: PIN_MAX_LENGTH,
        }),
        (pin) => {
          const result = ValidatePinSchema.safeParse({ pin });
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});


/**
 * Feature: team-based-poll-access, Property 11: Invalid PIN returns error
 * Validates: Requirements 4.4
 *
 * For any string that does not match any existing non-deleted team's PIN,
 * validation SHALL return a not-found/error response.
 */
describe('Property 11: Invalid PIN returns error', () => {
  /**
   * **Validates: Requirements 4.4**
   * IF a Participant submits a PIN that does not match any non-deleted team,
   * THEN the validation SHALL return null (triggering a not-found error response).
   */
  it('a PIN not matching any existing team returns null', () => {
    fc.assert(
      fc.property(
        fc.array(teamArb, { minLength: 1, maxLength: 10 }).map((teams) => {
          // Ensure unique PINs
          const seen = new Set<string>();
          return teams.filter((t) => {
            if (seen.has(t.pin)) return false;
            seen.add(t.pin);
            return true;
          });
        }),
        validPinArb,
        (teams, randomPin) => {
          // Ensure the random PIN does not match any existing team's PIN
          fc.pre(!teams.some((t) => t.pin === randomPin));

          const result = simulateValidatePin(teams, randomPin);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.4**
   * When no teams exist at all, any PIN submission SHALL return null.
   */
  it('any PIN returns null when no teams exist', () => {
    fc.assert(
      fc.property(
        validPinArb,
        (pin) => {
          const result = simulateValidatePin([], pin);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.4**
   * When all teams are deleted, any PIN submission SHALL return null.
   */
  it('any PIN returns null when all teams are deleted', () => {
    fc.assert(
      fc.property(
        fc.array(teamArb, { minLength: 1, maxLength: 10 }).map((teams) =>
          teams.map((t) => ({ ...t, isDeleted: true }))
        ),
        validPinArb,
        (deletedTeams, pin) => {
          const result = simulateValidatePin(deletedTeams, pin);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.4**
   * PINs that are too short (< 4 chars) SHALL be rejected by the ValidatePinSchema
   * before reaching the service layer.
   */
  it('PINs shorter than 4 characters are rejected by ValidatePinSchema', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...PIN_CHARSET.split('')), {
          minLength: 1,
          maxLength: 3,
        }),
        (shortPin) => {
          const result = ValidatePinSchema.safeParse({ pin: shortPin });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.4**
   * PINs that are too long (> 6 chars) SHALL be rejected by the ValidatePinSchema
   * before reaching the service layer.
   */
  it('PINs longer than 6 characters are rejected by ValidatePinSchema', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...PIN_CHARSET.split('')), {
          minLength: 7,
          maxLength: 20,
        }),
        (longPin) => {
          const result = ValidatePinSchema.safeParse({ pin: longPin });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 4.4**
   * An empty string PIN SHALL be rejected by the ValidatePinSchema.
   */
  it('empty string PIN is rejected by ValidatePinSchema', () => {
    const result = ValidatePinSchema.safeParse({ pin: '' });
    expect(result.success).toBe(false);
  });

  /**
   * **Validates: Requirements 4.4**
   * A PIN matching a deleted team's PIN but not any active team's PIN
   * SHALL return null (not-found).
   */
  it('a PIN matching only a deleted team returns null', () => {
    fc.assert(
      fc.property(
        teamArb,
        teamArb,
        (activeTeam, deletedTeamBase) => {
          // Ensure different PINs
          fc.pre(activeTeam.pin !== deletedTeamBase.pin);

          const deletedTeam: TestTeam = { ...deletedTeamBase, isDeleted: true };
          const teams = [activeTeam, deletedTeam];

          // Querying the deleted team's PIN should return null
          const result = simulateValidatePin(teams, deletedTeam.pin);
          expect(result).toBeNull();

          // Querying the active team's PIN should still work
          const activeResult = simulateValidatePin(teams, activeTeam.pin);
          expect(activeResult).not.toBeNull();
          expect(activeResult!.teamId).toBe(activeTeam.id);
        }
      ),
      { numRuns: 200 }
    );
  });
});
