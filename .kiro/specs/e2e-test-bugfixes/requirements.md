# Requirements Document

## Introduction

This document captures 5 bugs discovered during end-to-end testing of the SprintPulse application. Each bug is documented with its current defective behavior, expected correct behavior, and behaviors that must remain unchanged after the fix.

## Glossary

- **System**: The SprintPulse Polling and Live Facilitation App
- **AuthForm**: The component handling login/register UI
- **PollForm**: The component rendering poll metadata fields and Save button
- **EditPollPage**: The page composing PollForm, Questions, and Canvas sections
- **FacilitatorDashboard**: The component managing session controls and results tabs
- **ResultsDisplay**: The component rendering aggregated poll results
- **responseService**: The service aggregating responses with filtering and percentage calculation

## Requirements

### Requirement 1: Current Behavior (Defect)

**User Story:** As a tester, I want to document the current defective behaviors so that fixes can be verified.

#### Acceptance Criteria

1. WHEN a facilitator forgets their password and visits the admin login page THEN the system provides no mechanism to initiate a password reset flow
2. WHEN a facilitator cannot remember their credentials THEN the system only offers login and register options
3. WHEN a facilitator navigates to the Edit Poll page THEN the system renders the Save button above the Questions section and the Visual Canvas Editor
4. WHEN a facilitator sees the Save button at the top of the page THEN the system encourages premature saving before questions are added
5. WHEN a facilitator views the Test Responses tab THEN the system fetches results with includeTest=true which returns ALL responses instead of only test responses
6. WHEN both real and test responses exist THEN the system displays identical data in both the Results tab and the Test Responses tab
7. WHEN the facilitator sets reveal stage to DETAILS and disables anonymisation THEN the system only shows participant names in the custom response section
8. WHEN the facilitator has Names Visible enabled and views option details THEN the system does NOT display which participants selected which predefined options
9. WHEN a participant submits a custom response and no participants selected a predefined option THEN the system shows 1 percent for that unselected option instead of 0 percent
10. WHEN custom responses exist THEN the system largest-remainder percentage calculation incorrectly distributes remainder points to options with 0 actual votes

### Requirement 2: Expected Behavior (Correct)

**User Story:** As a facilitator, I want the bugs fixed so that the application behaves correctly.

#### Acceptance Criteria

1. WHEN a facilitator forgets their password and visits the admin login page THEN the system SHALL display a Forgot password link below the login form
2. WHEN a facilitator clicks the Forgot password link and enters their email THEN the system SHALL call resetPasswordForEmail with the provided email and display a confirmation message
3. WHEN a facilitator navigates to the Edit Poll page THEN the system SHALL render the page sections in this order: poll metadata fields, questions section, visual canvas editor, and then the Save button at the bottom
4. WHEN a facilitator has finished adding questions and positioning them on the canvas THEN the system SHALL present the Save button in a natural end-of-workflow position
5. WHEN a facilitator views the Test Responses tab THEN the system SHALL display ONLY responses where isTest is true excluding all real responses from the test tab
6. WHEN there are no test responses THEN the system SHALL display an empty state message rather than showing real response data
7. WHEN the facilitator sets reveal stage to DETAILS and disables anonymisation THEN the system SHALL display participant names for ALL response types including which participants selected each predefined option
8. WHEN the facilitator has Names Visible enabled at the DETAILS reveal stage THEN the system SHALL show a list of participant names under each predefined option
9. WHEN no participants selected a predefined option THEN the system SHALL display 0 percent for that option regardless of whether custom responses exist
10. WHEN the largest-remainder method distributes extra percentage points THEN the system SHALL only distribute points to options that have at least one vote

### Requirement 3: Unchanged Behavior (Regression Prevention)

**User Story:** As a facilitator, I want existing functionality to remain unchanged after bug fixes are applied.

#### Acceptance Criteria

1. WHEN a facilitator submits valid login credentials THEN the system SHALL CONTINUE TO authenticate and redirect to the admin dashboard
2. WHEN a facilitator submits the registration form with valid data THEN the system SHALL CONTINUE TO create an account and display the success message
3. WHEN a facilitator edits the poll title or description THEN the system SHALL CONTINUE TO persist those changes via the PATCH API
4. WHEN a facilitator uploads a background image THEN the system SHALL CONTINUE TO upload and display the image correctly
5. WHEN a facilitator adds edits or deletes questions THEN the system SHALL CONTINUE TO persist question changes independently of the Save button
6. WHEN a facilitator views the Results tab THEN the system SHALL CONTINUE TO display only real responses where isTest is false
7. WHEN a facilitator clears test responses THEN the system SHALL CONTINUE TO remove only test-flagged responses without affecting real participant data
8. WHEN anonymisation is enabled THEN the system SHALL CONTINUE TO hide real participant names and use generic labels
9. WHEN reveal stage is COUNTS THEN the system SHALL CONTINUE TO show only aggregate counts and percentages without any participant-level detail
10. WHEN reveal stage is HIDDEN THEN the system SHALL CONTINUE TO show the Results are hidden message
11. WHEN all responses are for predefined options THEN the system SHALL CONTINUE TO calculate percentages accurately using the largest-remainder method
12. WHEN multiple predefined options have votes THEN the system SHALL CONTINUE TO ensure percentage totals sum to approximately 100 percent
13. WHEN a question has zero total responses THEN the system SHALL CONTINUE TO display 0 percent for all options
