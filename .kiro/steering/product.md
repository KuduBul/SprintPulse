# SprintPulse

SprintPulse is a web-based facilitation tool for live polling, retrospectives, and team engagement sessions. It targets internal teams running agile ceremonies.

## Core Capabilities

- **Pulse Polls**: Visual drag-and-drop canvas editor for creating polls with positioned questions over background images. Facilitators control voting windows, staged result reveals, and anonymisation in real time.
- **Retro Boards** (Phase 2, feature-flagged): Collaborative retrospective boards with templates (Start/Stop/Continue, 4Ls, Mad/Sad/Glad, custom). Supports card gathering, dot-voting with per-user caps, and PDF export.
- **Team Management**: PIN-based team access, team-scoped poll lists.
- **Participant Experience**: QR code sharing, session-token-based duplicate prevention, no login required for participants.

## Key Domain Concepts

- **Facilitator**: Authenticated user who creates and controls polls/retros.
- **Participant**: Anonymous user who joins via link/QR/PIN and submits responses.
- **FacilitatorState**: JSON blob on each poll controlling voting, reveal, and anonymisation.
- **Feature Flags**: Retro functionality gated behind `NEXT_PUBLIC_RETRO_ENABLED`.
- **Soft Deletes**: Records use `isDeleted` flag rather than hard deletion.
- **Audit Logging**: All facilitator mutations logged transactionally.
