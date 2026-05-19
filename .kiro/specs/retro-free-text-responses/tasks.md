# Implementation Plan: Retro Free-Text Responses

## Overview

This plan implements the "retro" poll type for SprintPulse, enabling sprint retrospectives with free-text responses. The implementation proceeds from database schema changes through backend services to frontend components, ensuring each step builds on the previous and no code is left unwired.

## Tasks

- [ ] 1. Database migration and schema updates
  - [ ] 1.1 Apply database migration for retro poll support
    - Add `type` VARCHAR(10) NOT NULL DEFAULT 'pulse' column to Poll table
    - Add `maxResponsesPerQuestion` INTEGER nullable column to Poll table
    - Add `responseIndex` INTEGER nullable column to Response table
    - Create conditional unique index `Response_retro_unique` on (pollId, questionId, sessionToken, responseIndex) WHERE responseIndex IS NOT NULL
    - Use `mcp_supabase_apply_migration` tool to apply the migration
    - _Requirements: 1.1, 1.9, 4.1, 4.4, 4.5_

  - [ ] 1.2 Update Prisma schema to reflect new columns
    - Add `type String @default("pulse") @db.VarChar(10)` to Poll model
    - Add `maxResponsesPerQuestion Int?` to Poll model
    - Add `responseIndex Int?` to Response model
    - Run `npx prisma generate` to regenerate the Prisma client
    - _Requirements: 1.1, 4.1_

- [ ] 2. Validation schemas
  - [ ] 2.1 Add retro-specific Zod validation schemas
    - Add `type` field (z.enum(['pulse', 'retro']).default('pulse')) to `CreatePollSchema`
    - Add `maxResponsesPerQuestion` field (z.number().int().min(1).max(10).optional()) to `CreatePollSchema`
    - Create `RetroCreateQuestionSchema` with empty options array constraint and position null
    - Create `RetroAnswerSchema` with entries array (trimmed strings, min 1 char, max 2000)
    - Create `RetroSubmitResponsesSchema` with participantName, sessionToken, answers array
    - Export inferred TypeScript types: `RetroAnswer`, `SubmitRetroResponsesInput`
    - _Requirements: 1.3, 1.6, 2.1, 2.2, 2.3, 3.4, 3.5_

  - [ ]* 2.2 Write property tests for retro validation schemas (Properties 1, 2, 5, 7)
    - **Property 1: Invalid poll type rejection** — generate random strings not in ["pulse", "retro"], verify rejection
    - **Property 2: maxResponsesPerQuestion range validation** — generate integers outside 1-10, verify rejection
    - **Property 5: Retro question requires empty options array** — generate non-empty arrays, verify rejection
    - **Property 7: Retro entry text validation** — generate whitespace-only and >2000 char strings, verify rejection
    - **Validates: Requirements 1.3, 1.6, 2.2, 2.3, 3.4, 3.5**

- [ ] 3. PollService updates
  - [ ] 3.1 Extend PollService to handle type and maxResponsesPerQuestion
    - Update `createPoll` to persist `type` (default "pulse") and `maxResponsesPerQuestion` (default 5 for retro, null for pulse)
    - Update `updatePoll` to reject type changes with `TYPE_IMMUTABLE` error
    - Update `updatePoll` to allow `maxResponsesPerQuestion` updates for retro polls
    - Update `clonePoll` to copy `type` and `maxResponsesPerQuestion`
    - Update `getPublicPoll` and `getPublicPollByToken` to include `type` and `maxResponsesPerQuestion` in response
    - Update `PublicPollView` interface to include `type` and `maxResponsesPerQuestion`
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.7, 1.8, 10.4_

  - [ ]* 3.2 Write property tests for PollService (Properties 3, 4)
    - **Property 3: maxResponsesPerQuestion ignored for pulse polls** — generate pulse poll creation with maxResponsesPerQuestion values, verify null persisted
    - **Property 4: Poll type immutability** — generate update payloads with type field, verify rejection
    - **Validates: Requirements 1.7, 1.8, 10.4**

- [ ] 4. ResponseService updates
  - [ ] 4.1 Implement submitRetroResponses method
    - Add `submitRetroResponses` method to ResponseService interface and implementation
    - Fetch poll and verify `type === 'retro'`
    - Check `facilitatorState.votingOpen === true`
    - Check no existing responses for sessionToken + pollId (duplicate rejection)
    - Validate all questions are answered (at least 1 entry each)
    - Validate entry count does not exceed `maxResponsesPerQuestion`
    - Trim whitespace from each entry
    - Create Response rows: `selectedOption: ""`, `customText: trimmedEntry`, `responseIndex: i`
    - Log audit entry
    - Run in a single Prisma transaction
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 3.8, 3.9, 3.10, 4.3, 4.6, 4.7_

  - [ ]* 4.2 Write property tests for retro submission (Properties 6, 8, 9, 10, 11, 12)
    - **Property 6: Retro entry count validation** — generate entry arrays of various lengths, verify acceptance/rejection against maxResponsesPerQuestion
    - **Property 8: Retro entry whitespace trimming** — generate padded strings, verify trim applied to persisted customText
    - **Property 9: Retro response storage format** — generate submissions, verify N rows with correct responseIndex, selectedOption="", customText=trimmed entry
    - **Property 10: Pulse poll responseIndex is null** — generate pulse submissions, verify responseIndex is null
    - **Property 11: Retro duplicate session rejection** — submit twice with same sessionToken, verify conflict error
    - **Property 12: Retro voting gate** — generate submissions with votingOpen=false, verify rejection
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.6, 3.7, 3.9, 3.10, 4.2, 4.3, 4.6, 4.7**

- [ ] 5. Checkpoint - Ensure backend services pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Results aggregation updates
  - [ ] 6.1 Extend getResults for retro-specific aggregation logic
    - Branch aggregation logic based on poll type (fetch poll to determine type)
    - For retro + HIDDEN: return empty questions array, participantCount 0, submissionCount 0
    - For retro + COUNTS: return totalResponses count per category and participantCount, but no text content or participant labels (customResponses = [])
    - For retro + DETAILS: return all text entries grouped by category, ordered by createdAt ASC, with participant labels
    - Implement stable anonymisation: assign "Participant N" labels based on first submission time across the poll
    - For categories with zero responses: include with totalResponses 0
    - Return options as empty array for retro questions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [ ]* 6.2 Write property tests for retro aggregation (Properties 13, 14, 15, 16, 17, 18)
    - **Property 13: Retro reveal stage HIDDEN returns empty results** — generate responses, verify empty output at HIDDEN
    - **Property 14: Retro reveal stage COUNTS excludes text content** — verify counts present but no text/labels
    - **Property 15: Retro reveal stage DETAILS includes all entries** — verify all entries present with labels
    - **Property 16: Retro anonymisation label consistency** — verify same participant gets same label across categories
    - **Property 17: Retro results ordering by submission time** — verify chronological order
    - **Property 18: Retro text verbatim preservation** — verify exact text returned without truncation
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 5.9**

- [ ] 7. API route updates
  - [ ] 7.1 Update respond route with type-aware dispatch
    - In `POST /api/polls/[id]/respond`, fetch poll type before validation
    - If `type === 'retro'`: validate with `RetroSubmitResponsesSchema`, call `submitRetroResponses`
    - If `type === 'pulse'`: validate with existing `SubmitResponsesSchema`, call `submitResponses`
    - Return appropriate error responses for retro-specific errors
    - _Requirements: 3.1, 3.9, 3.10_

  - [ ] 7.2 Update poll creation and question routes for retro support
    - In `POST /api/polls`: pass `type` and `maxResponsesPerQuestion` to PollService
    - In `PATCH /api/polls/[id]`: reject type changes, allow maxResponsesPerQuestion updates
    - In `POST /api/polls/[id]/questions`: detect poll type, use `RetroCreateQuestionSchema` for retro polls
    - In `GET /api/polls/[id]/public` and token-based route: include `type` and `maxResponsesPerQuestion`
    - _Requirements: 1.1, 1.4, 1.8, 2.1, 2.2, 2.3, 10.3, 10.4_

  - [ ] 7.3 Update results route for retro aggregation
    - In `GET /api/polls/[id]/results`: pass poll type context to getResults
    - Ensure retro aggregation logic is triggered for retro polls
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 8. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Frontend: Poll creation components
  - [ ] 9.1 Create PollTypeSelector component
    - Create `components/admin/PollTypeSelector.tsx`
    - Render segmented control with "Pulse" and "Retro" options
    - Accept `value`, `onChange`, and `disabled` props
    - Disabled state for edit mode (type locked after creation)
    - _Requirements: 7.5, 10.3_

  - [ ] 9.2 Integrate PollTypeSelector into poll creation form
    - Add PollTypeSelector at the top of the new poll creation page
    - When "retro" selected: hide predefined options input, hide canvas editor, show category name input, show maxResponsesPerQuestion field (default 5)
    - When "pulse" selected: show existing options/canvas UI
    - Wire form submission to include `type` and `maxResponsesPerQuestion`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 10. Frontend: Retro participant form
  - [ ] 10.1 Create RetroParticipantForm component
    - Create `components/participant/RetroParticipantForm.tsx`
    - Render participant name input
    - For each category: heading, dynamic list of textarea inputs, "Add response" button, remove buttons
    - Disable "Add response" when at maxResponsesPerQuestion limit
    - Hide remove button when only 1 entry remains
    - Local state: `Record<questionId, string[]>` — entries per category, each starting with 1 empty entry
    - Submit all entries for all categories in a single request
    - Show "Voting is currently closed" banner when votingOpen is false
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ] 10.2 Integrate RetroParticipantForm into participant view
    - In the participant poll page, detect poll type from public poll data
    - Render `RetroParticipantForm` for retro polls, existing form for pulse polls
    - Wire submission to `POST /api/polls/[id]/respond` with retro payload format
    - _Requirements: 8.1, 8.5_

- [ ] 11. Frontend: Retro results display
  - [ ] 11.1 Create RetroResultsDisplay component
    - Create `components/results/RetroResultsDisplay.tsx`
    - HIDDEN: render "Results are hidden" message
    - COUNTS: render per-category entry count and participant count (no text)
    - DETAILS: render all text entries grouped by category with participant labels
    - Include "Copy all to clipboard" button (visible at DETAILS stage)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 9.1_

  - [ ] 11.2 Integrate RetroResultsDisplay into facilitator dashboard
    - Detect poll type in facilitator dashboard
    - Render `RetroResultsDisplay` for retro polls, existing results for pulse
    - Show "Total Entries" instead of "Submissions" in stats panel for retro
    - Display current participant count and total entry count
    - _Requirements: 6.3, 6.4, 6.5_

- [ ] 12. Clipboard export utility
  - [ ] 12.1 Implement retro clipboard export function
    - Create `lib/utils/retroExport.ts`
    - Implement `formatRetroResultsForClipboard(options: RetroExportOptions): string`
    - Format: category headings (## heading) followed by bulleted entries (• text — participant label)
    - Use anonymised labels when anonymisation is enabled
    - Wire "Copy all to clipboard" button in RetroResultsDisplay to this utility
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 12.2 Write property test for clipboard export (Property 19)
    - **Property 19: Clipboard export format correctness** — generate retro results, verify category headings + bulleted entries format, verify anonymised labels when enabled
    - **Validates: Requirements 9.2, 9.3**

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Integration tests
  - [ ]* 14.1 Write integration tests for retro poll flow
    - Test full flow: create retro poll → add questions → submit responses → fetch results
    - Test conditional unique index enforcement (duplicate responseIndex rejection)
    - Test backward compatibility: existing pulse poll flows unchanged
    - Test mixed poll listing (pulse and retro polls coexist)
    - Test facilitator state controls applied to retro polls
    - _Requirements: 1.1, 1.9, 3.7, 3.8, 3.9, 4.4, 4.5, 6.1, 6.2, 10.1, 10.2, 10.5_

- [ ] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Database migration uses `mcp_supabase_apply_migration` (not prisma migrate)
- The existing unique constraint on Response (pollId, questionId, sessionToken) is preserved for pulse polls
- The new conditional unique index only applies where responseIndex IS NOT NULL (retro responses)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.1"] },
    { "id": 3, "tasks": ["2.2", "3.2", "4.1"] },
    { "id": 4, "tasks": ["4.2", "6.1"] },
    { "id": 5, "tasks": ["6.2", "7.1", "7.2", "7.3"] },
    { "id": 6, "tasks": ["9.1", "10.1", "11.1", "12.1"] },
    { "id": 7, "tasks": ["9.2", "10.2", "11.2", "12.2"] },
    { "id": 8, "tasks": ["14.1"] }
  ]
}
```
