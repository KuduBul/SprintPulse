# Implementation Plan: Multi-Tenant Facilitator Auth

## Overview

Replace SprintPulse's shared `ADMIN_SECRET` token authentication with individual Supabase Auth accounts per facilitator. Implementation uses `@supabase/ssr` for cookie-based sessions in Next.js 14+ App Router, adds a `facilitator_profiles` table, adds `userId` to the `Poll` table, and enforces ownership at the service layer. Participant access remains unauthenticated.

## Tasks

- [x] 1. Install dependencies and set up Supabase client utilities
  - [x] 1.1 Install `@supabase/ssr` package
    - Run `npm install @supabase/ssr`
    - Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are already in `.env`
    - _Requirements: 2.1, 2.4_

  - [x] 1.2 Create browser Supabase client (`lib/supabase/client.ts`)
    - Implement `createClient()` using `createBrowserClient` from `@supabase/ssr`
    - Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - _Requirements: 2.1, 2.3_

  - [x] 1.3 Create server Supabase client (`lib/supabase/server.ts`)
    - Implement `createClient()` using `createServerClient` from `@supabase/ssr`
    - Uses `cookies()` from `next/headers` for cookie management
    - Handles `getAll` and `setAll` cookie operations
    - _Requirements: 4.1, 4.4_

  - [x] 1.4 Create middleware session refresh utility (`lib/supabase/middleware.ts`)
    - Implement `updateSession(request)` function
    - Creates a server client that reads/writes cookies on the request/response
    - Calls `supabase.auth.getUser()` to trigger session refresh
    - _Requirements: 2.4_

- [x] 2. Implement Next.js middleware and auth guard
  - [x] 2.1 Create root `middleware.ts` for session refresh
    - Import and call `updateSession` from `lib/supabase/middleware`
    - Configure matcher to exclude static assets (`_next/static`, `_next/image`, `favicon.ico`, image files)
    - _Requirements: 2.3, 2.4_

  - [x] 2.2 Create `withAuth` route handler wrapper (`middleware/authGuard.ts`)
    - Replace `withAdminAuth` pattern with Supabase Auth validation
    - Call `supabase.auth.getUser()` to validate the session
    - Return 401 if no valid user; pass `userId` to handler if valid
    - Define `AuthenticatedHandler` type with `{ userId: string; params?: any }` context
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.3 Write unit tests for `withAuth` guard
    - Mock `createClient` and `supabase.auth.getUser()`
    - Test: returns 401 when no session
    - Test: returns 401 when getUser returns error
    - Test: passes userId to handler when valid session
    - File: `tests/unit/middleware/authGuard.test.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.4 Write property test: unauthenticated requests are rejected (Property 1)
    - **Property 1: Unauthenticated requests are rejected**
    - Generate random request objects without valid sessions
    - Assert `withAuth` always returns 401 and never calls the inner handler
    - File: `tests/properties/authGuard.property.test.ts`
    - **Validates: Requirements 3.3, 4.2, 4.3**

  - [x] 2.5 Write property test: authenticated requests receive correct user identity (Property 2)
    - **Property 2: Authenticated requests receive correct user identity**
    - Generate random UUIDs, mock `getUser` to return them
    - Assert handler always receives the exact UUID as `userId`
    - File: `tests/properties/authGuard.property.test.ts`
    - **Validates: Requirements 4.4**

- [x] 3. Database migrations
  - [x] 3.1 Create `facilitator_profiles` table via SQL migration
    - Create table with `id` (UUID, PK, FK to `auth.users`), `displayName` (VARCHAR 100), `createdAt`, `updatedAt`
    - Create trigger function `handle_new_facilitator()` that auto-inserts a profile on user signup
    - Create trigger `on_auth_user_created` on `auth.users`
    - Run via Supabase SQL editor or migration file at `prisma/migrations/`
    - _Requirements: 1.5, 7.1_

  - [x] 3.2 Add `userId` column to `Poll` table via Prisma migration
    - Add `userId String?` to `Poll` model in `prisma/schema.prisma` (nullable initially for migration)
    - Add `@@index([userId])` to the Poll model
    - Run `npx prisma migrate dev --name add_poll_user_id`
    - _Requirements: 5.1, 5.5_

  - [x] 3.3 Create migration script for existing polls
    - Write an idempotent SQL script that:
      - Creates a default facilitator account (or skips if exists)
      - Inserts a `facilitator_profiles` row for the default account
      - Updates all `Poll` rows where `userId IS NULL` to set the default facilitator's ID
    - After backfill, alter column to `NOT NULL` and update Prisma schema accordingly
    - Run `npx prisma migrate dev --name make_poll_user_id_required`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 4. Checkpoint - Ensure migrations and infrastructure are solid
  - Ensure all tests pass, ask the user if questions arise.
  - Verify database schema is correct with `npx prisma db pull` or Supabase dashboard
  - Confirm `facilitator_profiles` trigger works by testing a signup

- [x] 5. Implement PollService ownership enforcement
  - [x] 5.1 Update `PollService` interface and implementation with `userId` parameter
    - Add `userId: string` parameter to `createPoll`, `updatePoll`, `deletePoll`, `clonePoll`, `resetResponses`, `getPoll`, `listPolls`
    - `createPoll`: set `userId` on the created poll record
    - `listPolls`: filter by `userId` and `isDeleted: false`
    - `getPoll`, `updatePoll`, `deletePoll`, `clonePoll`, `resetResponses`: query with `WHERE id AND userId`, throw/return null if not found
    - Update audit logger calls to use `userId` instead of hardcoded `'admin'`
    - Keep `getPublicPoll` unchanged (no auth needed)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 10.1, 10.2_

  - [x] 5.2 Write property test: poll creation records ownership (Property 3)
    - **Property 3: Poll creation records ownership**
    - Generate random poll inputs and UUIDs
    - Assert created poll always has `userId` equal to the provided user ID
    - File: `tests/properties/pollService.property.test.ts`
    - **Validates: Requirements 5.1**

  - [x] 5.3 Write property test: poll listing isolation (Property 4)
    - **Property 4: Poll listing isolation**
    - Generate random poll sets with mixed owner UUIDs
    - Assert `listPolls(userId)` returns only polls matching that userId
    - File: `tests/properties/pollService.property.test.ts`
    - **Validates: Requirements 5.2**

  - [x] 5.4 Write property test: non-owner access denied (Property 5)
    - **Property 5: Non-owner access denied**
    - Generate pairs of different UUIDs, poll owned by first
    - Assert second user is always denied access via getPoll, updatePoll, deletePoll, clonePoll, resetResponses
    - File: `tests/properties/pollService.property.test.ts`
    - **Validates: Requirements 5.3, 5.4**

  - [x] 5.5 Write unit tests for PollService ownership logic
    - Mock Prisma client
    - Test: `createPoll` sets userId on record
    - Test: `listPolls` filters by userId
    - Test: `getPoll` returns null for wrong owner
    - Test: `updatePoll` throws/returns error for wrong owner
    - File: `tests/unit/services/pollService.test.ts` (extend existing)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. Implement ProfileService
  - [x] 6.1 Create `lib/services/profileService.ts`
    - Implement `getProfile(userId)`: query `facilitator_profiles` by id, join email from Supabase auth if needed
    - Implement `createProfile(userId, displayName)`: insert into `facilitator_profiles`
    - Implement `updateProfile(userId, displayName)`: validate length (1–100 chars), update record
    - Export singleton `profileService`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 6.2 Write property test: profile display name round-trip (Property 6)
    - **Property 6: Profile display name round-trip**
    - Generate valid display names (1–100 characters, non-empty after trim)
    - Assert `updateProfile` then `getProfile` returns the same display name
    - File: `tests/properties/profileService.property.test.ts`
    - **Validates: Requirements 7.1**

  - [x] 6.3 Write unit tests for ProfileService
    - Test: `updateProfile` rejects names > 100 characters
    - Test: `updateProfile` rejects empty/whitespace-only names
    - Test: `getProfile` returns null for non-existent user
    - File: `tests/unit/services/profileService.test.ts`
    - _Requirements: 7.1, 7.3_

- [x] 7. Implement client-side auth hook and update admin layout
  - [x] 7.1 Create `useAuth` hook (`lib/hooks/useAuth.ts`)
    - Replace `useAdminToken` functionality
    - Implement: `user`, `session`, `isAuthenticated`, `isLoaded` state
    - Implement: `signIn(email, password)`, `signUp(email, password, displayName)`, `signOut()`
    - Subscribe to `onAuthStateChange` for reactive session updates
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 3.1, 3.2_

  - [x] 7.2 Create Login/Register form component (`components/auth/AuthForm.tsx`)
    - Tabbed or toggled UI for Login vs Register
    - Login: email + password fields
    - Register: email + password + display name fields
    - Client-side validation: email format, password ≥ 8 chars, display name required
    - Show error messages from Supabase Auth responses
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_

  - [x] 7.3 Update `app/admin/layout.tsx` to use Supabase Auth
    - Replace `useAdminToken` with `useAuth` hook
    - Replace admin token input form with `AuthForm` component
    - Add logout button to nav bar
    - On logout: call `signOut()`, redirect to login
    - _Requirements: 2.3, 3.1, 3.2, 9.3, 9.4_

  - [x] 7.4 Write unit tests for `useAuth` hook
    - Mock Supabase client
    - Test: initial state is unauthenticated
    - Test: `signIn` calls `supabase.auth.signInWithPassword`
    - Test: `signOut` calls `supabase.auth.signOut` and clears state
    - Test: `onAuthStateChange` updates state
    - File: `tests/unit/hooks/useAuth.test.ts`
    - _Requirements: 2.1, 2.3, 3.1_

- [x] 8. Checkpoint - Ensure auth flow works end-to-end
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: register → login → see dashboard → logout flow works
  - Verify: session persists on page reload

- [x] 9. Update API route handlers to use `withAuth`
  - [x] 9.1 Update poll CRUD routes to use `withAuth` and pass `userId`
    - `app/api/polls/route.ts` (POST for create, GET for list): wrap with `withAuth`, pass `userId` to service
    - `app/api/polls/[id]/route.ts` (GET, PUT, DELETE): wrap with `withAuth`, pass `userId`
    - `app/api/polls/[id]/clone/route.ts`: wrap with `withAuth`, pass `userId`
    - `app/api/polls/[id]/reset/route.ts`: wrap with `withAuth`, pass `userId`
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.3, 5.4_

  - [x] 9.2 Update facilitator state and question routes to use `withAuth`
    - `app/api/polls/[id]/facilitator/route.ts`: wrap with `withAuth`, verify ownership via `getPoll(id, userId)`
    - `app/api/polls/[id]/questions/route.ts`: wrap with `withAuth`, verify ownership
    - `app/api/polls/[id]/questions/[qId]/route.ts`: wrap with `withAuth`, verify ownership
    - `app/api/polls/[id]/upload/route.ts`: wrap with `withAuth`, verify ownership
    - _Requirements: 4.1, 5.3, 5.4_

  - [x] 9.3 Ensure public/participant routes remain unauthenticated
    - `app/api/polls/[id]/public/route.ts`: NO auth wrapper (keep as-is)
    - `app/api/polls/[id]/respond/route.ts`: NO auth wrapper (keep as-is)
    - `app/api/polls/[id]/results/public/route.ts`: NO auth wrapper (keep as-is)
    - `app/api/polls/public/route.ts`: NO auth wrapper (keep as-is)
    - `app/api/polls/[id]/session-check/route.ts`: NO auth wrapper (keep as-is)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 9.4 Write unit tests for updated route handlers
    - Test: protected routes return 401 without auth
    - Test: protected routes return 403 for wrong owner
    - Test: public routes work without auth
    - File: `tests/unit/api/` (extend existing test files)
    - _Requirements: 4.2, 5.3, 6.1, 6.2, 6.3_

- [x] 10. Implement profile management UI
  - [x] 10.1 Create profile API route (`app/api/profile/route.ts`)
    - GET: return current user's profile (display name, email)
    - PUT: update display name with validation (1–100 chars)
    - Wrap with `withAuth`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 10.2 Create profile page (`app/admin/profile/page.tsx`)
    - Display email (read-only) and editable display name
    - Form submission calls PUT `/api/profile`
    - Show success/error feedback
    - Add navigation link in admin layout
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 11. Update audit logging to use authenticated user ID
  - [x] 11.1 Update all audit logger calls to pass facilitator userId as actor
    - In `PollService`: already handled in task 5.1 (actor = userId)
    - In `questionService`, `facilitatorService`: update actor from `'admin'` to the authenticated userId
    - Participant actions (`responseService`): keep actor as `'participant'`
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 11.2 Write property test: audit log records authenticated actor identity (Property 7)
    - **Property 7: Audit log records authenticated actor identity**
    - Generate random UUIDs and audit actions
    - Assert the resulting AuditLog record always has `actor` equal to the userId
    - File: `tests/properties/auditLogger.property.test.ts`
    - **Validates: Requirements 10.1, 10.2**

- [x] 12. Remove legacy admin token authentication
  - [x] 12.1 Remove `withAdminAuth` and `useAdminToken`
    - Delete `middleware/adminAuth.ts`
    - Delete or repurpose `lib/hooks/useAdminToken.ts`
    - Remove `ADMIN_SECRET` from `.env.example` and documentation
    - Remove any remaining `x-admin-token` header references in route handlers
    - Update `app/api/system/purge/route.ts` to use `withAuth` (or restrict to a super-admin check)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 12.2 Update FacilitatorDashboard and related components
    - Remove admin token passing from API calls in `components/facilitator/FacilitatorDashboard.tsx`
    - Update `lib/hooks/useApi.ts` to no longer send `x-admin-token` header
    - Session cookies are sent automatically — no explicit token header needed
    - _Requirements: 9.1, 9.4_

- [x] 13. Final checkpoint - Full regression verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: new facilitator can register, login, create poll, manage poll, logout
  - Verify: participant can still vote without auth
  - Verify: one facilitator cannot see/modify another's polls
  - Verify: existing polls are assigned to default facilitator after migration

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "3.2"] },
    { "id": 2, "tasks": ["2.1", "2.2", "3.3"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5"] },
    { "id": 4, "tasks": ["5.1", "6.1", "7.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4", "5.5", "6.2", "6.3", "7.2"] },
    { "id": 6, "tasks": ["7.3", "7.4"] },
    { "id": 7, "tasks": ["9.1", "9.2", "9.3", "10.1"] },
    { "id": 8, "tasks": ["9.4", "10.2", "11.1"] },
    { "id": 9, "tasks": ["11.2", "12.1"] },
    { "id": 10, "tasks": ["12.2"] }
  ]
}
```

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `@supabase/ssr` package handles cookie-based session management automatically
- No RLS is used — ownership enforcement is at the application layer via Prisma queries
