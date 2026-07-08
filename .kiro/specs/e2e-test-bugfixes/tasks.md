# Implementation Plan

## Overview

This task list addresses 5 bugs discovered during E2E testing (Bugs 1, 2, 4, 5, 6). The workflow follows the exploratory bugfix methodology: write tests to confirm bugs exist, write preservation tests to capture baseline behavior, implement fixes, then verify all tests pass.

## Tasks

- [x] 1. Write bug condition exploration tests
  - [x] 1.1 Write exploration tests for all 5 bugs and run on unfixed code
    - **Property 1: Bug Condition** - E2E Test Bugfixes (Bugs 1, 2, 4, 5, 6)
    - **IMPORTANT**: Write these property-based tests BEFORE implementing any fixes
    - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
    - **DO NOT attempt to fix the tests or the code when they fail**
    - **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
    - **GOAL**: Surface counterexamples that demonstrate each bug exists
    - **Scoped PBT Approach**: For each bug, scope the property to the concrete failing case(s) to ensure reproducibility
    - Test Bug 1: Render AuthForm in login mode, assert a Forgot password link exists and clicking it shows a reset email form (from Bug Condition: page == login AND userAction == forgot_password AND NOT passwordResetLinkExists())
    - Test Bug 2: Render EditPollPage, assert Save button DOM position is AFTER the Questions section and Canvas section (from Bug Condition: page == edit_poll AND saveButtonRendersBeforeQuestionsSection())
    - Test Bug 4: Call responseService.getResults() with testOnly=true (or current includeTest=true), assert result contains ONLY isTest=true responses (from Bug Condition: tab == test_responses AND responseFilter.includesRealResponses == true)
    - Test Bug 5: Call responseService.getResults() with revealStage=DETAILS and anonymise=false, assert OptionResult includes participants array for predefined option selections (from Bug Condition: revealStage == DETAILS AND anonymise == false AND responseType == predefined_option AND NOT participantNameShownForOption())
    - Test Bug 6: Call percentage calculation with custom responses present and a predefined option with 0 votes, assert that option shows exactly 0% (from Bug Condition: hasCustomResponses == true AND optionVoteCount == 0 AND displayedPercentage > 0)
    - Run tests on UNFIXED code
    - **EXPECTED OUTCOME**: All tests FAIL (this is correct - it proves the bugs exist)
    - Document counterexamples found for each bug to understand root causes
    - Mark task complete when tests are written, run, and failures are documented
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

- [x] 2. Write preservation property tests (BEFORE implementing fixes)
  - [x] 2.1 Write preservation tests and verify they pass on unfixed code
    - **Property 2: Preservation** - Existing Authentication, CRUD, Results, Anonymisation, and Percentage Behavior
    - **IMPORTANT**: Follow observation-first methodology
    - Observe existing behavior on UNFIXED code for non-bug-condition inputs
    - Observe: Login with valid credentials authenticates and redirects to admin dashboard
    - Observe: Registration with valid data creates account and shows success message
    - Observe: Edit Poll page persists title/description/image changes via PATCH API
    - Observe: Question CRUD operations work independently of Save button
    - Observe: Results tab (non-test) returns only isTest=false responses
    - Observe: Clearing test responses removes only test-flagged data
    - Observe: Anonymised mode uses generic labels for all responses
    - Observe: RevealStage COUNTS shows only aggregate counts/percentages
    - Observe: RevealStage HIDDEN shows Results are hidden message
    - Observe: Percentage calculation with all non-zero options uses largest-remainder correctly and sums to approximately 100%
    - Observe: Zero total responses shows 0% for all options
    - Write property-based tests capturing observed behavior patterns
    - Property: For all valid credential inputs, login produces successful authentication (preservation of auth flow)
    - Property: For all response sets where testOnly is not requested, Results tab returns only isTest=false entries
    - Property: For all response sets where anonymisation is enabled, no real participant names appear in output
    - Property: For all vote distributions where every option has count > 0, percentages sum to 99-101% via largest-remainder
    - Property: For all questions with zero total responses, all options show 0%
    - Verify all preservation tests PASS on UNFIXED code
    - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
    - Mark task complete when tests are written, run, and passing on unfixed code
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13_

- [x] 3. Fix Bug 1: Add Password Reset Flow
  - [x] 3.1 Add resetPassword method to useAuth hook
    - Add resetPassword(email: string) function to lib/hooks/useAuth.ts
    - Implementation: call supabase.auth.resetPasswordForEmail(email) and return success/error
    - Export the new method from the hook return value
    - _Requirements: 2.1, 2.2_
  - [x] 3.2 Add forgotPassword mode to AuthForm component
    - Extend mode state type to login or register or forgotPassword in components/auth/AuthForm.tsx
    - Add Forgot password? link below the login form (visible only in login mode)
    - Add reset form UI: email input + Send Reset Link button (visible in forgotPassword mode)
    - Add Back to Login link in forgotPassword mode
    - Handle submission: call resetPassword(email) from useAuth, display confirmation/error message
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

- [x] 4. Fix Bug 2: Reposition Save Button on Edit Poll Page
  - [x] 4.1 Add hideSubmitButton prop to PollForm component
    - Add optional hideSubmitButton boolean prop to components/admin/PollForm.tsx
    - Conditionally render the internal submit button based on this prop
    - When hideSubmitButton=true, suppress the button rendering
    - _Requirements: 2.3, 2.4, 3.3, 3.4, 3.5_
  - [x] 4.2 Restructure EditPollPage layout with Save button at bottom
    - In app/admin/polls/[id]/edit/page.tsx, pass hideSubmitButton={true} to PollForm
    - Add a standalone Save Changes button at the bottom of the page (after Canvas section)
    - Wire the new button to programmatically submit the PollForm (via form ref or shared submit handler)
    - Ensure section order: Poll metadata, Questions, Visual Canvas, Save button
    - _Requirements: 2.3, 2.4, 3.3, 3.4, 3.5_

- [x] 5. Fix Bug 4: Test Responses Tab Shows Only Test Data
  - [x] 5.1 Add testOnly option to responseService.getResults()
    - In lib/services/responseService.ts, add testOnly?: boolean to the ResultOptions interface
    - Update whereClause logic: when testOnly=true, set whereClause.isTest = true
    - Maintain existing behavior: when includeTest=false (default), set whereClause.isTest = false
    - _Requirements: 2.5, 2.6, 3.6, 3.7_
  - [x] 5.2 Update API route to accept testOnly query parameter
    - In app/api/polls/[id]/results/route.ts, parse testOnly from URL search params
    - Pass testOnly: true to responseService.getResults() when param is present
    - _Requirements: 2.5, 2.6, 3.6_
  - [x] 5.3 Update FacilitatorDashboard to use testOnly=true for Test Responses tab
    - In components/facilitator/FacilitatorDashboard.tsx, change fetchTestResults URL from ?includeTest=true to ?testOnly=true
    - Verify the Test Responses tab now displays only test responses
    - _Requirements: 2.5, 2.6, 3.6, 3.7_

- [x] 6. Fix Bug 5: Show Participant Names for All Response Types
  - [x] 6.1 Add participants field to OptionResult interface and populate in DETAILS mode
    - In lib/services/responseService.ts, extend OptionResult interface with participants?: string[]
    - In the results aggregation logic, when revealStage === DETAILS and anonymise === false, collect participant names for each predefined option selection
    - When anonymise === true and revealStage === DETAILS, use generic labels (Participant N) for option selections
    - _Requirements: 2.7, 2.8, 3.8, 3.9, 3.10_
  - [x] 6.2 Render participant names in ResultsDisplay component
    - In components/results/ResultsDisplay.tsx, when revealStage === DETAILS and option has participants array, render participant names below the option bar
    - Use the anonymise prop (currently aliased as _anonymise) to conditionally control display
    - Style participant names consistently with existing custom response name display
    - _Requirements: 2.7, 2.8, 3.8, 3.9, 3.10_

- [x] 7. Fix Bug 6: Zero-Vote Options Show 0% in Percentage Calculation
  - [x] 7.1 Filter zero-count options from largest-remainder distribution
    - In lib/services/responseService.ts, in the percentage calculation block, add .filter((d) => d.count > 0) before sorting by remainder for extra point distribution
    - Ensure options with count === 0 always retain percentage === 0 after the algorithm runs
    - Verify percentages still sum to approximately 100% for options with votes
    - _Requirements: 2.9, 2.10, 3.11, 3.12, 3.13_

- [x] 8. Verify bug condition exploration tests now pass
  - [x] 8.1 Re-run bug condition exploration tests after all fixes
    - **Property 1: Expected Behavior** - All 5 Bugs Fixed
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior for each bug
    - When these tests pass, it confirms the expected behavior is satisfied for all 5 bugs
    - Run bug condition exploration tests from step 1
    - **EXPECTED OUTCOME**: All tests PASS (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_
  - [x] 8.2 Verify preservation tests still pass after all fixes
    - **Property 2: Preservation** - No Regressions Introduced
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fixes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13_

- [x] 9. Checkpoint - Ensure all tests pass
  - Run full test suite: npm test or npx vitest --run
  - Ensure all unit tests pass (existing + new)
  - Ensure all property-based tests pass (exploration + preservation)
  - Verify no TypeScript compilation errors: npx tsc --noEmit
  - Verify no lint errors: npm run lint
  - Ask the user if questions arise or if manual E2E verification is needed
