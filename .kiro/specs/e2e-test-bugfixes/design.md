# E2E Test Bugfixes Design

## Overview

This design addresses 5 bugs discovered during end-to-end testing of the SprintPulse application. The bugs span authentication UX (missing password reset flow), page layout (Save button positioning on Edit Poll page), data filtering (Test Responses tab showing all responses instead of only test responses), name visibility (participant names only shown for custom responses, not predefined option selections), and percentage calculation (showing 1% instead of 0% for options with zero votes when custom responses exist). The fix strategy is minimal and targeted: each bug is addressed in isolation to avoid regressions.

## Glossary

- **Bug_Condition (C)**: The set of conditions that trigger each specific bug — varies per bug (see Bug Details)
- **Property (P)**: The desired correct behavior when the bug condition holds — varies per bug (see Correctness Properties)
- **Preservation**: Existing behaviors that must remain unchanged after each fix is applied
- **AuthForm**: The component in `components/auth/AuthForm.tsx` that handles login/register UI
- **useAuth**: The hook in `lib/hooks/useAuth.ts` that wraps Supabase Auth methods (signIn, signUp, signOut)
- **PollForm**: The component in `components/admin/PollForm.tsx` that renders poll metadata fields and the Save button
- **EditPollPage**: The page in `app/admin/polls/[id]/edit/page.tsx` that composes PollForm, Questions, and Canvas sections
- **FacilitatorDashboard**: The component in `components/facilitator/FacilitatorDashboard.tsx` that manages session controls and results tabs
- **ResultsDisplay**: The component in `components/results/ResultsDisplay.tsx` that renders aggregated poll results
- **responseService.getResults()**: The function in `lib/services/responseService.ts` that aggregates responses with filtering, percentage calculation, and participant labeling
- **RevealStage**: Enum controlling result visibility: `HIDDEN` | `COUNTS` | `DETAILS`
- **Largest-Remainder Method**: Percentage rounding algorithm that floors percentages then distributes remaining points to options with largest fractional remainders

## Bug Details

### Bug Condition

The 5 bugs manifest under distinct conditions:

**Bug 1** manifests when a facilitator has forgotten their password and visits the login page — no password reset mechanism exists.

**Bug 2** manifests when a facilitator visits the Edit Poll page — the Save button renders inside PollForm at the top, before Questions and Canvas sections.

**Bug 4** manifests when the facilitator views the "Test Responses" tab — the API call uses `includeTest=true` which returns ALL responses (test + real) rather than filtering to test-only.

**Bug 5** manifests when the facilitator has `anonymise=false` and `revealStage='DETAILS'` — participant names are only shown for custom/free-text responses, not for predefined option selections.

**Bug 6** manifests when custom responses exist but no participants selected a specific predefined option — the largest-remainder method distributes extra percentage points to zero-vote options, showing 1% instead of 0%.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { bugId: number, context: AppContext }
  OUTPUT: boolean

  SWITCH input.bugId:
    CASE 1:
      RETURN input.context.page == 'login'
             AND input.context.userAction == 'forgot_password'
             AND NOT passwordResetLinkExists()
    CASE 2:
      RETURN input.context.page == 'edit_poll'
             AND saveButtonRendersBeforeQuestionsSection()
    CASE 4:
      RETURN input.context.tab == 'test_responses'
             AND apiCall.includeTest == true
             AND responseFilter.includesRealResponses == true
    CASE 5:
      RETURN input.context.revealStage == 'DETAILS'
             AND input.context.anonymise == false
             AND input.context.responseType == 'predefined_option'
             AND NOT participantNameShownForOption()
    CASE 6:
      RETURN input.context.hasCustomResponses == true
             AND input.context.optionVoteCount == 0
             AND displayedPercentage > 0
END FUNCTION
```

### Examples

- **Bug 1**: Facilitator visits `/admin`, sees login form, cannot find any "Forgot password?" link or reset mechanism. Must contact support or create new account.
- **Bug 2**: Facilitator navigates to Edit Poll page. The "Save Changes" button appears immediately after the title/description/image fields, before the Questions list and Visual Canvas Editor. Natural workflow is disrupted.
- **Bug 4**: Poll has 3 real responses and 2 test responses. "Results" tab shows 3 responses (correct). "Test Responses" tab shows 5 responses (incorrect — should show only 2 test responses).
- **Bug 5**: Facilitator sets Names Visible + DETAILS reveal. Custom response shows "John: Great sprint!" but predefined option "Agree" shows "3 (60%)" with no indication of which participants selected it.
- **Bug 6**: Question has 5 total responses: 3 selected "Option A", 2 submitted custom text. "Option B" has 0 votes but displays "1%" because the largest-remainder method gives it an extra point (0/5 = 0%, but remainder distribution doesn't exclude zero-vote options).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Login form continues to authenticate with valid credentials and redirect to admin dashboard
- Registration form continues to create accounts and show success message
- Edit Poll page continues to persist title/description/image changes via PATCH API
- Question CRUD operations continue to work independently of the Save button
- "Results" tab continues to show only real responses (isTest=false)
- Clearing test responses continues to remove only test-flagged data
- When anonymisation is enabled, participant names continue to be hidden (generic labels used)
- When revealStage is "COUNTS", only aggregate counts/percentages are shown (no participant detail)
- When revealStage is "HIDDEN", the "Results are hidden" message continues to display
- Percentage calculation continues to use largest-remainder method for options with votes
- Percentages continue to sum to approximately 100% (99-101%)
- Zero total responses continues to show 0% for all options

**Scope:**
All inputs that do NOT match the specific bug conditions should be completely unaffected by these fixes. This includes:
- All non-password-reset authentication flows (login, register, sign-out)
- Edit Poll page functionality other than section ordering
- Results tab data fetching and display
- Anonymised results display
- Percentage calculations when no custom responses exist or all options have votes

## Hypothesized Root Cause

Based on the bug descriptions and code analysis, the most likely issues are:

### Bug 1: No Password Reset

1. **Missing Feature**: The `AuthForm` component only implements `login` and `register` modes. No `forgotPassword` mode or link exists.
2. **Missing Hook Method**: The `useAuth` hook exposes `signIn`, `signUp`, and `signOut` but does not expose `supabase.auth.resetPasswordForEmail()`.
3. **No UI Element**: There is no "Forgot password?" link rendered in the login form.

### Bug 2: Save Button Positioning

1. **Component Composition Order**: In `EditPollPage`, the `<PollForm>` component (which contains the Submit button internally) is rendered first, followed by the Questions section and Canvas section.
2. **Submit Button Inside PollForm**: The `PollForm` component renders its own submit button at the bottom of its form. Since PollForm is the first section in the page layout, the button appears above Questions and Canvas.
3. **No Layout Restructuring**: The page uses a simple top-to-bottom flex layout without repositioning the save action to the end of the workflow.

### Bug 4: Test Responses Tab Shows All Data

1. **Incorrect API Filter Logic**: The `responseService.getResults()` method's `whereClause` only adds `isTest: false` when `includeTest` is false. When `includeTest=true`, no `isTest` filter is applied, returning ALL responses (both test and real).
2. **Semantic Mismatch**: The parameter name `includeTest` suggests "include test responses in addition to real ones" but the Test Responses tab needs "show ONLY test responses". The API lacks a `testOnly` filter mode.
3. **Dashboard Fetch Logic**: `FacilitatorDashboard.fetchTestResults()` calls `/api/polls/${pollId}/results?includeTest=true` which returns all responses rather than test-only.

### Bug 5: Names Only for Custom Responses

1. **Data Model Gap**: The `responseService.getResults()` method only collects participant names in the `customResponses` array (for entries with `customText`). It does not build a per-option participant list for predefined selections.
2. **Missing Data Structure**: The `OptionResult` interface only has `label`, `count`, and `percentage` — no `participants` field exists.
3. **ResultsDisplay Limitation**: The `ResultsDisplay` component only renders participant labels in the custom responses section, with no UI for showing who selected each predefined option.

### Bug 6: Percentage Shows 1% for Zero-Vote Options

1. **Unconditional Remainder Distribution**: In `responseService.getResults()`, the largest-remainder algorithm sorts ALL options by remainder and distributes extra points without checking if the option has any votes.
2. **Custom Responses Inflate Total**: When custom responses exist, `totalResponses` includes them (since they're counted per-question), but predefined options with 0 selections still get a non-zero remainder (0/N = 0.0, floored to 0, remainder 0.0). However, when the total floored sum is less than 100, points are distributed to options sorted by remainder — and with floating point, even 0-count options can receive a point if other options' remainders are also 0.
3. **Root Issue**: The algorithm should skip options with `count === 0` when distributing remainder points, since an option with zero votes should never display a non-zero percentage.

## Correctness Properties

Property 1: Bug Condition - Password Reset Flow Available

_For any_ authenticated page state where the user is on the login form and has not yet authenticated, the AuthForm component SHALL render a "Forgot password?" link that, when clicked, presents an email input and triggers `supabase.auth.resetPasswordForEmail()` with the entered email, displaying a confirmation message upon success.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - Edit Poll Page Section Order

_For any_ Edit Poll page render where questions exist, the page SHALL render sections in this order: poll metadata fields (title, description, image, team), questions section, visual canvas editor, and then the Save/submit action at the bottom of the workflow.

**Validates: Requirements 2.3, 2.4**

Property 3: Bug Condition - Test Responses Tab Shows Only Test Data

_For any_ request to the Test Responses tab where both real and test responses exist, the system SHALL display ONLY responses where `isTest=true`, with a count and participant total reflecting only test submissions.

**Validates: Requirements 2.5, 2.6**

Property 4: Bug Condition - Names Visible Shows All Participant Names

_For any_ results display where `revealStage='DETAILS'` and `anonymise=false`, the system SHALL show participant names for ALL response types including which participants selected each predefined option, not just custom/free-text responses.

**Validates: Requirements 2.7, 2.8**

Property 5: Bug Condition - Zero-Vote Options Show 0%

_For any_ percentage calculation where a predefined option has zero votes (count === 0), the system SHALL display exactly 0% for that option regardless of whether custom responses exist or how the largest-remainder distribution operates.

**Validates: Requirements 2.9, 2.10**

Property 6: Preservation - Existing Authentication Flows

_For any_ login or registration attempt with valid credentials where the bug condition does NOT hold (user is not requesting password reset), the system SHALL produce the same authentication behavior as before, preserving successful login redirects and registration success messages.

**Validates: Requirements 3.1, 3.2**

Property 7: Preservation - Edit Poll CRUD Operations

_For any_ poll editing operation (title change, description change, image upload, question CRUD) that does NOT involve page section ordering, the system SHALL produce the same persistence behavior as the original code, preserving all data operations.

**Validates: Requirements 3.3, 3.4, 3.5**

Property 8: Preservation - Results Tab Real Responses

_For any_ request to the "Results" tab (not the Test Responses tab), the system SHALL continue to display only real responses where `isTest=false`, preserving the existing filtering behavior.

**Validates: Requirements 3.6, 3.7**

Property 9: Preservation - Anonymisation and Reveal Stage Behavior

_For any_ results display where anonymisation is enabled OR revealStage is not 'DETAILS', the system SHALL produce the same display behavior as the original code, preserving hidden results messages, aggregate-only counts, and generic participant labels.

**Validates: Requirements 3.8, 3.9, 3.10**

Property 10: Preservation - Percentage Calculation for Non-Zero Options

_For any_ percentage calculation where all predefined options have at least one vote (no zero-count options), the system SHALL produce the same percentage values as the original largest-remainder algorithm, preserving accurate percentage totals that sum to approximately 100%.

**Validates: Requirements 3.11, 3.12, 3.13**

## Fix Implementation

### Changes Required

#### Bug 1: Password Reset — `components/auth/AuthForm.tsx` + `lib/hooks/useAuth.ts`

**File**: `lib/hooks/useAuth.ts`

**Changes**:
1. **Add resetPassword method**: Expose a `resetPassword` callback that calls `supabase.auth.resetPasswordForEmail(email)`.

**File**: `components/auth/AuthForm.tsx`

**Changes**:
1. **Add 'forgotPassword' mode**: Extend the mode state to `'login' | 'register' | 'forgotPassword'`.
2. **Add "Forgot password?" link**: Render a clickable link below the login form (visible only in login mode) that switches to forgotPassword mode.
3. **Add reset form UI**: When in forgotPassword mode, show an email input and "Send Reset Link" button.
4. **Handle reset submission**: Call the new `resetPassword(email)` method from useAuth and display a success/error message.
5. **Add "Back to Login" link**: Allow users to return to login mode from the reset form.

#### Bug 2: Edit Poll Page Layout — `app/admin/polls/[id]/edit/page.tsx` + `components/admin/PollForm.tsx`

**File**: `app/admin/polls/[id]/edit/page.tsx`

**Changes**:
1. **Restructure section order**: Move the PollForm (poll metadata) to render only the fields, with the save action repositioned after Questions and Canvas sections.
2. **Option A — Extract save button**: Pass a prop to PollForm to suppress its internal submit button, and render a separate save button at the bottom of the page after all sections.
3. **Option B — Reorder sections**: Keep PollForm as-is but move it to render after Questions and Canvas (less ideal for UX since metadata should be at top).

**Recommended approach (Option A)**:
- Add an optional `hideSubmitButton` prop to PollForm
- Render PollForm with `hideSubmitButton={true}` at the top for metadata editing
- Render a standalone "Save Changes" button at the bottom of the page (after Canvas) that programmatically submits the PollForm via a ref or shared state

**Alternative approach**: Wrap the entire page in a single form element, place metadata fields at top, questions/canvas in middle, and submit button at bottom.

#### Bug 4: Test Responses Tab — `lib/services/responseService.ts` + `app/api/polls/[id]/results/route.ts`

**File**: `lib/services/responseService.ts`

**Changes**:
1. **Add `testOnly` option to ResultOptions**: Add a new boolean field `testOnly` (or rename/extend `includeTest` semantics).
2. **Update whereClause logic**: When `testOnly=true`, set `whereClause.isTest = true` to return ONLY test responses. When `includeTest=false` (default), set `whereClause.isTest = false` for real-only.

**File**: `app/api/polls/[id]/results/route.ts`

**Changes**:
1. **Parse `testOnly` query param**: Read `testOnly=true` from URL params.
2. **Pass to service**: Call `responseService.getResults()` with `{ testOnly: true }` when the test tab requests data.

**File**: `components/facilitator/FacilitatorDashboard.tsx`

**Changes**:
1. **Update fetchTestResults URL**: Change from `?includeTest=true` to `?testOnly=true` (or equivalent new param).

#### Bug 5: Names Visible for All Responses — `lib/services/responseService.ts` + `components/results/ResultsDisplay.tsx`

**File**: `lib/services/responseService.ts`

**Changes**:
1. **Add `participants` field to OptionResult**: Extend the interface to include `participants?: string[]` for per-option participant names.
2. **Populate participants in DETAILS mode**: When `revealStage === 'DETAILS'` and `anonymise === false`, collect participant names for each predefined option selection and include them in the option result.
3. **Handle anonymised case**: When `anonymise === true` and `revealStage === 'DETAILS'`, use generic labels ("Participant N") for option selections too.

**File**: `components/results/ResultsDisplay.tsx`

**Changes**:
1. **Render participant names under options**: When `revealStage === 'DETAILS'` and option has `participants` array, render the list of names below the option bar.
2. **Accept anonymise prop**: Use the `anonymise` prop (currently unused, aliased as `_anonymise`) to conditionally show participant details.

#### Bug 6: Percentage Calculation — `lib/services/responseService.ts`

**File**: `lib/services/responseService.ts`

**Changes**:
1. **Filter zero-count options from remainder distribution**: In the largest-remainder algorithm, only include options with `count > 0` in the sorted remainder list for extra point distribution.
2. **Ensure zero-vote options always get 0%**: After the algorithm runs, any option with `count === 0` must have `percentage === 0`.

**Specific code change** in the percentage calculation block:
```typescript
// Only distribute remainder points to options that have at least one vote
const sorted = [...rawData]
  .filter((d) => d.count > 0)  // <-- ADD THIS LINE
  .sort((a, b) => b.remainder - a.remainder);
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write tests that exercise each bug condition on the current (unfixed) code to observe failures and validate our root cause hypotheses.

**Test Cases**:
1. **Bug 1 — No Reset Link**: Render AuthForm, assert no "Forgot password?" element exists (will confirm bug on unfixed code)
2. **Bug 2 — Section Order**: Render EditPollPage, assert Save button DOM position is before Questions section (will confirm bug on unfixed code)
3. **Bug 4 — Test Tab Data**: Call `getResults()` with `includeTest=true` when both real and test responses exist, assert result includes real responses (will confirm bug on unfixed code)
4. **Bug 5 — Missing Names**: Call `getResults()` with `revealStage='DETAILS'`, `anonymise=false`, assert OptionResult has no participant names (will confirm bug on unfixed code)
5. **Bug 6 — 1% for Zero Votes**: Call percentage calculation with custom responses and a zero-vote option, assert percentage > 0 (will confirm bug on unfixed code)

**Expected Counterexamples**:
- Bug 4: `getResults(pollId, { includeTest: true, ... })` returns responses where `isTest=false` mixed with `isTest=true`
- Bug 6: Option with 0 votes shows percentage of 1 when custom responses inflate totalResponses

### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Per-bug fix verification:**
- Bug 1: AuthForm renders "Forgot password?" link; clicking it shows email form; submitting calls resetPasswordForEmail
- Bug 2: Save button renders after Canvas section in DOM order
- Bug 4: Test tab API returns only `isTest=true` responses; count matches test-only submissions
- Bug 5: OptionResult includes participant names when DETAILS + non-anonymised
- Bug 6: Zero-vote options always show 0% regardless of custom response count

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-bug inputs, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Login Preservation**: Verify login with valid credentials continues to authenticate successfully
2. **Registration Preservation**: Verify registration continues to create accounts
3. **Results Tab Preservation**: Verify Results tab continues to show only real responses
4. **Anonymisation Preservation**: Verify anonymised mode continues to use generic labels
5. **Percentage Preservation (non-zero options)**: Verify options with votes continue to get correct percentages via largest-remainder
6. **Question CRUD Preservation**: Verify question add/edit/delete continues to work on Edit Poll page

### Unit Tests

- Test AuthForm renders "Forgot password?" link in login mode only
- Test AuthForm forgotPassword mode shows email input and submit button
- Test AuthForm resetPassword calls supabase.auth.resetPasswordForEmail
- Test EditPollPage section order (Save button after Canvas)
- Test responseService.getResults with testOnly=true returns only test responses
- Test responseService.getResults with testOnly=true and no test responses returns empty
- Test responseService.getResults includes participant names per option in DETAILS mode
- Test responseService.getResults percentage calculation: zero-vote options always 0%
- Test percentage calculation with various combinations of custom + predefined responses

### Property-Based Tests

- Generate random response sets (mix of test/real) and verify testOnly filter returns correct subset
- Generate random vote distributions with zero-count options and verify zero-count options always show 0%
- Generate random vote distributions with all non-zero counts and verify percentages sum to 100% (preservation)
- Generate random participant names and verify DETAILS+non-anonymised mode includes all names for all response types
- Generate random response sets and verify Results tab (non-test) always excludes test responses (preservation)

### Integration Tests

- Test full password reset flow: click link → enter email → see confirmation message
- Test Edit Poll page end-to-end: edit metadata → add questions → position on canvas → save (button at bottom)
- Test Facilitator Dashboard: submit test responses → verify Test Responses tab shows only those → clear → verify empty
- Test Facilitator Dashboard: submit real + test responses → verify Results tab excludes test data
- Test full results flow: submit responses → enable DETAILS + Names Visible → verify all participant names shown
- Test percentage display: submit mix of custom + predefined responses → verify 0% for unselected options
