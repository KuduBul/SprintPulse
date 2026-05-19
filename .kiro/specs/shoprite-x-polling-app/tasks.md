# Implementation Plan: Shoprite-X Polling & Live Facilitation App

## Overview

This plan implements a web-based internal polling and live facilitation tool using Next.js 14+ (App Router), Supabase Postgres, Prisma ORM, Zod validation, and Vitest + fast-check for testing. Tasks are ordered to build incrementally: project setup → data layer → service layer → API routes → frontend components → integration wiring.

## Tasks

- [x] 1. Project setup and core infrastructure
  - [x] 1.1 Initialize Next.js 14+ project with App Router, TypeScript strict mode, and configure path aliases
    - Create Next.js app with `app/` directory structure
    - Configure `tsconfig.json` with strict mode and path aliases (`@/lib`, `@/components`, etc.)
    - Add dependencies: `prisma`, `@prisma/client`, `zod`, `uuid`
    - Add dev dependencies: `vitest`, `fast-check`, `@testing-library/react`, `@testing-library/jest-dom`
    - Configure Vitest in `vitest.config.ts`
    - _Requirements: 17 (Technical Stack)_

  - [x] 1.2 Set up Prisma schema and database connection
    - Create `prisma/schema.prisma` with Poll, Question, Response, and AuditLog models as defined in the design
    - Configure datasource for Supabase Postgres via `DATABASE_URL` env var
    - Add indexes on `Response.pollId`, `Response.questionId`, `Response.sessionToken`, `AuditLog.pollId`, `AuditLog.createdAt`
    - Add unique constraint on `Response(pollId, questionId, sessionToken)`
    - Create Prisma client singleton in `lib/db/client.ts`
    - Run initial migration
    - _Requirements: 9.3, Data Models_

  - [x] 1.3 Create environment configuration and constants
    - Create `.env.example` with `DATABASE_URL`, `ADMIN_SECRET`, `RETENTION_RESPONSES_DAYS`, `RETENTION_AUDIT_DAYS`, `POLL_INTERVAL_MS`
    - Create `lib/config.ts` exporting typed environment variables with defaults
    - _Requirements: 10.1, 9.1, 9.2, 12.3_

  - [x] 1.4 Set up CSS variables and Shoprite-X design tokens
    - Create `app/globals.css` with CSS custom properties for colours, spacing, typography
    - Ensure colour contrast ratio ≥ 4.5:1 (WCAG AA)
    - Define focus indicator styles for all interactive elements
    - _Requirements: 13.3, 13.4_

- [x] 2. Validation layer (Zod schemas)
  - [x] 2.1 Implement all Zod validation schemas
    - Create `lib/validators/schemas.ts` with: `CreatePollSchema`, `UpdatePollSchema`, `CreateQuestionSchema`, `UpdateQuestionSchema`, `PositionSchema`, `SubmitResponsesSchema`, `AnswerSchema`, `FacilitatorStateSchema`
    - Enforce title 1–200 chars, description 0–1000 chars, question text 1–500 chars
    - Enforce options array 2–10 items, questions per poll 1–20
    - Enforce participant name 2–50 chars, session token as UUID
    - Create `lib/validators/imageValidator.ts` for file type (JPEG/PNG/WebP) and size (≤5MB) validation
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.5, 4.4, 11.1_

  - [x] 2.2 Write property tests for validation schemas
    - **Property 2: Image type validation accepts only allowed formats**
    - **Property 6: Question count validation**
    - **Property 7: Option count validation**
    - **Validates: Requirements 1.5, 2.2, 2.3**

- [x] 3. Service layer — Poll and Question management
  - [x] 3.1 Implement Audit Logger service
    - Create `lib/services/auditLogger.ts` implementing the `AuditLogger` interface
    - Support all `AuditAction` types defined in the design
    - Record entries with `createdAt` timestamp, no `updatedAt`
    - Log within the same transaction as the triggering action
    - _Requirements: 8.1–8.14_

  - [x] 3.2 Implement Poll Service
    - Create `lib/services/pollService.ts` implementing `PollService` interface
    - `createPoll`: create poll with default facilitator state (`{_v:1, votingOpen:false, liveResults:false, anonymise:true, revealStage:"HIDDEN"}`)
    - `updatePoll`: update title, description, backgroundImageUrl
    - `deletePoll`: soft-delete (set `isDeleted = true`)
    - `clonePoll`: duplicate poll + questions with "(Copy)" suffix, zero responses, preserve original
    - `resetResponses`: delete all responses for a poll
    - `getPoll`: return poll (exclude soft-deleted)
    - `listPolls`: return all non-deleted polls
    - `getPublicPoll`: return poll data for participant view (questions + facilitator state)
    - All mutations log via AuditLogger
    - _Requirements: 1.1, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [x] 3.3 Write property tests for Poll Service
    - **Property 1: Poll creation round-trip**
    - **Property 3: Poll reset removes all responses**
    - **Property 4: Clone produces identical questions with zero responses and preserves original**
    - **Property 5: Soft-deleted polls are hidden from views but retained in database**
    - **Property 12: Facilitator state defaults**
    - **Validates: Requirements 1.1, 1.6, 1.7, 1.8, 1.9, 1.10, 5.1**

  - [x] 3.4 Implement Question Service
    - Create `lib/services/questionService.ts` implementing `QuestionService` interface
    - `createQuestion`: create question with position, displayOrder, options
    - `updateQuestion`: update text, options, allowCustom, position, displayOrder
    - `deleteQuestion`: remove question
    - `reorderQuestions`: update displayOrder for all questions in a poll
    - All mutations log via AuditLogger
    - _Requirements: 2.1–2.8_

- [x] 4. Service layer — Responses and Facilitation
  - [x] 4.1 Implement Response Service
    - Create `lib/services/responseService.ts` implementing `ResponseService` interface
    - `submitResponses`: validate all questions answered, check voting open, check duplicate session token, persist responses, log audit
    - `hasSubmitted`: check if session token already submitted for poll
    - `getResults`: aggregate results with counts, percentages, free-text; respect `includeTest`, `revealStage`, `anonymise` options
    - `clearTestResponses`: remove only `isTest=true` responses
    - Enforce unique constraint `(pollId, questionId, sessionToken)` for deduplication
    - _Requirements: 4.5, 4.8, 4.10, 6.2, 6.3, 6.5, 6.7, 7.1–7.8_

  - [x] 4.2 Write property tests for Response Service — submission rules
    - **Property 10: Incomplete submissions are rejected**
    - **Property 11: Duplicate submission prevention (idempotence)**
    - **Validates: Requirements 4.5, 4.8, 4.10**

  - [x] 4.3 Write property tests for Response Service — results aggregation
    - **Property 16: Test responses excluded from public results and participant count**
    - **Property 17: Clearing test responses preserves real data**
    - **Property 18: Results aggregation correctness**
    - **Property 19: Percentage sum invariant**
    - **Property 20: Free-text verbatim preservation**
    - **Property 21: Anonymised results contain no real names in output**
    - **Property 22: Free-text section hidden when no custom entries exist**
    - **Validates: Requirements 6.2, 6.3, 6.5, 6.7, 7.1–7.8, 5.10**

  - [x] 4.4 Implement Facilitator Service
    - Create `lib/services/facilitatorService.ts` implementing `FacilitatorService` interface
    - `getState`: parse facilitator state JSON from poll, handle schema versioning (`_v` key)
    - `updateState`: merge partial state update (last-write-wins), persist, log audit
    - Log specific actions: `VOTING_OPENED`, `VOTING_CLOSED`, `REVEAL_STAGE_CHANGED`, `FACILITATOR_STATE_UPDATED`
    - _Requirements: 5.1–5.8_

  - [x] 4.5 Write property tests for Facilitator Service
    - **Property 14: Facilitator state persistence round-trip**
    - **Property 15: Last-write-wins for concurrent state updates**
    - **Validates: Requirements 5.6, 5.8**

  - [x] 4.6 Write property test for anonymisation
    - **Property 13: Anonymisation replaces all participant names**
    - **Validates: Requirements 5.5, 7.5**

- [x] 5. Service layer — Retention and Security
  - [x] 5.1 Implement Retention Service
    - Create `lib/services/retentionService.ts` implementing `RetentionService` interface
    - `purge`: delete responses older than `RETENTION_RESPONSES_DAYS` (default 90), audit logs older than `RETENTION_AUDIT_DAYS` (default 365), hard-delete soft-deleted polls older than 30 days
    - Apply same retention policy to test and real responses
    - Log `DATA_PURGED` action via AuditLogger with counts
    - _Requirements: 9.1–9.6_

  - [x] 5.2 Write property tests for Retention Service
    - **Property 25: Retention purge respects age thresholds**
    - **Property 26: Audit log retention purge**
    - **Property 27: Soft-deleted poll hard-deletion after grace period**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.6**

  - [x] 5.3 Implement XSS sanitisation utility
    - Create `lib/utils/sanitise.ts` to strip HTML tags and script elements from free-text input
    - Apply sanitisation in the Response Service before persisting custom text
    - _Requirements: 11.2_

  - [x] 5.4 Write property test for XSS sanitisation
    - **Property 30: XSS sanitisation of free-text input**
    - **Validates: Requirements 11.2**

  - [x] 5.5 Write property test for audit log immutability
    - **Property 24: Audit log immutability**
    - **Validates: Requirements 8.14**

  - [x] 5.6 Write property test for audit log completeness
    - **Property 23: Audit log completeness**
    - **Validates: Requirements 8.1–8.12**

- [x] 6. Checkpoint — Service layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Middleware and API infrastructure
  - [x] 7.1 Implement Admin Auth middleware
    - Create `middleware/adminAuth.ts` with `withAdminAuth` higher-order function
    - Validate `x-admin-token` header against `ADMIN_SECRET` env var
    - Return 401 with `{error: {code: "UNAUTHORIZED", message: "..."}}` if invalid
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 7.2 Write property tests for Admin Auth middleware
    - **Property 28: Admin auth rejects invalid tokens**
    - **Property 29: Admin auth accepts valid tokens**
    - **Validates: Requirements 10.1, 10.2, 10.3**

  - [x] 7.3 Implement Rate Limiter middleware
    - Create `middleware/rateLimit.ts` with in-memory sliding window rate limiter
    - Key by IP address, default 60 requests per minute
    - Return 429 with `{error: {code: "RATE_LIMITED", message: "..."}}` when exceeded
    - _Requirements: 11.3, 11.5_

  - [x] 7.4 Create API error response utilities
    - Create `lib/api/errors.ts` with consistent error response format (`ApiError` interface)
    - Helper functions for 400, 401, 404, 409, 410, 429, 500 responses
    - Zod error formatting for field-level validation details
    - _Requirements: Error Handling (Design)_

- [x] 8. API Routes — Poll and Question CRUD
  - [x] 8.1 Implement Poll CRUD API routes
    - `app/api/polls/route.ts`: GET (list all polls), POST (create poll) — admin auth required
    - `app/api/polls/[id]/route.ts`: GET, PATCH, DELETE (soft-delete) — admin auth required
    - `app/api/polls/[id]/clone/route.ts`: POST — admin auth required
    - `app/api/polls/[id]/reset/route.ts`: POST — admin auth required
    - Apply Zod validation on all inputs, return structured errors
    - _Requirements: 1.1–1.10, 10.1_

  - [x] 8.2 Implement Question CRUD API routes
    - `app/api/polls/[id]/questions/route.ts`: POST (create question) — admin auth required
    - `app/api/polls/[id]/questions/[qId]/route.ts`: PATCH, DELETE — admin auth required
    - Apply Zod validation, enforce option count and question count limits
    - _Requirements: 2.1–2.8_

  - [x] 8.3 Implement Facilitator API routes
    - `app/api/polls/[id]/facilitator/route.ts`: GET, PATCH — admin auth required
    - PATCH applies partial state update via FacilitatorService
    - _Requirements: 5.1–5.8_

- [x] 9. API Routes — Public endpoints and system
  - [x] 9.1 Implement public poll and response submission routes
    - `app/api/polls/[id]/public/route.ts`: GET (poll data for participants, respects soft-delete)
    - `app/api/polls/[id]/respond/route.ts`: POST (submit responses) — rate limited, validates voting open
    - Return 410 `VOTING_CLOSED` if voting is closed at submission time
    - Return 409 `CONFLICT` for duplicate session token submissions
    - _Requirements: 4.1–4.11, 6.1–6.7_

  - [x] 9.2 Implement results API routes
    - `app/api/polls/[id]/results/route.ts`: GET (admin, full results) — admin auth required
    - `app/api/polls/[id]/results/public/route.ts`: GET (public, respects reveal stage and anonymisation)
    - _Requirements: 7.1–7.8, 5.3, 5.4, 5.5_

  - [x] 9.3 Implement system purge endpoint
    - `app/api/system/purge/route.ts`: POST — triggered by Vercel Cron
    - Configure `vercel.json` cron schedule for daily 02:00 UTC
    - _Requirements: 9.1–9.6_

- [x] 10. Checkpoint — API layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Frontend — Admin pages and Poll Canvas editor
  - [x] 11.1 Create admin layout and poll list page
    - Create `app/admin/layout.tsx` with admin navigation
    - Create `app/admin/page.tsx` displaying list of polls with create/edit/delete actions
    - Implement admin token storage in browser (prompt on first visit)
    - Use semantic HTML (`<main>`, `<nav>`, `<section>`)
    - _Requirements: 1.1, 13.1, 13.2_

  - [x] 11.2 Create poll creation and edit form
    - Create `app/admin/polls/new/page.tsx` and `app/admin/polls/[id]/edit/page.tsx`
    - Form fields: title, description, background image upload
    - Client-side validation matching Zod schemas (title max 200, description max 1000)
    - Image upload to Supabase Storage (`poll-backgrounds` bucket) with type/size validation
    - _Requirements: 1.1–1.5_

  - [x] 11.3 Implement PollCanvas editor component
    - Create `components/canvas/PollCanvas.tsx` with drag-and-drop question placement
    - Sidebar showing unplaced questions
    - Canvas area with background image (or grey placeholder)
    - Draggable question cards with corner resize handles
    - Right-click context menu for "Remove from canvas"
    - Store positions as percentage-based coordinates (0–100)
    - Z-index by placement order (last-placed on top)
    - _Requirements: 3.1–3.6, 3.11_

  - [x] 11.4 Implement PollCanvas responsive behaviour and fallbacks
    - Desktop (≥1024px): full editor with drag-and-drop
    - Tablet (768–1023px): view-only canvas mode
    - Mobile (<768px): vertical scrollable list, no canvas
    - Feature detection for Drag and Drop API; fallback to coordinate input fields with warning banner
    - Handle image load failure with placeholder + error message
    - _Requirements: 3.7, 3.8, 3.9, 3.10, 3.6_

  - [x] 11.5 Write property test for canvas z-index ordering
    - **Property 8: Canvas z-index matches placement order**
    - **Validates: Requirements 3.11**

- [x] 12. Frontend — Participant view
  - [x] 12.1 Implement participant poll page and session management
    - Create `app/poll/[id]/page.tsx` for public participant view
    - Display "Voting is currently closed" when `votingOpen = false`
    - Name entry field (2–50 chars) with session token generation and localStorage persistence
    - Restore name on page refresh from stored session token
    - Display "Already submitted" if session token found for this poll
    - _Requirements: 4.1, 4.2, 4.3, 4.7, 4.8_

  - [x] 12.2 Write property test for session token persistence
    - **Property 9: Session token persistence round-trip**
    - **Validates: Requirements 4.2, 4.3**

  - [x] 12.3 Implement ParticipantForm component
    - Create `components/participant/ParticipantForm.tsx`
    - Render questions in canvas layout (desktop) or list (mobile)
    - Option selection with optional free-text input when `allowCustom` is enabled
    - Client-side validation: all questions answered, custom text not empty if selected
    - Submit button with loading state; disable on voting closed
    - Confirmation screen after successful submission
    - Poll facilitator state every 3 seconds to detect voting closed
    - Show "Voting has been closed" banner within 5 seconds if closed mid-form
    - Allow copying free-text answers before navigating away
    - ARIA labels on canvas-placed questions
    - _Requirements: 4.4–4.11, 6.1, 6.6, 13.3_

  - [x] 12.4 Write property test for ARIA labels on canvas questions
    - **Property 31: ARIA labels on canvas-placed questions**
    - **Validates: Requirements 13.3**

- [x] 13. Frontend — Facilitator dashboard and results
  - [x] 13.1 Implement FacilitatorDashboard component
    - Create `app/admin/polls/[id]/facilitate/page.tsx` and `components/facilitator/FacilitatorDashboard.tsx`
    - Toggle controls: voting open/close, live results, anonymisation
    - Reveal stage selector (HIDDEN → COUNTS → DETAILS)
    - Live participant count and submission count (3-second polling)
    - Warning if another facilitator session may be active
    - "Add questions before starting a session" message when poll has no questions
    - "Preview as Participant" button opening participant view with `?testMode=true`
    - Test Responses tab showing test-flagged responses separately
    - Clear test responses action
    - Persist facilitator state across page refreshes
    - _Requirements: 5.1–5.12, 6.1–6.7_

  - [x] 13.2 Implement ResultsDisplay component
    - Create `components/results/ResultsDisplay.tsx`
    - Render aggregated results per question: option counts, percentages, bar charts
    - Display free-text responses grouped under "Custom" (verbatim, no truncation)
    - Hide free-text section when no custom entries exist
    - Respect reveal stage: HIDDEN (no results), COUNTS (totals only), DETAILS (full)
    - Anonymise names as "Participant 1, 2, ..." when anonymisation enabled
    - Show "No responses yet" for questions with zero responses
    - Ensure percentages sum to 100% (±1% tolerance)
    - _Requirements: 7.1–7.8, 5.3, 5.4, 5.5_

- [x] 14. Checkpoint — Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Integration wiring and final polish
  - [x] 15.1 Wire Supabase Storage for image uploads
    - Configure Supabase Storage client in `lib/storage/supabaseStorage.ts`
    - Create `poll-backgrounds` bucket configuration
    - Implement upload with file naming `{pollId}/{timestamp}.{ext}`
    - Validate max 5MB, allowed MIME types before upload
    - Handle upload failures with transaction rollback
    - _Requirements: 1.4, 1.5_

  - [x] 15.2 Configure Vercel deployment and cron
    - Create `vercel.json` with cron configuration for daily purge at 02:00 UTC
    - Configure environment variables in Vercel project settings documentation
    - Ensure database connection pool of 10 connections
    - _Requirements: 9.5, 12.6_

  - [x] 15.3 Implement client-side error handling and connection resilience
    - Create error boundary components for graceful failure display
    - Implement "Connection lost" banner with retry button
    - Exponential backoff for failed requests (initial: 1s, max: 30s, factor: 2)
    - Rate limit feedback (429): "Too many requests" with countdown
    - Preserve form state when voting closes mid-submission
    - _Requirements: 12.4, 12.5, 11.5_

  - [x] 15.4 Implement keyboard navigation and accessibility
    - Ensure all interactive elements are keyboard-navigable (tab order, Enter/Space activation)
    - Add visible focus indicators on all interactive elements
    - Use semantic HTML throughout (`<main>`, `<nav>`, `<section>`, `<button>`)
    - Add screen reader announcements for facilitator state changes (aria-live regions)
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.6_

  - [x] 15.5 Write integration tests for API routes
    - Test full request/response cycles for poll CRUD, question CRUD, response submission
    - Test admin auth middleware enforcement (valid/invalid tokens)
    - Test rate limiting behaviour
    - Test duplicate submission handling (409 response)
    - Test voting closed rejection (410 response)
    - _Requirements: 1.1–1.10, 4.5, 4.8, 10.1–10.3, 11.3_

- [x] 16. Final checkpoint — All tests pass and feature complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests validate the 31 universal correctness properties defined in the design using fast-check
- Unit tests validate specific examples and edge cases
- The tech stack is TypeScript throughout: Next.js 14+, Prisma, Zod, Vitest, fast-check
