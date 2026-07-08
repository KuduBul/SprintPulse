# Bugfix Requirements Document

## Introduction

This document captures 5 bugs discovered during end-to-end testing of the SprintPulse application (issue #3 was already fixed by a collaborator). The bugs span authentication UX (no password reset), page layout (Save button positioning), data filtering (Results vs Test Responses tabs showing same data), name visibility (only showing names for custom responses), and percentage calculation (showing 1% instead of 0% for unselected options). Each bug is documented with its current defective behavior, expected correct behavior, and behaviors that must remain unchanged after the fix.

## Bug Analysis

### Current Behavior (Defect)

**Bug 1: No Password Reset on Login Page**

1.1 WHEN a facilitator forgets their password and visits the admin login page THEN the system provides no mechanism to initiate a password reset flow

1.2 WHEN a facilitator cannot remember their credentials THEN the system only offers login and register options, forcing them to contact support or create a new account

**Bug 2: Edit Poll Page Layout — Save Button Above Questions/Canvas**

1.3 WHEN a facilitator navigates to the Edit Poll page THEN the system renders the Save button (inside PollForm) above the Questions section and the Visual Canvas Editor

1.4 WHEN a facilitator sees the Save button at the top of the page THEN the system encourages premature saving before questions are added or positioned on the canvas

**Bug 4: Results vs Test Responses Tabs Showing Same Data**

1.5 WHEN a facilitator views the "Test Responses" tab on the Facilitate page THEN the system fetches results with `includeTest=true` which returns ALL responses (both test and real) instead of only test responses

1.6 WHEN both real and test responses exist THEN the system displays identical or near-identical data in both the "Results" tab and the "Test Responses" tab because the test tab includes real responses

**Bug 5: "Names Visible" Only Shows Names for Custom Responses**

1.7 WHEN the facilitator sets reveal stage to "DETAILS" and disables anonymisation (Names Visible) THEN the system only shows participant names in the custom/free-text response section

1.8 WHEN the facilitator has "Names Visible" enabled and views option counts/details THEN the system does NOT display which participants selected which predefined options

**Bug 6: Percentage Calculation Shows 1% Instead of 0%**

1.9 WHEN a participant submits a custom (free-text) response and no participants selected a predefined option THEN the system shows 1% for that unselected option instead of 0%

1.10 WHEN custom responses exist THEN the system's largest-remainder percentage calculation incorrectly distributes remainder points to options with 0 actual votes, because custom responses inflate `totalResponses` without incrementing any predefined option's count

### Expected Behavior (Correct)

**Bug 1: No Password Reset on Login Page**

2.1 WHEN a facilitator forgets their password and visits the admin login page THEN the system SHALL display a "Forgot password?" link below the login form that is visible in login mode

2.2 WHEN a facilitator clicks the "Forgot password?" link and enters their email THEN the system SHALL call `supabase.auth.resetPasswordForEmail()` with the provided email and display a confirmation message

**Bug 2: Edit Poll Page Layout — Save Button Above Questions/Canvas**

2.3 WHEN a facilitator navigates to the Edit Poll page THEN the system SHALL render the page sections in this order: poll metadata fields, questions section, visual canvas editor, and then the Save button at the bottom (or as a sticky bottom bar)

2.4 WHEN a facilitator has finished adding questions and positioning them on the canvas THEN the system SHALL present the Save button in a natural end-of-workflow position (bottom of page or sticky footer)

**Bug 4: Results vs Test Responses Tabs Showing Same Data**

2.5 WHEN a facilitator views the "Test Responses" tab THEN the system SHALL display ONLY responses where `isTest=true`, excluding all real responses from the test tab

2.6 WHEN there are no test responses (no responses with `isTest=true`) THEN the system SHALL display an empty state message such as "No test responses yet" rather than showing real response data

**Bug 5: "Names Visible" Only Shows Names for Custom Responses**

2.7 WHEN the facilitator sets reveal stage to "DETAILS" and disables anonymisation THEN the system SHALL display participant names for ALL response types, including which participants selected each predefined option

2.8 WHEN the facilitator has "Names Visible" enabled at the "DETAILS" reveal stage THEN the system SHALL show a list of participant names under each predefined option (in addition to showing names on custom responses)

**Bug 6: Percentage Calculation Shows 1% Instead of 0%**

2.9 WHEN no participants selected a predefined option THEN the system SHALL display 0% for that option regardless of whether custom responses exist

2.10 WHEN the largest-remainder method distributes extra percentage points THEN the system SHALL only distribute points to options that have at least one vote (count > 0), never to options with zero votes

### Unchanged Behavior (Regression Prevention)

**Bug 1: No Password Reset on Login Page**

3.1 WHEN a facilitator submits valid login credentials THEN the system SHALL CONTINUE TO authenticate and redirect to the admin dashboard

3.2 WHEN a facilitator submits the registration form with valid data THEN the system SHALL CONTINUE TO create an account and display the success message

**Bug 2: Edit Poll Page Layout — Save Button Above Questions/Canvas**

3.3 WHEN a facilitator edits the poll title or description THEN the system SHALL CONTINUE TO persist those changes via the PATCH API

3.4 WHEN a facilitator uploads a background image THEN the system SHALL CONTINUE TO upload and display the image correctly

3.5 WHEN a facilitator adds, edits, or deletes questions THEN the system SHALL CONTINUE TO persist question changes independently of the Save button

**Bug 4: Results vs Test Responses Tabs Showing Same Data**

3.6 WHEN a facilitator views the "Results" tab THEN the system SHALL CONTINUE TO display only real responses (where `isTest=false`)

3.7 WHEN a facilitator clears test responses THEN the system SHALL CONTINUE TO remove only test-flagged responses without affecting real participant data

**Bug 5: "Names Visible" Only Shows Names for Custom Responses**

3.8 WHEN anonymisation is enabled THEN the system SHALL CONTINUE TO hide real participant names and use generic labels (e.g., "Participant 1") for custom responses

3.9 WHEN reveal stage is "COUNTS" THEN the system SHALL CONTINUE TO show only aggregate counts and percentages without any participant-level detail

3.10 WHEN reveal stage is "HIDDEN" THEN the system SHALL CONTINUE TO show the "Results are hidden" message

**Bug 6: Percentage Calculation Shows 1% Instead of 0%**

3.11 WHEN all responses are for predefined options (no custom responses) THEN the system SHALL CONTINUE TO calculate percentages accurately using the largest-remainder method

3.12 WHEN multiple predefined options have votes THEN the system SHALL CONTINUE TO ensure percentage totals sum to approximately 100% (99-101%)

3.13 WHEN a question has zero total responses THEN the system SHALL CONTINUE TO display 0% for all options
