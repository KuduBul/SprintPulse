# Requirements Document

## Introduction

SprintPulse currently uses a team-based PIN system for participant access control. This feature replaces the PIN-based approach with unique, cryptographically secure URLs per poll. Each poll receives a non-guessable access token embedded in its URL, and a corresponding QR code is generated for easy sharing during sessions. Participants access polls exclusively through these unique URLs — there is no global poll listing or discovery mechanism. This approach eliminates the friction of PIN entry while maintaining team-scoped isolation.

## Glossary

- **Access_Token**: A cryptographically secure, non-guessable string (minimum 32 characters) generated for each poll that serves as the sole access credential for participants.
- **Poll_URL**: A unique URL containing the Access_Token that grants a participant access to view and interact with a specific poll. Format: `/poll/{access_token}`.
- **QR_Code**: A machine-readable code encoding the Poll_URL, generated for each poll to enable quick participant access via camera scan.
- **Facilitator**: An authenticated user who creates and manages polls via the admin dashboard at /admin.
- **Participant**: An unauthenticated user who accesses a specific poll via its unique Poll_URL.
- **Token_Service**: The backend service responsible for generating, storing, and validating Access_Tokens.
- **QR_Service**: The service responsible for generating QR code images from Poll_URLs.
- **Poll_Service**: The backend service responsible for poll CRUD operations and poll retrieval.
- **Participant_Page**: The page rendered at `/poll/{access_token}` where a participant views and interacts with a single poll.
- **Facilitator_Dashboard**: The /admin pages where facilitators manage polls and access sharing tools.
- **Team_Identifier**: An optional label or grouping associated with a poll to indicate which team the poll is intended for.

## Requirements

### Requirement 1: Access Token Generation

**User Story:** As a Facilitator, I want each poll to automatically receive a unique, secure access token when created, so that only people with the link can access the poll.

#### Acceptance Criteria

1. WHEN a Facilitator creates a new poll, THE Token_Service SHALL generate a cryptographically secure Access_Token of at least 32 characters.
2. THE Token_Service SHALL use a cryptographically secure random number generator to produce each Access_Token.
3. THE Token_Service SHALL ensure each generated Access_Token is unique across all polls in the system.
4. THE Token_Service SHALL store the Access_Token associated with the poll record.
5. WHEN a poll is cloned, THE Token_Service SHALL generate a new unique Access_Token for the cloned poll.

### Requirement 2: Unique Poll URL Construction

**User Story:** As a Facilitator, I want each poll to have a unique, non-guessable URL, so that I can share it with my team without worrying about unauthorized access.

#### Acceptance Criteria

1. THE Poll_Service SHALL construct the Poll_URL by combining the application base URL with the path `/poll/{access_token}`.
2. THE Poll_Service SHALL ensure Poll_URLs are not sequential or predictable based on other Poll_URLs.
3. WHEN a Facilitator views poll details, THE Facilitator_Dashboard SHALL display the full Poll_URL for that poll.
4. THE Facilitator_Dashboard SHALL provide a copy-to-clipboard action for the Poll_URL.

### Requirement 3: Participant Access via Poll URL

**User Story:** As a Participant, I want to access a poll by navigating to its unique URL, so that I can view and respond to the poll without needing a PIN or login.

#### Acceptance Criteria

1. WHEN a Participant navigates to a valid Poll_URL, THE Token_Service SHALL validate the Access_Token in the URL path.
2. WHEN the Access_Token is valid, THE Participant_Page SHALL display the poll associated with that token.
3. THE Participant_Page SHALL allow the Participant to view questions and submit responses for the accessed poll.
4. THE Participant_Page SHALL display only the single poll associated with the Access_Token.
5. IF a Participant navigates to a Poll_URL with an invalid or non-existent Access_Token, THEN THE Participant_Page SHALL display an error message indicating the poll is not found or the link is invalid.
6. IF a Participant navigates to a Poll_URL for a deleted poll, THEN THE Participant_Page SHALL display a message indicating the poll is no longer available.

### Requirement 4: No Global Poll Discovery

**User Story:** As a Facilitator, I want to ensure participants cannot browse or discover polls outside their shared links, so that poll access remains controlled.

#### Acceptance Criteria

1. THE Participant_Page SHALL NOT provide a listing, search, or browse interface for discovering polls.
2. THE Poll_Service SHALL NOT expose an unauthenticated API endpoint that returns multiple polls without a valid Access_Token.
3. WHEN a Participant navigates to the base `/poll` path without an Access_Token, THE Participant_Page SHALL display an informational message instructing the participant to use a shared link or scan a QR code.

### Requirement 5: QR Code Generation

**User Story:** As a Facilitator, I want a QR code generated for each poll's unique URL, so that I can display it during sessions for quick participant access.

#### Acceptance Criteria

1. WHEN a poll is created, THE QR_Service SHALL generate a QR code encoding the full Poll_URL.
2. THE QR_Service SHALL produce the QR code as a downloadable image (PNG format, minimum 300x300 pixels).
3. WHEN a Facilitator views poll details or the facilitation screen, THE Facilitator_Dashboard SHALL display the QR code for that poll.
4. THE Facilitator_Dashboard SHALL provide a download action for the QR code image.
5. WHEN a poll's Access_Token is regenerated, THE QR_Service SHALL generate a new QR code reflecting the updated Poll_URL.

### Requirement 6: Token Regeneration

**User Story:** As a Facilitator, I want to regenerate a poll's access token if the link is compromised, so that I can revoke previous access and issue a new secure link.

#### Acceptance Criteria

1. WHEN a Facilitator requests token regeneration for a poll, THE Token_Service SHALL generate a new Access_Token for that poll.
2. WHEN a new Access_Token is generated, THE Token_Service SHALL invalidate the previous Access_Token for that poll.
3. IF a Participant navigates to a Poll_URL containing an invalidated Access_Token, THEN THE Participant_Page SHALL display an error message indicating the link is no longer valid.
4. WHEN a token is regenerated, THE Facilitator_Dashboard SHALL display the updated Poll_URL and QR code.

### Requirement 7: Optional Token Expiry

**User Story:** As a Facilitator, I want to optionally set an expiry time on a poll's access token, so that access is automatically revoked after a session ends.

#### Acceptance Criteria

1. WHEN a Facilitator creates or edits a poll, THE Facilitator_Dashboard SHALL provide an optional expiry duration field for the Access_Token.
2. WHERE an expiry duration is set, THE Token_Service SHALL record the expiry timestamp on the Access_Token.
3. WHERE an Access_Token has an expiry timestamp, WHEN the current time exceeds the expiry timestamp, THE Token_Service SHALL treat the Access_Token as invalid.
4. IF a Participant navigates to a Poll_URL with an expired Access_Token, THEN THE Participant_Page SHALL display a message indicating the link has expired.
5. WHERE no expiry duration is set, THE Token_Service SHALL treat the Access_Token as valid indefinitely.

### Requirement 8: Team Scoping

**User Story:** As a Facilitator, I want to associate polls with a team identifier, so that I can organize polls by team while using unique URLs for access.

#### Acceptance Criteria

1. WHEN a Facilitator creates or edits a poll, THE Facilitator_Dashboard SHALL allow the Facilitator to assign an optional Team_Identifier to the poll.
2. WHEN a Facilitator views their poll list, THE Facilitator_Dashboard SHALL display the Team_Identifier for each poll that has one assigned.
3. WHEN a Facilitator filters polls by Team_Identifier, THE Poll_Service SHALL return only polls matching the selected Team_Identifier.
4. THE Team_Identifier SHALL serve as an organizational label and SHALL NOT affect participant access via Poll_URL.

### Requirement 9: Access Token Validation Performance

**User Story:** As a Participant, I want the poll to load quickly when I open the link, so that I can participate without delay.

#### Acceptance Criteria

1. WHEN a Participant navigates to a valid Poll_URL, THE Token_Service SHALL validate the Access_Token and return the poll data within 500 milliseconds under normal load.
2. THE Token_Service SHALL support at least 100 concurrent token validation requests without degradation beyond the 500-millisecond threshold.

### Requirement 10: Backward Compatibility with Existing Polls

**User Story:** As a system administrator, I want existing polls to receive access tokens during migration, so that all polls are accessible via the new URL-based system.

#### Acceptance Criteria

1. WHEN the feature is deployed, THE Token_Service SHALL generate Access_Tokens for all existing polls that do not have one.
2. THE Poll_Service SHALL retain all existing poll data without modification during migration.
3. WHEN an existing poll receives an Access_Token, THE Poll_Service SHALL make that poll accessible via its new Poll_URL.
4. THE Poll_Service SHALL remove the unauthenticated global poll listing endpoint after migration is complete.
