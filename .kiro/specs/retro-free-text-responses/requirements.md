# Requirements Document

## Introduction

This feature extends SprintPulse to support Sprint Retrospectives by introducing a "retro" poll type. Unlike existing "pulse" polls where participants select from predefined options, retro polls allow participants to submit multiple free-text responses per question/category. Questions in retro polls act as retrospective categories (e.g., "What went well?", "What to improve?", "Action items"). The feature maintains full backward compatibility with existing pulse poll functionality.

## Glossary

- **System**: The SprintPulse Polling & Live Facilitation App as a whole
- **Poll_Service**: The backend service responsible for poll CRUD operations and data persistence
- **Response_Service**: The backend service responsible for response submission, deduplication, and results aggregation
- **Validator**: The component responsible for input validation using Zod schemas
- **Facilitator_Controller**: The component managing live session controls (voting, reveal, anonymisation)
- **Participant_View**: The public-facing interface where participants submit responses
- **Results_Aggregator**: The component responsible for computing and displaying poll results
- **Audit_Logger**: The component responsible for recording all significant system actions
- **Poll_Type**: A discriminator field on the Poll model with values "pulse" (predefined options) or "retro" (free-text responses)
- **Retro_Category**: A Question within a retro poll that acts as a retrospective prompt/category
- **Response_Index**: A zero-based integer identifying the ordinal position of a free-text entry within a participant's responses to a single question
- **Session_Token**: A browser-generated UUID identifier to prevent duplicate submissions
- **Reveal_Stage**: The level of detail shown in results (HIDDEN, COUNTS, DETAILS)
- **Max_Responses_Per_Question**: A configurable integer (1–10, default 5) controlling how many free-text entries a participant may submit per retro category

## Requirements

### Requirement 1: Poll Type Model Extension

**User Story:** As a facilitator, I want to create retro-type polls distinct from pulse polls, so that I can run sprint retrospectives with free-text input.

#### Acceptance Criteria

1. THE Poll_Service SHALL store a non-nullable `type` field on the Poll model with allowed values "pulse" and "retro"
2. WHEN a poll is created without an explicit type, THE Poll_Service SHALL default the type to "pulse"
3. IF a poll creation request specifies a type value other than "pulse" or "retro", THEN THE Validator SHALL reject the request with a validation error indicating the allowed type values
4. WHEN a retro poll is created, THE Poll_Service SHALL store the `maxResponsesPerQuestion` value on the Poll model
5. WHEN a poll is created with type "retro" and no explicit maxResponsesPerQuestion, THE Poll_Service SHALL default maxResponsesPerQuestion to 5
6. IF a poll creation request specifies maxResponsesPerQuestion with a value less than 1 or greater than 10, THEN THE Validator SHALL reject the request with a validation error indicating the allowed range of 1 to 10
7. IF a poll creation request with type "pulse" includes a maxResponsesPerQuestion field, THEN THE Validator SHALL ignore the field and not persist it on the Poll model
8. WHEN a poll has been created, IF a request attempts to change the poll type, THEN THE Poll_Service SHALL reject the request with an error indicating that poll type is immutable after creation
9. THE System SHALL apply a database migration that adds a non-nullable `type` column with a default value of "pulse" to all existing polls

### Requirement 2: Retro Question (Category) Configuration

**User Story:** As a facilitator, I want to define retrospective categories as questions, so that participants know what topics to provide feedback on.

#### Acceptance Criteria

1. WHEN a question is created for a retro poll, THE Validator SHALL require the question text to be non-empty (1–500 characters)
2. WHEN a question is created for a retro poll, THE Validator SHALL require the options field to be an empty array
3. WHEN a question is created for a retro poll, THE Validator SHALL reject the request if the options array contains any elements
4. WHILE a poll has type "retro", THE System SHALL treat the allowCustom field as implicitly true for all questions in that poll
5. THE Validator SHALL enforce a minimum of 1 and maximum of 20 questions per retro poll

### Requirement 3: Retro Response Submission

**User Story:** As a participant, I want to submit multiple free-text responses per retrospective category, so that I can share all my feedback for each topic.

#### Acceptance Criteria

1. WHEN a participant submits responses to a retro poll, THE Response_Service SHALL accept multiple text entries per question up to the poll's maxResponsesPerQuestion limit
2. IF a participant submits more text entries for a single question than the poll's maxResponsesPerQuestion limit, THEN THE Validator SHALL reject the entire submission with an error message indicating the maximum number of entries has been exceeded
3. WHEN a participant submits responses to a retro poll, THE Validator SHALL require at least one non-empty text entry per question in the poll
4. THE Validator SHALL reject any retro response entry that is empty or contains only whitespace after trimming
5. THE Validator SHALL reject any retro response entry whose trimmed length exceeds 2000 characters
6. THE Response_Service SHALL trim leading and trailing whitespace from each retro response entry before persisting
7. WHEN a participant submits responses to a retro poll, THE Response_Service SHALL store each text entry as a separate Response row with a zero-based responseIndex
8. THE Response_Service SHALL enforce a unique constraint on (pollId, questionId, sessionToken, responseIndex) for retro poll responses
9. WHEN a participant has already submitted responses to a retro poll using the same session token, THE Response_Service SHALL reject the second submission with a conflict error indicating responses have already been recorded for that session
10. WHILE voting is closed on a retro poll, THE Response_Service SHALL reject submission attempts with a "Voting is currently closed" error

### Requirement 4: Response Data Model Extension

**User Story:** As a system operator, I want the response data model to support multiple entries per participant per question, so that retro free-text responses are stored correctly without breaking existing pulse poll behaviour.

#### Acceptance Criteria

1. THE System SHALL add a nullable `responseIndex` integer field to the Response model
2. WHILE a response belongs to a pulse poll, THE Response_Service SHALL store responseIndex as null
3. WHILE a response belongs to a retro poll, THE Response_Service SHALL store responseIndex as a zero-based integer (0, 1, 2, ...)
4. THE System SHALL maintain the existing unique constraint (pollId, questionId, sessionToken) for pulse poll responses where responseIndex is null
5. THE System SHALL enforce uniqueness on (pollId, questionId, sessionToken, responseIndex) for retro poll responses where responseIndex is not null
6. WHEN a retro response is stored, THE Response_Service SHALL set selectedOption to an empty string since retro polls have no predefined options
7. WHEN a retro response is stored, THE Response_Service SHALL store the free-text entry in the customText field

### Requirement 5: Retro Results Aggregation

**User Story:** As a facilitator, I want to view retro responses grouped by category, so that I can review and discuss team feedback during the retrospective.

#### Acceptance Criteria

1. WHEN the reveal stage is HIDDEN for a retro poll, THE Results_Aggregator SHALL return an empty questions array with participantCount of 0 and submissionCount of 0
2. WHEN the reveal stage is COUNTS for a retro poll, THE Results_Aggregator SHALL return the total number of text entries per category and the distinct participant count per category without including any text content or participant labels
3. WHEN the reveal stage is DETAILS for a retro poll, THE Results_Aggregator SHALL return all text entries grouped by category, with each entry including its text content and the associated participant label
4. WHILE anonymisation is enabled on a retro poll, THE Results_Aggregator SHALL replace participant names with sequential labels "Participant 1", "Participant 2" assigned consistently per poll so that the same participant receives the same label across all categories within a single results response
5. WHILE anonymisation is disabled on a retro poll, THE Results_Aggregator SHALL display participant names alongside their text entries
6. THE Results_Aggregator SHALL return retro response text verbatim without truncation up to the maximum entry length of 2000 characters
7. THE Results_Aggregator SHALL order retro responses within each category by submission time (earliest first)
8. WHEN a retro category has zero responses, THE Results_Aggregator SHALL include that category in the results with a totalResponses count of 0 and display the text "No responses yet"
9. WHILE anonymisation is enabled on a retro poll, THE Results_Aggregator SHALL assign participant labels based on the order of first submission time across the poll so that labels remain stable across consecutive results requests for the same dataset

### Requirement 6: Retro Poll Facilitator Controls

**User Story:** As a facilitator, I want the same session controls for retro polls as pulse polls, so that I can manage the retrospective flow consistently.

#### Acceptance Criteria

1. THE Facilitator_Controller SHALL apply the same default state to retro polls as pulse polls (votingOpen: false, liveResults: false, anonymise: true, revealStage: HIDDEN)
2. WHEN a facilitator toggles voting on a retro poll, THE System SHALL gate participant submissions based on the votingOpen state
3. WHEN a facilitator enables live results on a retro poll, THE Results_Aggregator SHALL refresh results at the standard 3-second polling interval
4. WHEN a facilitator changes the reveal stage on a retro poll, THE Results_Aggregator SHALL update the displayed detail level immediately
5. THE Facilitator_Controller SHALL display the current participant count and total entry count for retro polls

### Requirement 7: Retro Poll Creation UI

**User Story:** As a facilitator, I want a clear interface for creating retro polls, so that I can set up retrospective categories without confusion.

#### Acceptance Criteria

1. WHEN a facilitator selects the "retro" poll type during creation, THE System SHALL hide the predefined options input for each question
2. WHEN a facilitator selects the "retro" poll type during creation, THE System SHALL display a category name input field for each question
3. THE System SHALL display a configurable "Max responses per question" field with a default value of 5 when the retro type is selected
4. THE Validator SHALL reject retro poll creation if any question text is empty
5. THE System SHALL provide a type selector (pulse/retro) at the top of the poll creation form
6. WHEN a facilitator selects the "retro" poll type, THE System SHALL not display the canvas editor

### Requirement 8: Retro Participant Submission UI

**User Story:** As a participant, I want an intuitive interface for entering multiple free-text responses per category, so that I can easily contribute all my feedback.

#### Acceptance Criteria

1. WHEN a participant opens a retro poll, THE Participant_View SHALL display each category as a vertical list with text input fields
2. THE Participant_View SHALL display an "Add response" button for each category that adds a new text input field
3. WHEN the number of entries for a category reaches the poll's maxResponsesPerQuestion limit, THE Participant_View SHALL disable the "Add response" button for that category
4. THE Participant_View SHALL display a remove button on each text entry field (except when only one entry remains)
5. WHEN a participant submits a retro poll, THE Participant_View SHALL submit all entries for all categories in a single request
6. WHILE voting is closed on a retro poll, THE Participant_View SHALL display a "Voting is currently closed" message and hide the submission form
7. THE Participant_View SHALL not display the canvas layout for retro polls; all categories render as a vertical list

### Requirement 9: Retro Results Export

**User Story:** As a facilitator, I want to copy all retro responses to the clipboard, so that I can paste them into other tools for further analysis.

#### Acceptance Criteria

1. WHEN a facilitator clicks "Copy all to clipboard" on a retro poll's results view, THE System SHALL copy all visible responses grouped by category to the system clipboard as plain text
2. THE System SHALL format the clipboard content with category headings followed by bulleted response entries
3. WHILE anonymisation is enabled, THE System SHALL use anonymised participant labels in the clipboard content
4. WHEN the copy operation succeeds, THE System SHALL display a brief confirmation message

### Requirement 10: Poll Type Immutability and Backward Compatibility

**User Story:** As a system operator, I want existing polls to continue functioning unchanged after the retro feature is deployed, so that there is no disruption to current users.

#### Acceptance Criteria

1. WHEN the database migration runs, THE System SHALL set the type field to "pulse" for all existing polls
2. THE System SHALL preserve the existing unique constraint (pollId, questionId, sessionToken) behaviour for pulse polls
3. WHEN a facilitator edits an existing pulse poll, THE System SHALL not display the poll type selector (type is locked after creation)
4. THE Validator SHALL reject any API request that attempts to change a poll's type after creation
5. THE System SHALL continue to enforce a minimum of 2 predefined options per question for pulse polls

