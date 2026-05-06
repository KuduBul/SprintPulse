# Requirements Document

## Introduction

The Shoprite-X Polling & Live Facilitation App is a web-based internal tool for workshops, retrospectives, PI events, and engagement sessions. It enables facilitators to create visually rich polls, collect structured and free-text input, and control how and when results are revealed in live sessions. The product prioritises psychological safety, enterprise-grade UX, facilitator control, and auditability.

## Glossary

- **System**: The Shoprite-X Polling & Live Facilitation App as a whole
- **Poll_Service**: The backend service responsible for poll CRUD operations and data persistence
- **Canvas_Editor**: The visual drag-and-drop editor for placing questions on a background image
- **Facilitator_Controller**: The component managing live session controls (voting, reveal, anonymisation)
- **Participant_View**: The public-facing interface where participants submit responses
- **Audit_Logger**: The component responsible for recording all significant system actions
- **Validator**: The component responsible for input validation using Zod schemas
- **Session_Manager**: The component managing participant session tokens and deduplication
- **Retention_Service**: The component responsible for automated data purge based on retention policies
- **Results_Aggregator**: The component responsible for computing and displaying poll results
- **Poll**: A collection of questions presented to participants
- **Question**: A single prompt with predefined options and optional free-text input
- **Canvas**: The visual editor where questions are placed on a background image
- **Reveal_Stage**: The level of detail shown in results (HIDDEN, COUNTS, DETAILS)
- **Session_Token**: A browser-generated identifier to prevent duplicate submissions
- **Facilitator_State**: The JSON object controlling voting, anonymisation, and reveal
- **Display_Name**: The name entered by a participant to identify themselves during a session

## Requirements

### Requirement 1: Poll Creation and Management

**User Story:** As a facilitator, I want to create and manage polls with metadata, so that I can prepare visually engaging sessions for my team.

#### Acceptance Criteria

1. WHEN an admin submits a poll with a valid title, THE Poll_Service SHALL create the poll and return it in the admin poll list
2. THE Validator SHALL reject poll creation requests where the title exceeds 200 characters
3. THE Validator SHALL reject poll creation requests where the description exceeds 1000 characters
4. WHEN an admin uploads a background image exceeding 5 MB, THE Validator SHALL reject the upload and return a validation error before submission
5. THE Validator SHALL reject background image uploads where the file format is not JPEG, PNG, or WebP
6. WHEN an admin requests a poll reset, THE Poll_Service SHALL remove all response records for that poll and log the action via the Audit_Logger
7. WHEN an admin clones a poll, THE Poll_Service SHALL create a new poll with identical questions, a title suffixed with "(Copy)", and zero responses
8. WHEN an admin clones a poll, THE Poll_Service SHALL leave the original poll and its response data untouched
9. WHEN an admin deletes a poll, THE Poll_Service SHALL soft-delete the poll by setting isDeleted to true
10. WHILE a poll is soft-deleted, THE System SHALL hide the poll from all user-facing views but retain data for audit purposes

### Requirement 2: Question Management

**User Story:** As a facilitator, I want to add and configure questions within a poll, so that I can gather structured feedback from participants.

#### Acceptance Criteria

1. THE Validator SHALL reject saving a poll that contains zero questions
2. THE Validator SHALL enforce a minimum of 1 and maximum of 20 questions per poll
3. THE Validator SHALL enforce a minimum of 2 and maximum of 10 predefined options per question
4. WHEN an admin attempts to add an 11th option to a question, THE Validator SHALL display a validation error
5. THE Validator SHALL reject questions where the text prompt exceeds 500 characters
6. WHEN an admin enables the custom option on a question, THE Participant_View SHALL display a free-text input field for that question
7. WHEN a question has no canvas position assigned, THE Canvas_Editor SHALL display the question in the sidebar as "unplaced"
8. THE Poll_Service SHALL store each question with a display order integer for list-based rendering fallback

### Requirement 3: Visual Poll Editor (PollCanvas)

**User Story:** As a facilitator, I want to visually place questions on a background image using drag-and-drop, so that I can create engaging visual layouts for my sessions.

#### Acceptance Criteria

1. WHEN an admin drags a question from the sidebar onto the canvas, THE Canvas_Editor SHALL save the question position as percentage-based coordinates on drop
2. THE Canvas_Editor SHALL persist question positions across page reloads
3. WHEN a question is placed on the canvas, THE Canvas_Editor SHALL allow repositioning via drag and resizing via corner handles
4. WHEN an admin right-clicks a placed question and selects "Remove from canvas", THE Canvas_Editor SHALL return the question to the sidebar
5. WHILE no background image is set, THE Canvas_Editor SHALL display a neutral grey canvas
6. IF the background image fails to load, THEN THE Canvas_Editor SHALL display a placeholder with an error message while keeping questions interactive
7. IF the browser does not support the Drag and Drop API, THEN THE Canvas_Editor SHALL display a warning banner and fall back to coordinate input fields
8. WHILE the viewport width is less than 768px, THE System SHALL render all questions as a scrollable vertical list regardless of canvas positions
9. WHILE the viewport width is between 768px and 1023px, THE Canvas_Editor SHALL display the canvas in view-only mode for facilitators
10. WHILE the viewport width is 1024px or greater, THE Canvas_Editor SHALL display the full canvas editor with drag-and-drop functionality
11. WHEN multiple questions overlap on the canvas, THE Canvas_Editor SHALL render the last-placed question on top using z-index by placement order

### Requirement 4: Participant Voting

**User Story:** As a participant, I want to access a poll via a public URL and submit my responses, so that I can contribute my feedback during a session.

#### Acceptance Criteria

1. WHEN a participant opens a poll URL while voting is closed, THE Participant_View SHALL display a "Voting is currently closed" message without showing the name entry form
2. WHEN a participant enters a valid display name (2-50 characters), THE Session_Manager SHALL generate a session token and store it in localStorage
3. WHEN a participant refreshes the page after entering a name, THE Session_Manager SHALL restore the name field from the stored session token
4. THE Validator SHALL reject submission if the display name is missing or fewer than 2 characters
5. THE Validator SHALL reject submission if any question is unanswered
6. WHEN a participant selects the custom free-text option but leaves the text field empty, THE Validator SHALL reject the submission with an inline error message
7. WHEN a participant successfully submits responses, THE Participant_View SHALL display a confirmation screen and prevent further edits
8. WHEN a participant attempts to submit the same poll from the same browser a second time, THE Session_Manager SHALL display an "Already submitted" message
9. IF a facilitator closes voting while a participant has the form open, THEN THE Participant_View SHALL disable the submit button and display a "Voting has been closed by the facilitator" banner within 5 seconds
10. IF voting closes while a participant is mid-form, THEN THE System SHALL not save partial answers
11. WHILE voting is closed mid-session, THE Participant_View SHALL allow the participant to copy their free-text answers before navigating away

### Requirement 5: Facilitator Mode (Live Session Controls)

**User Story:** As a facilitator, I want real-time controls during live sessions, so that I can manage voting, control result visibility, and ensure psychological safety.

#### Acceptance Criteria

1. THE Facilitator_Controller SHALL default voting to closed, live results to off, anonymisation to on, and reveal stage to HIDDEN when a facilitator session starts
2. WHEN a facilitator toggles "Close voting", THE System SHALL prevent new participant submissions within one poll cycle (3 seconds or less)
3. WHEN a facilitator changes the reveal stage from HIDDEN to COUNTS, THE Results_Aggregator SHALL display aggregated option totals immediately
4. WHEN a facilitator changes the reveal stage to DETAILS, THE Results_Aggregator SHALL display free-text responses and participant names (if anonymisation is off)
5. WHEN a facilitator enables anonymisation, THE Results_Aggregator SHALL replace participant names with "Participant 1, 2, ..." in all results views
6. THE Facilitator_Controller SHALL persist facilitator state across page refreshes
7. WHEN a second facilitator opens the same poll's facilitator view, THE System SHALL display a warning: "Another facilitator session may be active"
8. THE Facilitator_Controller SHALL use a last-write-wins strategy for concurrent facilitator state changes
9. WHILE live results are enabled, THE Results_Aggregator SHALL refresh results automatically at a 3-second polling interval
10. THE Facilitator_Controller SHALL display the current participant count and submission count in real time
11. WHEN a poll has zero responses and results are revealed, THE Results_Aggregator SHALL display "No responses yet" per question
12. WHEN a poll has no questions, THE Facilitator_Controller SHALL display "Add questions before starting a session"

### Requirement 6: Facilitator Test Mode

**User Story:** As a facilitator, I want to preview the poll as a participant without polluting real data, so that I can verify the experience before running a live session.

#### Acceptance Criteria

1. WHEN a facilitator activates "Preview as Participant", THE System SHALL open the participant view with a testMode flag
2. WHEN a response is submitted in test mode, THE Poll_Service SHALL tag the response with isTest: true and exclude it from real results
3. THE Results_Aggregator SHALL not include test responses in the public results view
4. THE Facilitator_Controller SHALL display test responses in a separate "Test Responses" tab
5. WHEN a facilitator clears test responses, THE Poll_Service SHALL remove only test-flagged responses without affecting real participant data
6. WHILE in test mode, THE Participant_View SHALL respect the current facilitator state (voting open/closed, reveal stage)
7. THE Results_Aggregator SHALL not increment the participant count for test mode submissions

### Requirement 7: Results Aggregation and Privacy

**User Story:** As a facilitator, I want to view aggregated results with privacy controls, so that I can share feedback safely during sessions.

#### Acceptance Criteria

1. THE Results_Aggregator SHALL compute the count per predefined option for each question
2. THE Results_Aggregator SHALL compute the percentage per option relative to total responses for that question
3. THE Results_Aggregator SHALL ensure displayed percentages sum to 100% with a tolerance of plus or minus 1% due to rounding
4. THE Results_Aggregator SHALL display free-text responses verbatim without truncation, grouped under "Custom"
5. WHILE anonymisation is enabled, THE Results_Aggregator SHALL ensure no participant names appear anywhere in the rendered DOM
6. WHEN anonymisation is disabled AND reveal stage is set to DETAILS, THE Results_Aggregator SHALL display participant names alongside their responses
7. WHEN a question has zero responses, THE Results_Aggregator SHALL display "No responses yet" for that question
8. WHEN the free-text option has no entries for a question, THE Results_Aggregator SHALL hide the free-text section entirely

### Requirement 8: Audit Logging

**User Story:** As an organisation, I want all significant actions logged immutably, so that I can maintain governance, traceability, and support incident investigation.

#### Acceptance Criteria

1. WHEN an admin creates a poll, THE Audit_Logger SHALL record a POLL_CREATED entry with the poll ID and timestamp
2. WHEN an admin updates poll metadata, THE Audit_Logger SHALL record a POLL_UPDATED entry
3. WHEN an admin soft-deletes a poll, THE Audit_Logger SHALL record a POLL_DELETED entry
4. WHEN an admin clones a poll, THE Audit_Logger SHALL record a POLL_CLONED entry referencing both source and new poll IDs
5. WHEN a question is created, updated, or deleted, THE Audit_Logger SHALL record the corresponding QUESTION_CREATED, QUESTION_UPDATED, or QUESTION_DELETED entry
6. WHEN a participant submits responses, THE Audit_Logger SHALL record a RESPONSES_SUBMITTED entry
7. WHEN an admin resets responses, THE Audit_Logger SHALL record a RESPONSES_RESET entry
8. WHEN a facilitator opens facilitator mode, THE Audit_Logger SHALL record a FACILITATOR_SESSION_STARTED entry
9. WHEN a facilitator changes any control state, THE Audit_Logger SHALL record a FACILITATOR_STATE_UPDATED entry
10. WHEN a facilitator changes the reveal stage, THE Audit_Logger SHALL record a REVEAL_STAGE_CHANGED entry
11. WHEN a facilitator opens or closes voting, THE Audit_Logger SHALL record a VOTING_OPENED or VOTING_CLOSED entry respectively
12. WHEN the retention purge executes, THE Audit_Logger SHALL record a DATA_PURGED entry
13. THE Audit_Logger SHALL record all entries within 1 second of the triggering action
14. THE Audit_Logger SHALL store entries as immutable records (no updatedAt field)

### Requirement 9: Data Retention and Automated Purge

**User Story:** As an organisation, I want automated data retention policies, so that I can manage storage costs and comply with data governance requirements.

#### Acceptance Criteria

1. THE Retention_Service SHALL purge poll responses older than 90 days (configurable via RETENTION_RESPONSES_DAYS environment variable)
2. THE Retention_Service SHALL purge audit logs older than 12 months (configurable via RETENTION_AUDIT_DAYS environment variable)
3. THE Retention_Service SHALL hard-delete soft-deleted polls after 30 days
4. WHEN the purge endpoint is triggered, THE Retention_Service SHALL execute the purge and log the action via the Audit_Logger
5. THE System SHALL trigger the purge endpoint daily at 02:00 UTC via Vercel Cron
6. THE Retention_Service SHALL purge test responses using the same retention policy as real responses

### Requirement 10: Admin Authentication (Phase 1)

**User Story:** As an admin, I want access to admin routes protected by a shared secret, so that only authorised facilitators can manage polls.

#### Acceptance Criteria

1. THE System SHALL gate all admin API routes behind an x-admin-token header
2. WHEN a request to an admin route includes a valid x-admin-token matching the ADMIN_SECRET environment variable, THE System SHALL allow the request to proceed
3. WHEN a request to an admin route is missing the x-admin-token header or provides an invalid token, THE System SHALL reject the request with a 401 Unauthorized response
4. THE Audit_Logger SHALL record "admin" as the actor for all admin-initiated actions

### Requirement 11: Input Validation and Security

**User Story:** As a system operator, I want all inputs validated server-side with proper sanitisation, so that the system is protected against malformed data and XSS attacks.

#### Acceptance Criteria

1. THE Validator SHALL validate all API inputs server-side using Zod schemas
2. THE Validator SHALL sanitise free-text input fields to prevent XSS in results display
3. THE System SHALL enforce rate limiting of 60 requests per minute per IP on all public endpoints
4. THE System SHALL reject any client-side direct writes; all mutations go through API routes
5. IF a public endpoint receives more than 60 requests per minute from a single IP, THEN THE System SHALL respond with a 429 Too Many Requests status

### Requirement 12: Performance and Reliability

**User Story:** As a facilitator, I want the system to perform reliably during live sessions with up to 100 concurrent participants, so that sessions run smoothly without technical interruptions.

#### Acceptance Criteria

1. THE System SHALL support 100 concurrent participants per poll
2. THE System SHALL respond to API requests within 500ms at the 95th percentile
3. THE System SHALL refresh poll results within 3 seconds of a new vote being submitted (while live results are enabled)
4. IF the connection to Supabase is lost during a live session, THEN THE System SHALL display a "Connection lost" banner and retry with exponential backoff
5. THE System SHALL ensure no data loss for already-submitted responses during an outage
6. THE System SHALL configure a database connection pool of 10 connections

### Requirement 13: Accessibility

**User Story:** As a participant with accessibility needs, I want the application to be fully navigable via keyboard and compatible with screen readers, so that I can participate equally in sessions.

#### Acceptance Criteria

1. THE System SHALL support keyboard navigation for all interactive elements
2. THE System SHALL use semantic HTML elements (main, nav, section, button) throughout the application
3. THE System SHALL provide ARIA labels on all canvas-placed questions
4. THE System SHALL maintain a colour contrast ratio of at least 4.5:1 (WCAG AA) for all text
5. THE System SHALL display visible focus indicators on all interactive elements
6. WHEN a facilitator changes session state (voting open/closed, reveal stage), THE System SHALL announce the change to screen readers
