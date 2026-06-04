# Requirements Document

Retro Board (Phase 2A)

## Introduction

This document specifies requirements for Phase 2A of SprintPulse: a thin, interactive retrospective board that lives alongside the existing pulse polling experience. A facilitator can choose to run a Pulse (current system) or a Retro (new collaborative board). Participants enter through the same shared front door. All Phase 2 work is isolated on the `phase-2-retro` branch behind the `NEXT_PUBLIC_RETRO_ENABLED` feature flag and must not reach production until the owner declares readiness. Requirements are derived from `design.md` and constrained by `decisions.md`.

## Glossary

- **Activity**: A facilitator-created session; either a Pulse poll or a Retro board. Backed by the existing `Poll` shell with a `type` discriminator.
- **Retro_Board**: The collaborative board belonging to a retro activity.
- **Lane**: A named region/column on a board (e.g. "Went well") into which cards are added.
- **Card**: A free-text sticky note authored by a participant, belonging to one lane.
- **Phase**: The retro lifecycle stage: `gather`, `vote`, or `closed`.
- **Participant_Token**: A persistent per-participant identifier stored in the browser, used to own cards and cap votes.
- **Feature_Flag**: `NEXT_PUBLIC_RETRO_ENABLED`; gates all retro visibility. Default false; absent in production.
- **Facilitator**: Authenticated owner who creates and runs activities.
- **Participant**: A team member who joins via team PIN / access token.

## Requirements

### Requirement 1: Production Isolation via Feature Flag

**User Story:** As the product owner, I want retro functionality hidden in production until I declare it ready, so that live pulse users are never exposed to in-progress work.

#### Acceptance Criteria

1. WHEN the Feature_Flag is false or unset THEN the System SHALL NOT render any retro entry point, retro navigation link, or Pulse/Retro selector option in the UI
2. WHEN the Feature_Flag is false or unset AND a request is made to any retro API route THEN the System SHALL respond as if the route does not exist (HTTP 404)
3. WHERE the environment is production THE System SHALL treat the Feature_Flag as false regardless of other configuration
4. WHEN the Feature_Flag is true THEN the System SHALL expose the Pulse/Retro selector, retro routes, and retro navigation

### Requirement 2: Activity Type Selection

**User Story:** As a facilitator, I want to choose between running a Pulse or a Retro when creating an activity, so that I can use one tool for both formats.

#### Acceptance Criteria

1. WHEN a facilitator creates a new activity AND the Feature_Flag is true THEN the System SHALL present a choice between "Pulse" and "Retro"
2. WHEN a facilitator selects "Pulse" THEN the System SHALL use the existing poll creation flow unchanged
3. WHEN a facilitator selects "Retro" THEN the System SHALL create a Poll with type "retro" and an associated Retro_Board
4. WHEN an activity is created without an explicit type THEN the System SHALL default the type to "pulse"
5. THE System SHALL store all existing polls as type "pulse" without requiring data backfill

### Requirement 3: Retro Board Creation and Lane Templates

**User Story:** As a facilitator, I want to pick a retro template that sets up lanes, so that I can start a retrospective quickly.

#### Acceptance Criteria

1. WHEN a facilitator creates a Retro THEN the System SHALL offer built-in templates: "Start/Stop/Continue", "4Ls", "Mad/Sad/Glad", and "Custom"
2. WHEN a facilitator selects a built-in template THEN the System SHALL create the corresponding named lanes in display order
3. WHEN a facilitator selects "Custom" THEN the System SHALL allow the facilitator to define lane titles
4. THE System SHALL require at least 1 and at most 8 lanes per board
5. THE System SHALL require each lane title to be non-empty and at most 100 characters
6. WHEN a Retro_Board is created THEN the System SHALL set its initial phase to "gather"
7. WHEN a Retro_Board is created THEN the System SHALL set a default votes-per-user cap that the facilitator MAY adjust

### Requirement 4: Participant Join and Identity

**User Story:** As a participant, I want to join a retro the same way I join a poll and have my own cards recognised, so that I can manage my contributions.

#### Acceptance Criteria

1. WHEN a participant joins a retro THEN the System SHALL use the same team-PIN / access-token entry flow as pulse
2. WHEN a participant joins a retro for the first time THEN the System SHALL assign a persistent Participant_Token and store it in the browser
3. WHEN a participant returns to the same retro THEN the System SHALL reuse the existing Participant_Token
4. THE System SHALL associate every card and vote with the authoring Participant_Token on the server
5. WHEN the participant enters their display name THEN the System SHALL store it for attribution and reuse it within the session

### Requirement 5: Card Capture (Gather Phase)

**User Story:** As a participant, I want to add multiple cards to lanes during the gather phase, so that I can share all my feedback.

#### Acceptance Criteria

1. WHILE the board phase is "gather" THE System SHALL allow a participant to add one or more cards to any lane
2. WHEN a participant adds a card THEN the System SHALL require non-empty text of at most 2000 characters after trimming
3. WHILE the board phase is "gather" THE System SHALL allow a participant to edit or delete cards they authored
4. WHILE the board phase is "gather" THE System SHALL NOT allow a participant to edit or delete cards authored by others
5. WHEN a participant adds, edits, or deletes their own card THEN the System SHALL apply the change optimistically in that participant's view
6. WHILE the board phase is not "gather" THE System SHALL prevent adding new cards

### Requirement 6: Anonymity and Reveal

**User Story:** As a facilitator, I want cards to be anonymous by default and reveal them when ready, so that participants contribute candidly.

#### Acceptance Criteria

1. WHEN a Retro_Board is created THEN the System SHALL default cards to anonymous display
2. WHILE cards are anonymous THE System SHALL NOT include author identity in payloads sent to participants other than the author
3. WHILE cards are anonymous THE System SHALL still allow the authoring participant to identify and manage their own cards
4. WHEN the facilitator reveals the board THEN the System SHALL display cards according to the reveal stage, exposing author names only when the facilitator has disabled anonymisation
5. WHILE the board phase is "gather" AND not revealed THE System SHALL show only aggregate card counts per lane to non-author participants

### Requirement 7: Voting (Vote Phase)

**User Story:** As a participant, I want to vote on cards during the vote phase within a limit, so that the team can prioritise.

#### Acceptance Criteria

1. WHILE the board phase is "vote" THE System SHALL allow a participant to cast votes on cards
2. THE System SHALL prevent any participant from casting more than the board's votes-per-user cap in total
3. THE System SHALL prevent a participant from casting more than one vote on the same card
4. WHILE the board phase is not "vote" THE System SHALL prevent casting or changing votes
5. WHEN the board is revealed during the vote phase THEN the System SHALL show running vote counts per card
6. WHILE voting THE System SHALL keep individual voter identities hidden from other participants

### Requirement 8: Facilitator Phase Control

**User Story:** As a facilitator, I want to move the retro through its phases, so that I control the flow of the session.

#### Acceptance Criteria

1. THE System SHALL allow the facilitator to advance the board phase in order: gather → vote → closed
2. WHEN the facilitator advances or changes the phase THEN the System SHALL apply the phase rules for card capture and voting accordingly
3. WHILE the board phase is "closed" THE System SHALL make the board read-only for participants
4. WHILE the board phase is "closed" THE System SHALL reject card creation, card edits, card deletion, and vote operations from participants
5. THE System SHALL surface retro phase controls within the existing Facilitate dashboard pattern

### Requirement 9: Desktop and Mobile Rendering

**User Story:** As a participant, I want the board to work on my phone and on desktop, so that I can join from any device.

#### Acceptance Criteria

1. WHEN the board is viewed on desktop THEN the System SHALL render lanes positioned per their layout, over an optional background image
2. WHEN a lane has no defined position THEN the System SHALL render lanes in an evenly spaced column layout
3. WHEN the board is viewed on mobile THEN the System SHALL render lanes as a vertical stack ordered by display order, with the board title or image as a header
4. WHEN the board is viewed on mobile THEN the System SHALL provide touch-friendly controls for adding, editing, and voting on cards
5. THE System SHALL implement the retro board as a component independent of the existing pulse canvas placement code

### Requirement 10: Export

**User Story:** As a facilitator, I want to export the retro outcomes, so that the team retains a record across sprints.

#### Acceptance Criteria

1. WHEN the facilitator exports a board THEN the System SHALL produce a structured file containing lanes, cards, card text, vote counts, and author names where revealed
2. THE System SHALL provide the export in at least one machine-readable format (JSON or CSV)
3. THE System SHALL exclude retro data from the 90-day automated purge so that boards and exports persist across sprints

### Requirement 11: Preservation of Pulse Behavior

**User Story:** As an existing facilitator, I want all current pulse functionality to remain unchanged, so that live retros and polls keep working.

#### Acceptance Criteria

1. WHEN the `type` discriminator is added to the Poll model THEN the System SHALL leave all existing pulse poll behavior unchanged
2. THE System SHALL NOT modify the existing Question or Response tables for Phase 2A
3. WHEN a pulse poll is created, edited, run, or its results viewed THEN the System SHALL behave identically to the pre-Phase-2 implementation
4. THE System SHALL keep the existing pulse property-based and unit test suites passing without modification to their expected behavior
5. WHILE the Feature_Flag is false THE System SHALL present an experience indistinguishable from the pre-Phase-2 product
