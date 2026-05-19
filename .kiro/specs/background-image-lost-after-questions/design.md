# Background Image Lost After Questions — Bugfix Design

## Overview

The poll creation page (`app/admin/polls/new/page.tsx`) discards the background image file selected by the facilitator. It sends only `title`, `description`, and `teamId` to `POST /api/polls`, then immediately redirects to `/admin` without uploading the image. The edit page already handles uploads correctly via a separate `POST /api/polls/[id]/upload` endpoint. The fix adds the same upload step to the creation flow — after the poll is created and an ID is available, upload the image file before redirecting.

## Glossary

- **Bug_Condition (C)**: A facilitator creates a new poll with a background image file selected in the form
- **Property (P)**: The image file is uploaded to storage and the poll's `backgroundImageUrl` is set before the redirect completes
- **Preservation**: Existing behavior for polls created without images, the edit page upload flow, question CRUD operations, and canvas rendering must remain unchanged
- **PollFormData**: The interface exported by `components/admin/PollForm.tsx` containing `{ title, description, imageFile, teamId }`
- **handleSubmit**: The function in `app/admin/polls/new/page.tsx` that processes form submission
- **uploadPollBackground**: The storage utility that uploads a file buffer to Supabase Storage and returns a public URL

## Bug Details

### Bug Condition

The bug manifests when a facilitator selects a background image file in the poll creation form and submits. The `handleSubmit` function in `app/admin/polls/new/page.tsx` receives `PollFormData` with a non-null `imageFile` but never uses it — the image is silently discarded and the poll is created without a `backgroundImageUrl`.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type PollFormData (from poll creation form submission)
  OUTPUT: boolean
  
  RETURN input.imageFile IS NOT NULL
         AND input.imageFile IS a valid File (JPEG, PNG, or WebP, ≤5MB)
         AND context IS "new poll creation" (not edit)
END FUNCTION
```

### Examples

- Facilitator selects a 2MB PNG background, fills in title "Sprint Retro", selects a team, clicks "Create Poll" → **Expected**: Poll created with backgroundImageUrl pointing to uploaded PNG. **Actual**: Poll created with `backgroundImageUrl = null`, image lost permanently.
- Facilitator selects a 4MB JPEG background, creates poll → **Expected**: Image uploaded, URL persisted. **Actual**: Image discarded, redirect happens immediately.
- Facilitator selects a WebP image, creates poll, later opens edit page → **Expected**: Background image visible in canvas editor. **Actual**: No background image shown because it was never uploaded.
- Facilitator creates a poll without selecting any image → **Expected**: Poll created with `backgroundImageUrl = null`. **Actual**: Same (correct behavior, not a bug).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Creating a poll without a background image must continue to work — poll is created with `backgroundImageUrl = null`
- The edit page's image upload flow (via `handlePollSubmit`) must remain unchanged
- Question CRUD operations (`POST/PATCH/DELETE /api/polls/[id]/questions`) must not affect `backgroundImageUrl`
- The `PATCH /api/polls/[id]` endpoint's conditional update logic must remain unchanged — it only updates fields explicitly provided
- The canvas editor must continue to display the `backgroundImageUrl` from the poll record
- Mouse/keyboard interactions with the poll form must continue to work

**Scope:**
All inputs that do NOT involve creating a new poll with a selected image file should be completely unaffected by this fix. This includes:
- Poll creation without an image
- Poll editing (already works correctly)
- Question management (add, edit, delete, reposition)
- Poll facilitation and response collection
- Poll deletion and cloning

## Hypothesized Root Cause

Based on code analysis, the root cause is confirmed (not hypothesized):

1. **Missing upload step in creation flow**: The `handleSubmit` function in `app/admin/polls/new/page.tsx` destructures `PollFormData` but only uses `title`, `description`, and `teamId`. The `imageFile` field is completely ignored. The edit page's `handlePollSubmit` shows the correct pattern — check for `data.imageFile`, create a `FormData`, POST to `/api/polls/[id]/upload`.

2. **Immediate redirect after creation**: After `POST /api/polls` returns, the code calls `router.push('/admin')` immediately. There is no opportunity to perform the upload because the poll ID from the response is never captured.

3. **No secondary bug in question editing**: The questions API endpoints only operate on the `questions` table and never touch the `polls` table's `backgroundImageUrl` column. The `PATCH /api/polls/[id]` endpoint uses conditional spreads (`data.backgroundImageUrl !== undefined`) so it only updates `backgroundImageUrl` when explicitly provided. The question-editing workflow is safe.

## Correctness Properties

Property 1: Bug Condition - Image Upload on Poll Creation

_For any_ poll creation where the facilitator selects a valid background image file (isBugCondition returns true), the fixed `handleSubmit` function SHALL upload the image to `/api/polls/[id]/upload` and the resulting poll record SHALL have a non-null `backgroundImageUrl` before the redirect occurs.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - No-Image Creation Unchanged

_For any_ poll creation where no image file is selected (isBugCondition returns false), the fixed code SHALL produce the same result as the original code — the poll is created with `backgroundImageUrl = null` and the redirect occurs normally.

**Validates: Requirements 3.1**

Property 3: Preservation - Edit Page Upload Unchanged

_For any_ poll edit where the facilitator uploads a new background image via the edit form, the fixed code SHALL not alter the existing edit page upload behavior — the image is uploaded and `backgroundImageUrl` is updated as before.

**Validates: Requirements 3.2, 3.3**

Property 4: Preservation - Question Operations Don't Affect Image

_For any_ question CRUD operation (create, update, delete, reposition) on a poll that has a `backgroundImageUrl`, the operation SHALL leave the poll's `backgroundImageUrl` unchanged in the database.

**Validates: Requirements 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `app/admin/polls/new/page.tsx`

**Function**: `handleSubmit`

**Specific Changes**:

1. **Capture the created poll's ID from the response**: The `post` call returns the created poll object (including `id`). Store this in a variable instead of discarding it.

2. **Upload image if present**: After successful poll creation, check if `data.imageFile` is non-null. If so, create a `FormData` with the file and POST it to `/api/polls/[id]/upload` (same pattern used in the edit page).

3. **Handle upload errors gracefully**: If the image upload fails after poll creation, the poll still exists. Show an error message or redirect to the edit page so the user can retry the upload, rather than silently losing the image.

4. **Redirect after upload completes**: Move `router.push('/admin')` to after the upload step completes (or after confirming no image needs uploading).

5. **Redirect to edit page instead of admin** (optional improvement): After creation, redirect to `/admin/polls/[id]/edit` so the facilitator can immediately add questions. This is a UX improvement but not strictly required for the bug fix.

### Pseudocode for Fixed handleSubmit

```typescript
async function handleSubmit(data: PollFormData) {
  // Step 1: Create the poll
  const result = await post('/api/polls', {
    title: data.title,
    description: data.description || undefined,
    teamId: data.teamId,
  });

  if (result.error) {
    throw new Error(result.error.message || 'Failed to create poll.');
  }

  const createdPoll = result.data; // { id, title, ... }

  // Step 2: Upload image if one was selected
  if (data.imageFile && createdPoll?.id) {
    const formData = new FormData();
    formData.append('file', data.imageFile);

    const uploadRes = await fetch(`/api/polls/${createdPoll.id}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) {
      // Poll was created but image upload failed
      // Redirect to edit page so user can retry
      router.push(`/admin/polls/${createdPoll.id}/edit`);
      return;
    }
  }

  // Step 3: Redirect
  router.push('/admin');
}
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause analysis by observing that `imageFile` is never used in the creation flow.

**Test Plan**: Write tests that mock the `useApi` hook and verify what happens when `handleSubmit` is called with a non-null `imageFile`. Run these tests on the UNFIXED code to observe that no upload request is made.

**Test Cases**:
1. **Image File Present Test**: Submit form with a valid image file → assert that `/api/polls/[id]/upload` is called (will fail on unfixed code)
2. **Poll Created With Image URL Test**: Submit form with image → assert the poll record has a non-null `backgroundImageUrl` after creation completes (will fail on unfixed code)
3. **Redirect Timing Test**: Submit form with image → assert redirect happens AFTER upload completes, not before (will fail on unfixed code)

**Expected Counterexamples**:
- No fetch call to `/api/polls/[id]/upload` is ever made during poll creation
- The `imageFile` field from `PollFormData` is received but never referenced in the submit handler
- Root cause confirmed: missing upload step, not a timing or selector issue

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleSubmit_fixed(input)
  ASSERT uploadEndpointCalled(input.imageFile, createdPollId)
  ASSERT poll.backgroundImageUrl IS NOT NULL
  ASSERT redirectOccursAfterUpload()
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleSubmit_original(input) = handleSubmit_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of poll form data (with/without images, various titles/descriptions)
- It catches edge cases like empty strings, boundary-length titles, and null team IDs
- It provides strong guarantees that non-image creation paths are unchanged

**Test Plan**: Observe behavior on UNFIXED code first for no-image poll creation, then write property-based tests capturing that behavior.

**Test Cases**:
1. **No-Image Creation Preservation**: Verify creating a poll without an image still works identically — only `POST /api/polls` is called, redirect to `/admin` occurs
2. **Edit Page Upload Preservation**: Verify the edit page's `handlePollSubmit` continues to upload images correctly
3. **Question CRUD Preservation**: Verify adding/editing/deleting questions does not modify `backgroundImageUrl`
4. **PATCH Endpoint Preservation**: Verify that PATCH requests without `backgroundImageUrl` in the body do not clear the existing value

### Unit Tests

- Test that `handleSubmit` calls `/api/polls/[id]/upload` when `imageFile` is non-null
- Test that `handleSubmit` does NOT call upload endpoint when `imageFile` is null
- Test that `handleSubmit` captures the poll ID from the creation response
- Test error handling when upload fails (redirect to edit page)
- Test that redirect occurs only after upload completes

### Property-Based Tests

- Generate random `PollFormData` with `imageFile = null` and verify no upload call is made and redirect behavior matches original
- Generate random valid image files (varying size, type) and verify upload is always attempted on creation
- Generate random question operations on polls with `backgroundImageUrl` set and verify the URL is never modified

### Integration Tests

- End-to-end test: Create poll with image → verify image appears in edit page canvas
- End-to-end test: Create poll with image → add questions → verify background image persists
- End-to-end test: Create poll without image → verify no upload errors occur
- End-to-end test: Create poll with image, upload fails → verify redirect to edit page for retry
