# Implementation Plan

## Overview

This plan implements Phase 2A of the Retro Board on the `phase-2-retro` branch, behind the `NEXT_PUBLIC_RETRO_ENABLED` feature flag. Isolation is built first (so nothing can leak to production), then the data model, then the retro engine bottom-up (service → API → UI), with property-based tests for the correctness properties throughout. Pulse preservation is verified at the end. No task merges to `main`.

## Tasks

- [x] 1. Establish production isolation (feature flag + guards)
  - [x] 1.1 Add the feature flag module and gate server + client entry points
    - Create lib/featureFlags.ts exporting RETRO_ENABLED = process.env.NEXT_PUBLIC_RETRO_ENABLED === 'true'
    - Add NEXT_PUBLIC_RETRO_ENABLED=true to .env.local for local development only (never to production env)
    - Create a server guard helper that returns HTTP 404 when RETRO_ENABLED is false, for use by all retro routes
    - Create a client helper/hook to conditionally render retro UI based on the flag
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.2 Write tests for flag gating behavior
    - Test: when flag is false, the server guard yields 404 and retro UI does not render
    - Test: when flag is true, retro entry points render and routes are reachable
    - Test: production-like env (flag unset) is treated as false
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Add the data model (additive migration + retro tables)
  - [x] 2.1 Add Poll.type discriminator and new retro tables to the Prisma schema
    - Add type String @default("pulse") to the Poll model and the retroBoard relation
    - Add RetroBoard, RetroLane, RetroCard, RetroVote, and RetroActionItem models per design.md
    - Include the @@unique([cardId, voterToken]) constraint on RetroVote
    - Generate and apply the migration locally; confirm existing pulse rows default to type "pulse"
    - _Requirements: 2.3, 2.4, 2.5, 5.2, 7.3, 11.1, 11.2_
  - [x] 2.2 Write migration preservation tests
    - Test: existing Poll rows read back with type "pulse" after migration
    - Test: Question and Response tables are structurally unchanged
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 3. Write property-based tests for retro correctness properties (BEFORE service implementation)
  - [x] 3.1 Write PBT for the retro state machine and invariants
    - Property 1 (vote cap): no voterToken ever exceeds the board votesPerUser cap (Design Property 1)
    - Property 2 (one-vote-per-card): at most one RetroVote per (cardId, voterToken) (Design Property 2)
    - Property 3 (phase gates): add-card only in gather; vote only in vote; no participant mutation in closed (Design Property 3)
    - Property 4 (ownership): edit/delete a card only with its authorToken (Design Property 4)
    - Property 5 (anonymity): a board view for participant A never exposes author identity of B while anonymous (Design Property 5)
    - Use the existing fast-check + Vitest patterns and the prisma mock-store approach from tests/properties
    - These tests target retroService (built in task 4) and may be red until then
    - _Requirements: 5.1, 5.3, 5.4, 5.6, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.6, 8.3_

- [x] 4. Implement the retro service (domain engine)
  - [x] 4.1 Implement board and lane creation with templates
    - Create lib/services/retroService.ts with createBoard and template-to-lanes expansion
    - Built-in templates: start_stop_continue, 4ls, mad_sad_glad, custom; enforce 1-8 lanes, titles <=100 chars
    - Set initial phase "gather" and a default votesPerUser cap
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  - [x] 4.2 Implement card capture with phase and ownership rules
    - addCard (gather only, non-empty text <=2000 chars after trim)
    - editCard and deleteCard (own card only, gather only)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_
  - [x] 4.3 Implement voting with cap and uniqueness enforcement
    - castVote and removeVote (vote phase only); enforce per-card uniqueness and per-user total cap server-side
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 4.4 Implement phase control and anonymity-aware board view
    - setPhase (facilitator only) advancing gather -> vote -> closed and applying phase rules
    - getBoard returns a per-viewer BoardView that strips author identity for non-owned cards while anonymous
    - Closed phase rejects all participant mutations
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 4.5 Verify the property-based tests from task 3 pass
    - Run the PBT suite against the implemented service; all five properties green
    - _Requirements: 5.1, 5.3, 5.4, 5.6, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.6, 8.3_

- [x] 5. Implement retro API routes (flag-guarded)
  - [x] 5.1 Extend activity creation and add retro CRUD routes
    - Extend POST /api/polls to accept type "retro" and create the board
    - Add GET /api/retro/[boardId]; POST /api/retro/[boardId]/cards; PATCH+DELETE /api/retro/[boardId]/cards/[cardId]
    - Add POST+DELETE /api/retro/[boardId]/votes; POST /api/retro/[boardId]/phase
    - Apply the flag guard (404 when disabled) and reuse existing auth/team/token access checks
    - _Requirements: 1.2, 2.1, 2.2, 2.3, 4.1, 5.1, 5.3, 6.4, 7.1, 8.1_
  - [x] 5.2 Write route tests for guards, phase rules, and error codes
    - Test 404 when flag off; 409 WRONG_PHASE / VOTE_CAP_EXCEEDED; 403 NOT_CARD_OWNER; 400 validation
    - _Requirements: 1.2, 5.6, 7.2, 7.3, 7.4, 8.3_

- [x] 6. Implement participant identity and join flow
  - [x] 6.1 Add persistent participant token handling
    - Assign and persist a participantToken in the browser on first retro join; reuse on return
    - Wire authorToken/voterToken from the participant token; reuse the name-entry pattern
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7. Implement the retro board UI (mobile-first, new component)
  - [x] 7.1 Build the activity type selector (Pulse / Retro)
    - Add the flag-gated Pulse/Retro choice to the create-activity flow; Pulse path unchanged
    - _Requirements: 1.1, 2.1, 2.2, 2.3_
  - [x] 7.2 Build RetroBoardView with desktop and mobile rendering
    - Desktop: lanes positioned per layout over optional background image; fallback to even columns
    - Mobile: vertical stacked lanes ordered by displayOrder with board title/image header
    - Implement as a new component independent of the pulse canvas placement code
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [x] 7.3 Build card add/edit/delete and voting interactions with optimistic updates
    - Add/edit/delete own cards in gather; cast capped votes in vote; read-only in closed
    - Apply optimistic updates only on actual operations; roll back on error/next poll
    - _Requirements: 5.1, 5.3, 5.5, 6.5, 7.1, 7.5_
  - [x] 7.4 Extend the Facilitate dashboard with retro phase + reveal controls
    - Reuse the polling refresh; add phase advance, reveal/anonymise, and export controls
    - _Requirements: 8.1, 8.4, 6.4_

- [x] 8. Implement export and retention exemption
  - [x] 8.1 Add board export route and exclude retro tables from purge
    - GET /api/retro/[boardId]/export producing JSON and/or CSV of lanes, cards, vote counts, revealed authors
    - Update the /api/system/purge cron logic to exclude retro tables
    - _Requirements: 10.1, 10.2, 10.3_
  - [x] 8.2 Write export and purge-exemption tests
    - Test export content/format; test purge skips retro data
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 9. Verify pulse preservation (no regressions)
  - [x] 9.1 Run the full existing pulse suite and confirm green
    - Run the existing pulse unit + property suites unchanged; confirm identical behavior
    - Confirm that with the flag off the product is indistinguishable from pre-Phase-2
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 10. Checkpoint - full verification on localhost
  - Run full test suite (npx vitest --run), type check (npx tsc --noEmit), and build
  - Manually verify on localhost with the flag on (retro works) and off (pulse-only, retro hidden)
  - Confirm no changes have been merged to main and production remains unaffected
  - Ask the owner to review before any decision to promote toward production


## Notes

- All work stays on the `phase-2-retro` branch behind `NEXT_PUBLIC_RETRO_ENABLED`. Nothing merges to `main` until the owner declares readiness.
- Isolation (task 1) is built first so no later task can leak retro to production.
- The data migration (task 2) is additive only — a single defaulted `Poll.type` column plus new tables; `Question`/`Response` are untouched.
- Property-based tests (task 3) are written before the service (task 4), following the project's established PBT discipline; they go green at task 4.5.
- Real-time uses the existing interval-polling approach for the MVP; the schema is shaped so Supabase Realtime can replace polling in Phase 2B.
- The retro board UI (task 7) is a new mobile-first component, independent of the existing pulse canvas placement code, to avoid inheriting its known mobile/edit-flow issues.
- Deferred to later phases: clustering, drag-between-lanes, action items, templates-as-data, AI, integrations, cross-sprint history (see decisions.md).
