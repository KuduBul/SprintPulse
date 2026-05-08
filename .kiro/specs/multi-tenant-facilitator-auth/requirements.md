# Requirements Document

## Introduction

SprintPulse currently uses a shared admin token (`ADMIN_SECRET` environment variable) for all facilitator access. This feature replaces that mechanism with full multi-tenant authentication using Supabase Auth. Each facilitator will have an individual account with email/password credentials, own their polls exclusively, and manage their profile. The participant flow remains unauthenticated.

## Glossary

- **Auth_Service**: The Supabase Auth service that handles user registration, login, session management, and token validation
- **Facilitator**: An authenticated user who creates, manages, and runs polls within SprintPulse
- **Participant**: An unauthenticated user who enters a name and votes on active polls
- **Session**: A Supabase Auth session consisting of an access token and refresh token, managed client-side
- **Poll_Owner**: The Facilitator who created a given poll and has exclusive management rights over it
- **Auth_Middleware**: Server-side logic that validates Supabase Auth tokens on protected API routes
- **Profile**: A database record storing a Facilitator's display name and metadata, linked to the Supabase Auth user ID
- **Migration_Strategy**: The process of assigning existing polls (created before multi-tenant auth) to a designated default Facilitator account

## Requirements

### Requirement 1: Facilitator Registration

**User Story:** As a new facilitator, I want to register with my email and password, so that I can create and manage my own polls.

#### Acceptance Criteria

1. WHEN a user submits a valid email address and password, THE Auth_Service SHALL create a new Facilitator account and return a valid Session
2. WHEN a user submits an email address that is already registered, THE Auth_Service SHALL return an error indicating the email is already in use
3. WHEN a user submits a password shorter than 8 characters, THE Auth_Service SHALL reject the registration and return a validation error
4. THE Registration_Form SHALL collect the Facilitator's display name during sign-up
5. WHEN registration succeeds, THE System SHALL create a Profile record linked to the new Facilitator's auth user ID

### Requirement 2: Facilitator Login

**User Story:** As a registered facilitator, I want to log in with my email and password, so that I can access my polls.

#### Acceptance Criteria

1. WHEN a Facilitator submits valid email and password credentials, THE Auth_Service SHALL return a valid Session containing access and refresh tokens
2. WHEN a Facilitator submits invalid credentials, THE Auth_Service SHALL return an authentication error without revealing whether the email exists
3. WHEN a valid Session exists in the browser, THE System SHALL automatically restore the authenticated state on page load
4. WHEN a Session access token expires, THE Auth_Service SHALL use the refresh token to obtain a new access token without requiring re-login

### Requirement 3: Facilitator Logout

**User Story:** As a logged-in facilitator, I want to log out, so that I can secure my account on shared devices.

#### Acceptance Criteria

1. WHEN a Facilitator triggers logout, THE Auth_Service SHALL invalidate the current Session
2. WHEN a Facilitator triggers logout, THE System SHALL remove all session data from the browser and redirect to the login page
3. WHEN a Session is invalidated, THE Auth_Middleware SHALL reject subsequent API requests using that Session's tokens

### Requirement 4: Protected API Routes

**User Story:** As a facilitator, I want my API endpoints to be secured with my individual credentials, so that only I can manage my polls.

#### Acceptance Criteria

1. THE Auth_Middleware SHALL validate the Supabase Auth access token on all facilitator API routes (poll creation, update, deletion, clone, reset, facilitator state management)
2. WHEN a request lacks a valid access token, THE Auth_Middleware SHALL return a 401 Unauthorized response
3. WHEN a request contains an expired or malformed token, THE Auth_Middleware SHALL return a 401 Unauthorized response
4. THE Auth_Middleware SHALL extract the authenticated Facilitator's user ID from the validated token and make it available to route handlers

### Requirement 5: Poll Ownership and Isolation

**User Story:** As a facilitator, I want to see and manage only my own polls, so that my work is separate from other facilitators.

#### Acceptance Criteria

1. WHEN a Facilitator creates a poll, THE System SHALL record the Facilitator's user ID as the Poll_Owner
2. WHEN a Facilitator requests the poll list, THE System SHALL return only polls owned by that Facilitator
3. WHEN a Facilitator attempts to access a poll owned by a different Facilitator, THE System SHALL return a 403 Forbidden response
4. WHEN a Facilitator attempts to modify a poll owned by a different Facilitator, THE System SHALL return a 403 Forbidden response
5. THE Database SHALL enforce poll ownership via a non-nullable foreign key column linking each poll to a Facilitator user ID

### Requirement 6: Participant Access Remains Unauthenticated

**User Story:** As a participant, I want to vote on polls without creating an account, so that I can participate quickly and easily.

#### Acceptance Criteria

1. THE System SHALL allow unauthenticated access to the public poll view endpoint
2. THE System SHALL allow unauthenticated access to the poll response submission endpoint
3. THE System SHALL allow unauthenticated access to the public results endpoint
4. WHEN a Participant accesses a poll, THE System SHALL require only a participant name and session token for voting

### Requirement 7: Facilitator Profile Management

**User Story:** As a facilitator, I want to update my display name, so that my identity is correctly shown in the application.

#### Acceptance Criteria

1. WHEN a Facilitator updates their display name, THE System SHALL persist the change to the Profile record
2. THE Profile_Page SHALL display the Facilitator's current email address (read-only) and editable display name
3. WHEN a Facilitator submits a display name exceeding 100 characters, THE System SHALL reject the update with a validation error

### Requirement 8: Database Migration for Existing Polls

**User Story:** As a system administrator, I want existing polls to be assigned to a default facilitator account, so that no data is lost during the authentication migration.

#### Acceptance Criteria

1. WHEN the migration runs, THE System SHALL create a designated default Facilitator account if one does not exist
2. WHEN the migration runs, THE System SHALL assign all existing polls without an owner to the default Facilitator account
3. THE Migration SHALL be idempotent, producing the same result when executed multiple times
4. THE Migration SHALL preserve all existing poll data, questions, responses, and audit logs without modification

### Requirement 9: Remove Shared Admin Token Authentication

**User Story:** As a system administrator, I want the shared admin token mechanism removed, so that the system uses only individual Supabase Auth credentials.

#### Acceptance Criteria

1. WHEN the migration is complete, THE System SHALL no longer accept the `x-admin-token` header for authentication
2. THE System SHALL remove the `ADMIN_SECRET` environment variable dependency from all server-side code
3. THE System SHALL replace the client-side admin token input form with a Supabase Auth login form
4. THE System SHALL replace the `useAdminToken` hook with a Supabase Auth session hook

### Requirement 10: Auth-Aware Audit Logging

**User Story:** As a facilitator, I want audit logs to record my identity, so that actions are traceable to individual users.

#### Acceptance Criteria

1. WHEN a Facilitator performs an auditable action, THE AuditLogger SHALL record the Facilitator's user ID as the actor instead of the generic "admin" string
2. THE AuditLog records SHALL include the Facilitator's user ID in the actor field for all authenticated operations
3. WHEN a Participant submits a response, THE AuditLogger SHALL continue to record "participant" as the actor
