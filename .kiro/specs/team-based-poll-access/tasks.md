# Implementation Plan: Team-Based Poll Access

## Overview

This plan implements team-based poll access for SprintPulse. It adds a `Team` entity with PIN-based access, allowing facilitators to organize polls into teams and participants to filter polls by entering a team PIN. The implementation proceeds from database schema through service layer, API routes, and finally UI components, ensuring backward compatibility throughout.

## Tasks

- [x] 1. Database schema: Add Team table and teamId on Poll
  - [x] 1.1 Create database migration for Team table and Poll.teamId column
    - Apply SQL migration via `mcp_supabase_apply_migration` to create the `Team` table with columns: `id` (uuid PK), `name` (varchar 100), `pin` (varchar 6, unique), `userId` (text), `isDeleted` (boolean default false), `createdAt`, `updatedAt`
    - Add nullable `teamId` (uuid) column to `Poll` table with a foreign key to `Team.id`
    - Add indexes on `Team.userId`, `Team.pin`, and `Poll.teamId`
    - _Requirements: 1.1, 1.2, 6.1_

  - [x] 1.2 Update Prisma schema and generate client
    - Add `Team` model to `prisma/schema.prisma` matching the migration
    - Add `teamId String?` and `team Team? @relation(...)` to the `Poll` model
    - Add `polls Poll[]` relation to the `Team` model
    - Run `npx prisma generate` to regenerate the Prisma client
    - _Requirements: 1.1, 3.1_

- [x] 2. Validation schemas for teams
  - [x] 2.1 Add team-related Zod schemas to `lib/validators/schemas.ts`
    - Add `CreateTeamSchema`: `{ name: z.string().min(1).max(100) }`
    - Add `UpdateTeamSchema`: `{ name: z.string().min(1).max(100) }`
    - Add `ValidatePinSchema`: `{ pin: z.string().min(4).max(6) }`
    - Update `CreatePollSchema` to include `teamId: z.string().uuid()` (required for new polls)
    - Update `UpdatePollSchema` to include `teamId: z.string().uuid().optional()` (optional for edits, backward compat)
    - Export new types: `CreateTeamInput`, `UpdateTeamInput`, `ValidatePinInput`
    - _Requirements: 1.4, 2.3, 3.1, 3.3, 4.2, 6.3, 6.4_

- [x] 3. Implement TeamService
  - [x] 3.1 Create `lib/services/teamService.ts` with full CRUD and PIN logic
    - Implement `createTeam(name, userId)`: creates team, calls `generateUniquePin()`, returns team
    - Implement `listTeams(userId)`: returns non-deleted teams for user, ordered by `createdAt` desc
    - Implement `getTeam(id, userId)`: returns team if owned by user and not deleted
    - Implement `updateTeam(id, name, userId)`: renames team if owned by user
    - Implement `deleteTeam(id, userId)`: soft-deletes team, sets `teamId=null` on associated polls
    - Implement `validatePin(pin)`: looks up non-deleted team by PIN, returns `{ teamId, teamName }` or null
    - Implement `generateUniquePin()`: generates 4–6 char alphanumeric PIN (charset excludes I, O, 0, 1), retries up to 10 times on collision
    - Export singleton `teamService` instance
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.4, 2.5, 4.2_

  - [x] 3.2 Write property tests for TeamService PIN generation
    - **Property 2: PIN generation format and uniqueness**
    - **Validates: Requirements 1.2, 1.3**
    - Create `tests/property/pinGeneration.property.test.ts`
    - Use fast-check to verify generated PINs are 4–6 chars, alphanumeric, and unique across batches

  - [x] 3.3 Write property tests for TeamService name validation
    - **Property 3: Invalid team names are rejected**
    - **Validates: Requirements 1.4, 2.3**
    - Create `tests/property/teamService.property.test.ts`
    - Use fast-check to verify empty, whitespace-only, and >100 char names are rejected

  - [x] 3.4 Write property tests for team list ordering
    - **Property 4: Team list ordering**
    - **Validates: Requirements 2.1**
    - Verify listed teams are always ordered by createdAt descending

  - [x] 3.5 Write property tests for team rename preserves fields
    - **Property 5: Rename preserves other fields**
    - **Validates: Requirements 2.2**
    - Verify renaming only changes name, preserving id, pin, userId

  - [x] 3.6 Write property tests for team deletion and poll disassociation
    - **Property 6: Team deletion soft-deletes and disassociates polls**
    - **Validates: Requirements 2.4**
    - Verify deleting a team sets isDeleted=true and nullifies teamId on associated polls

- [x] 4. Update PollService with team filtering
  - [x] 4.1 Add team-aware methods to `lib/services/pollService.ts`
    - Add `listPublicPollsByTeam(teamId)`: returns non-deleted polls where `teamId` matches
    - Add `listPollsByTeam(userId, teamId)`: returns facilitator's polls filtered by team
    - Update `createPoll` to accept and persist `teamId` from input data
    - Update `updatePoll` to accept optional `teamId` and validate ownership of target team
    - Update `listPublicPolls` to also return polls with `teamId=null` (backward compat)
    - _Requirements: 3.1, 3.2, 3.4, 3.6, 6.2_

  - [x] 4.2 Write property tests for poll filtering by team
    - **Property 9: Poll filtering by team**
    - **Validates: Requirements 3.6, 4.3**
    - Create `tests/property/pollFiltering.property.test.ts`
    - Verify querying by teamId returns exactly matching polls and no others

  - [x] 4.3 Write property tests for unassigned polls visibility
    - **Property 12: Unassigned polls visible to all**
    - **Validates: Requirements 6.2**
    - Verify polls with teamId=null appear in public listing regardless of team filter

- [x] 5. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Team API routes (CRUD)
  - [x] 6.1 Create `app/api/teams/route.ts` with GET and POST handlers
    - GET: authenticated, calls `teamService.listTeams(userId)`, returns team list
    - POST: authenticated, validates body with `CreateTeamSchema`, calls `teamService.createTeam`, returns 201
    - Use `withAuth` middleware and error helpers from `lib/api/errors.ts`
    - _Requirements: 1.1, 1.2, 1.4, 2.1_

  - [x] 6.2 Create `app/api/teams/[id]/route.ts` with GET, PUT, DELETE handlers
    - GET: authenticated, calls `teamService.getTeam(id, userId)`, returns team or 404
    - PUT: authenticated, validates body with `UpdateTeamSchema`, calls `teamService.updateTeam`, returns updated team or 404
    - DELETE: authenticated, calls `teamService.deleteTeam(id, userId)`, returns 200 or 404
    - Return 403 if team not owned by user (handled by service returning null)
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [x] 6.3 Create `app/api/teams/validate-pin/route.ts` with POST handler
    - POST: no auth required, validates body with `ValidatePinSchema`, calls `teamService.validatePin`
    - Returns `{ teamId, teamName }` on success, 404 with "PIN not recognized" on failure
    - _Requirements: 4.2, 4.4_

  - [x] 6.4 Write property tests for PIN validation endpoint
    - **Property 10: Valid PIN returns correct team**
    - **Validates: Requirements 4.2**
    - **Property 11: Invalid PIN returns error**
    - **Validates: Requirements 4.4**
    - Create `tests/property/pinValidation.property.test.ts`

- [x] 7. Update polls API route for team assignment
  - [x] 7.1 Update `app/api/polls/route.ts` POST handler to require teamId
    - The updated `CreatePollSchema` already requires `teamId`
    - Add validation that the team exists and is owned by the authenticated user before creating the poll
    - Return 403 if team not owned by user
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 7.2 Update `app/api/polls/[id]/route.ts` PUT handler to accept optional teamId
    - Allow `teamId` in update body (optional for backward compat)
    - Validate team ownership if `teamId` is provided
    - _Requirements: 3.2, 3.4, 6.4_

  - [x] 7.3 Update `app/api/polls/public/route.ts` to accept teamId query param
    - Accept optional `teamId` query parameter
    - If `teamId` provided: return polls matching that team PLUS polls with `teamId=null`
    - If no `teamId`: return all non-deleted polls (existing behavior)
    - _Requirements: 4.3, 6.2_

  - [x] 7.4 Write property test for cross-ownership team assignment rejection
    - **Property 8: Cross-ownership team assignment rejected**
    - **Validates: Requirements 3.4**

- [x] 8. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Teams management page for facilitators
  - [x] 9.1 Create `app/admin/teams/page.tsx` with full team CRUD UI
    - Display list of facilitator's teams with name, PIN (prominent), and creation date
    - Include "Create Team" form with name input and validation
    - Include inline rename functionality for each team
    - Include delete button with confirmation dialog
    - Add copy-to-clipboard button for each team PIN
    - Style consistently with existing admin pages
    - _Requirements: 2.1, 2.2, 2.4, 5.1, 5.2, 5.3_

  - [x] 9.2 Add Teams navigation link to admin layout
    - Update `app/admin/layout.tsx` to include a "Teams" link in the navigation
    - _Requirements: 5.1_

- [x] 10. Update poll creation/edit forms with team selector
  - [x] 10.1 Create `components/admin/TeamSelector.tsx` component
    - Dropdown component that fetches and displays facilitator's teams
    - Accept `value` and `onChange` props for controlled usage
    - Show team name and PIN in each option for easy identification
    - Display validation error state when no team selected
    - _Requirements: 3.1, 3.2_

  - [x] 10.2 Update `components/admin/PollForm.tsx` to include TeamSelector
    - Add TeamSelector field (required for new polls, optional for editing legacy polls)
    - Pass `teamId` in form data on submit
    - Add client-side validation: teamId required for new polls
    - For edit mode with existing poll that has no teamId, show selector as optional
    - _Requirements: 3.1, 3.2, 3.3, 6.3, 6.4_

  - [x] 10.3 Update `app/admin/polls/new/page.tsx` to pass teamId to API
    - Include `teamId` from form data in the POST request body
    - _Requirements: 3.1_

  - [x] 10.4 Update `app/admin/polls/[id]/edit/page.tsx` to handle teamId
    - Load current poll's teamId and pass as initial value to PollForm
    - Include `teamId` in PUT request body when changed
    - _Requirements: 3.2, 6.4_

- [x] 11. Update admin dashboard to show team info on polls
  - [x] 11.1 Update `app/admin/page.tsx` to display team name per poll
    - Fetch teams list alongside polls
    - Display team name badge next to each poll title
    - Show "No team" indicator for legacy polls without team assignment
    - Add team filter dropdown to filter polls by team
    - _Requirements: 3.5, 3.6_

- [x] 12. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Update participant page with PIN entry flow
  - [x] 13.1 Create `components/participant/PinEntryForm.tsx` component
    - Input field for 4–6 character PIN with submit button
    - Display error message for invalid/unrecognized PINs
    - Accessible form with proper labels and ARIA attributes
    - _Requirements: 4.1, 4.4_

  - [x] 13.2 Update `app/poll/page.tsx` with PIN gate and localStorage persistence
    - On mount, check localStorage for stored `team_pin`
    - If stored PIN exists, auto-validate via `/api/teams/validate-pin` and load polls
    - If no stored PIN, show PinEntryForm
    - On successful PIN validation, store PIN in localStorage and fetch filtered polls
    - On invalid stored PIN (team deleted), clear localStorage and show PinEntryForm
    - Add "Switch Team" button that clears stored PIN and shows PinEntryForm again
    - Show unassigned polls (teamId=null) alongside team-filtered polls
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 6.2_

  - [x] 13.3 Write unit tests for participant page PIN flow
    - Test localStorage read/write behavior
    - Test PIN validation success and error states
    - Test "Switch Team" functionality
    - _Requirements: 4.5, 4.6, 4.7, 4.8_

- [x] 14. Authorization guard for team operations
  - [x] 14.1 Add ownership validation in TeamService and PollService
    - Ensure `teamService` methods reject operations on teams not owned by the requesting user
    - Ensure `pollService.createPoll` and `updatePoll` verify team ownership before assignment
    - Return appropriate error codes (403 FORBIDDEN) for unauthorized access
    - _Requirements: 2.5, 3.4_

  - [x] 14.2 Write property test for cross-user team authorization
    - **Property 7: Authorization prevents cross-user team management**
    - **Validates: Requirements 2.5**
    - Verify facilitator B cannot read/update/delete teams owned by facilitator A

- [x] 15. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Backward compatibility is maintained: existing polls with no teamId remain visible to all participants
- Database migrations use `mcp_supabase_apply_migration`, followed by `npx prisma generate` (NOT `prisma migrate`)
- The PIN charset excludes ambiguous characters (I, O, 0, 1) for readability during verbal sharing
