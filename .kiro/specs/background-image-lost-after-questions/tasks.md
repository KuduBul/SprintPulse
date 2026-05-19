# Implementation Plan

## Overview

Fix the bug where background images selected during poll creation are silently discarded. The `handleSubmit` function in `app/admin/polls/new/page.tsx` must capture the created poll ID and upload the image file to `/api/polls/[id]/upload` before redirecting.

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Image Upload Never Called on Poll Creation
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — `handleSubmit` called with a non-null `imageFile` (valid JPEG/PNG/WebP ≤5MB)
  - Create test file at `tests/property/backgroundImageCreation.property.test.ts`
  - Mock `useApi` hook's `post` to return a successful poll creation response with `{ id: '<uuid>' }`
  - Mock global `fetch` to track calls to `/api/polls/<id>/upload`
  - Mock `useRouter` to track `router.push` calls
  - Property: for all valid image files (generated via fast-check arbitrary for File-like objects with random name, type in [image/jpeg, image/png, image/webp], size ≤5MB), when `handleSubmit` is called with `{ title, description, imageFile, teamId }` where `imageFile` is non-null, assert that `fetch` is called with URL matching `/api/polls/<createdId>/upload` and body is FormData containing the file
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists because `handleSubmit` never calls the upload endpoint)
  - Document counterexamples found: e.g., "handleSubmit({title: 'X', imageFile: File(png, 1KB)}) completes without any fetch call to /upload"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 2.1, 2.2_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - No-Image Creation and Question Operations Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Create test file at `tests/property/backgroundImagePreservation.property.test.ts`
  - **Observation Phase**: Run unfixed code with non-buggy inputs and record behavior:
    - Observe: `handleSubmit({ title: 'Test', description: 'Desc', imageFile: null, teamId: 'team-1' })` creates poll via `POST /api/polls` and redirects to `/admin` without calling `/upload`
    - Observe: Question CRUD operations (`POST/PATCH/DELETE /api/polls/[id]/questions`) do not modify `backgroundImageUrl` on the poll record
  - **Property 2a - No-Image Creation**: For all `PollFormData` where `imageFile` is null, `handleSubmit` SHALL only call `POST /api/polls` (no upload call) and redirect to `/admin`
    - Generate random titles (non-empty strings), optional descriptions, optional teamIds via fast-check
    - Assert: no fetch call to any `/upload` endpoint
    - Assert: `router.push('/admin')` is called
  - **Property 2b - Question Operations Don't Affect Image**: For any poll with a non-null `backgroundImageUrl`, performing question CRUD operations SHALL leave `backgroundImageUrl` unchanged
    - Mock the questions API route handler or simulate the PATCH logic
    - Generate random question payloads (title, type, position) via fast-check
    - Assert: poll's `backgroundImageUrl` field is never included in the question operation's database update
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.4, 3.5_

- [ ] 3. Fix for background image lost during poll creation

  - [ ] 3.1 Implement the fix in `app/admin/polls/new/page.tsx`
    - Capture the created poll's ID from the `post` response: `const createdPoll = result.data`
    - After successful poll creation, check if `data.imageFile` is non-null
    - If image file present: create a `FormData`, append the file, POST to `/api/polls/${createdPoll.id}/upload`
    - Handle upload error gracefully: if upload fails, redirect to `/admin/polls/${createdPoll.id}/edit` so user can retry
    - Move `router.push('/admin')` to after the upload step completes (or after confirming no image needs uploading)
    - _Bug_Condition: isBugCondition(input) where input.imageFile IS NOT NULL AND context IS "new poll creation"_
    - _Expected_Behavior: Upload image to `/api/polls/[id]/upload` and poll record has non-null backgroundImageUrl before redirect_
    - _Preservation: No-image creation continues to work identically — poll created with null backgroundImageUrl, redirect to /admin_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1_

  - [ ] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Image Upload Called on Poll Creation
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (upload endpoint is called with the image file)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1: `npx vitest run tests/property/backgroundImageCreation.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — image upload now happens during creation)
    - _Requirements: 2.1, 2.2_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - No-Image Creation and Question Operations Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2: `npx vitest run tests/property/backgroundImagePreservation.property.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — no-image creation unchanged, question operations don't affect image)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npx vitest run`
  - Ensure all property tests pass (both bug condition and preservation)
  - Ensure existing unit tests still pass (no regressions in other features)
  - Ensure build succeeds: `npm run build`
  - Ask the user if questions arise


## Task Dependency Graph

```json
{
  "waves": [
    ["1", "2"],
    ["3.1"],
    ["3.2", "3.3"],
    ["4"]
  ]
}
```

## Notes

- The project uses Vitest + fast-check for property-based testing
- Existing property tests are in `tests/property/` directory
- The edit page already implements the correct upload pattern — reference `app/admin/polls/[id]/edit/page.tsx` for the working implementation
- The upload endpoint at `/api/polls/[id]/upload` already exists and works correctly
- Tests mock `useApi`, `useRouter`, and global `fetch` to isolate the `handleSubmit` logic
