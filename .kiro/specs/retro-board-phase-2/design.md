# Design Document: Retro Board (Phase 2A)

## Overview

SprintPulse Phase 2 evolves the product from a polling tool into a unified facilitation platform with **one front-end experience** and **two specialised engines**: the existing **Pulse** engine (structured response aggregation) and a new **Retro** engine (collaborative capture → reveal → vote → export). This document designs **Phase 2A**: the thinnest viable interactive retro board.

The work is constrained by five locked decisions captured in `decisions.md`. The most important: all work lives on the `phase-2-retro` branch behind a `NEXT_PUBLIC_RETRO_ENABLED` flag and must not reach production until the owner declares readiness.

## Goals (Phase 2A)

- A facilitator can create a **Retro** activity (vs a Pulse poll) from a single, shared entry point.
- A retro has **lanes** (e.g. "Went well", "Didn't go well", "Ideas") chosen from a small set of built-in templates.
- Participants join via the same team-PIN / token flow and **add multiple cards** into lanes during the gather phase.
- Cards are **anonymous by default**; the facilitator controls **reveal/hide** via the existing reveal-stage framework.
- Participants can **vote** on cards (simple, capped) during a vote phase.
- The facilitator can **export** all cards and vote counts.
- Everything works on **desktop and mobile**.

## Non-Goals (Phase 2A)

Clustering, drag-between-lanes, action items, templates-as-data, board duplication, AI, integrations, cross-sprint history, and WebSocket transport are explicitly deferred (see `decisions.md`).

## Architecture

### One product, two engines (modular monolith)

```mermaid
graph TB
    subgraph "Single Front End (Next.js)"
        ENTRY[Shared entry: login, team PIN, activity list]
        SEL[Create Activity: Pulse | Retro selector]
        PULSE_UI[Pulse UI - unchanged]
        RETRO_UI[Retro Board UI - new]
    end

    subgraph "Shared Platform Layer"
        AUTH[Auth / facilitator profiles]
        TEAM[Teams / PIN / access tokens]
        SESSION[Session lifecycle + reveal-state framework]
        IMG[Image upload / storage]
        AUDIT[Audit logging]
        FLAG[Feature flag: NEXT_PUBLIC_RETRO_ENABLED]
    end

    subgraph "Pulse Module (existing)"
        PSVC[pollService / responseService]
    end

    subgraph "Retro Module (new)"
        RSVC[retroService: boards, lanes, cards, votes]
    end

    subgraph "Supabase Postgres"
        POLL[(Poll + type discriminator)]
        RETRO[(RetroBoard / RetroLane / RetroCard / RetroVote)]
    end

    ENTRY --> SEL
    SEL --> PULSE_UI --> PSVC --> POLL
    SEL --> RETRO_UI --> RSVC --> RETRO
    RETRO_UI -. gated by .-> FLAG
    PSVC --> AUTH & TEAM & SESSION & IMG & AUDIT
    RSVC --> AUTH & TEAM & SESSION & IMG & AUDIT
```

### Feature-flag gating

A single boolean drives all retro visibility:

```ts
// lib/featureFlags.ts
export const RETRO_ENABLED = process.env.NEXT_PUBLIC_RETRO_ENABLED === 'true';
```

- Server: retro API routes return 404 when `RETRO_ENABLED` is false (route appears not to exist).
- Client: the Pulse/Retro selector renders Pulse-only; retro nav links and `/retro/*` pages are hidden/redirect.
- Production env never sets the variable, so it is always `false` there.

## Data Models

### Shared shell: additive change to `Poll`

`Poll` becomes the shared "activity" shell. Only an additive, defaulted column is introduced — existing rows and pulse logic are untouched.

```prisma
model Poll {
  // ... all existing fields unchanged ...
  type  String  @default("pulse")  // "pulse" | "retro"
  retroBoard RetroBoard?           // null for pulse polls
}
```

Rationale for reusing `Poll` as the shell rather than renaming to `Activity`: a rename is a large, risky refactor across the live codebase for no Phase 2A benefit. The `type` discriminator gives us the branch point now; a future rename can be considered in 2C if it pays for itself.

### New retro tables

```prisma
model RetroBoard {
  id            String   @id @default(uuid())
  pollId        String   @unique           // 1:1 with the Poll shell
  template      String                      // "start_stop_continue" | "4ls" | "mad_sad_glad" | "custom"
  phase         String   @default("gather") // "gather" | "vote" | "closed"
  votesPerUser  Int      @default(3)        // cap enforced during vote phase
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  poll          Poll       @relation(fields: [pollId], references: [id])
  lanes         RetroLane[]
  cards         RetroCard[]
  votes         RetroVote[]

  @@index([pollId])
}

model RetroLane {
  id           String  @id @default(uuid())
  boardId      String
  title        String  @db.VarChar(100)
  displayOrder Int
  // Percentage-based position for the desktop board; null => simple column layout.
  position     Json?   // { x, y, width, height } | null  (concept reused, NEW component)

  board        RetroBoard  @relation(fields: [boardId], references: [id])
  cards        RetroCard[]

  @@index([boardId])
}

model RetroCard {
  id           String   @id @default(uuid())
  boardId      String
  laneId       String
  // Author identity: persistent per-session participant token (see Participant Identity).
  authorToken  String
  authorName   String   @db.VarChar(50)
  text         String   @db.Text
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  board        RetroBoard  @relation(fields: [boardId], references: [id])
  lane         RetroLane   @relation(fields: [laneId], references: [id])
  votes        RetroVote[]

  @@index([boardId])
  @@index([laneId])
  @@index([authorToken])
}

model RetroVote {
  id           String   @id @default(uuid())
  boardId      String
  cardId       String
  voterToken   String   // same persistent participant token
  createdAt    DateTime @default(now())

  board        RetroBoard @relation(fields: [boardId], references: [id])
  card         RetroCard  @relation(fields: [cardId], references: [id])

  // One vote per card per voter; total per voter capped in service logic.
  @@unique([cardId, voterToken])
  @@index([boardId])
  @@index([voterToken])
}

// Defined now for schema stability; populated in Phase 2B.
model RetroActionItem {
  id        String   @id @default(uuid())
  boardId   String
  text      String   @db.Text
  owner     String?  @db.VarChar(100)
  dueDate   DateTime?
  createdAt DateTime @default(now())

  @@index([boardId])
}
```

### Migration approach (additive, zero-downtime)

1. Add `Poll.type` with default `"pulse"` → all existing rows become `pulse` automatically. No backfill needed.
2. Create the new retro tables. No change to `Question`/`Response`, so pulse is provably unaffected.
3. Update the purge cron to exclude retro tables (Decision 5).

Because the only change to existing tables is one defaulted column, the migration is reversible and safe to run against the live database when the branch eventually ships.

## Participant Identity Across Retro Phases

Pulse uses a lightweight stateless `sessionToken` (one submission, then done). Retro needs a **persistent per-participant identity** so a participant can edit/delete their own cards during gather and have their votes counted (and capped) during vote.

Design:
- On joining a retro, the participant gets a `participantToken` (UUID) stored in `localStorage` (mirrors the existing name-remembering behavior).
- `RetroCard.authorToken` and `RetroVote.voterToken` reference this token.
- Anonymity is a **display** concern, not a storage one: the server always knows the author token (so the author can edit and the facilitator can manage), but the API **omits author identity** from payloads sent to other participants while the board is anonymous. Reveal stage controls whether names are exposed, reusing the existing reveal-state framework (HIDDEN / COUNTS / DETAILS mapped onto gather/vote/closed semantics).

## Retro Board Component (new, mobile-first)

Per Decision 4, this is a **new** component, independent of the existing canvas placement code.

- **Desktop:** lanes positioned on the board. If `RetroLane.position` is set, lanes render at percentage coordinates over an optional background image; otherwise they fall back to an evenly-spaced column layout.
- **Mobile:** lanes render as a **vertical stack** of columns; the board title/image shows as a header. Card add/edit/vote controls are touch-friendly. The desktop positioning is ignored on mobile (stacked order = `displayOrder`).
- **Card interactions (2A):** add card to a lane, edit/delete own card (gather phase), vote on a card (vote phase). No drag-between-lanes in 2A.
- The component reads board state from the polling-refreshed store and applies optimistic updates for the author's own actions.

## Facilitator Phase Control

Reuses the session/reveal framework. The retro board has three phases driving what participants can do:

| Phase    | Participants can…                          | Others see…                         |
|----------|--------------------------------------------|-------------------------------------|
| `gather` | add/edit/delete own cards                  | card counts only (anonymous)        |
| `vote`   | cast up to `votesPerUser` votes            | cards revealed, running vote counts |
| `closed` | read-only                                  | full board + vote totals + export   |

The facilitator advances phases from the Facilitate dashboard (extended with a retro variant). Voting open/close and reveal map onto the existing control concepts.

## Real-time Strategy (MVP)

Per Decision 3: reuse `setInterval` polling. The participant board and facilitator dashboard poll board state on the same cadence as pulse. The author's own card/vote actions are optimistic. The schema (token-based authorship, vote uniqueness) is already shaped so Supabase Realtime subscriptions can replace polling in 2B without data changes.

## Export (2A)

Facilitator can export the closed board as structured data (JSON and/or CSV): lanes → cards → text, author (if revealed), and vote count. Implemented as a server route that reads the board and streams a file. Retro data is exempt from the 90-day purge so exports remain available across sprints.

## Components and Interfaces

### Retro service (server)

`lib/services/retroService.ts` — the retro domain module. All methods enforce phase rules and the vote cap server-side.

```ts
interface RetroService {
  createBoard(pollId: string, input: CreateBoardInput): Promise<RetroBoard>;
  getBoard(pollId: string, viewer: ViewerContext): Promise<BoardView>;   // anonymity applied per viewer
  addCard(boardId: string, input: AddCardInput): Promise<RetroCard>;     // gather only
  editCard(cardId: string, authorToken: string, text: string): Promise<RetroCard>; // own card, gather only
  deleteCard(cardId: string, authorToken: string): Promise<void>;        // own card, gather only
  castVote(boardId: string, cardId: string, voterToken: string): Promise<void>;  // vote only, cap enforced
  removeVote(boardId: string, cardId: string, voterToken: string): Promise<void>;
  setPhase(boardId: string, phase: 'gather' | 'vote' | 'closed'): Promise<RetroBoard>; // facilitator only
  exportBoard(boardId: string, format: 'json' | 'csv'): Promise<ExportPayload>;
}

interface ViewerContext { role: 'facilitator' | 'participant'; participantToken?: string; }
```

- `getBoard` returns a `BoardView` that has already stripped author identity for cards the viewer does not own while the board is anonymous (Requirement 6).
- `castVote` checks both the per-card uniqueness and the per-user total cap before writing (Requirement 7).
- `setPhase` is restricted to the authenticated facilitator who owns the poll (Requirement 8).

### API routes (server)

All routes return 404 when `RETRO_ENABLED` is false (Requirement 1).

| Route | Method | Purpose | Phase guard |
|-------|--------|---------|-------------|
| `/api/polls` (extended) | POST | Create activity with `type: "retro"` | — |
| `/api/retro/[boardId]` | GET | Fetch board view (anonymity applied) | any |
| `/api/retro/[boardId]/cards` | POST | Add card | gather |
| `/api/retro/[boardId]/cards/[cardId]` | PATCH/DELETE | Edit/delete own card | gather |
| `/api/retro/[boardId]/votes` | POST/DELETE | Cast/remove vote | vote |
| `/api/retro/[boardId]/phase` | POST | Advance phase (facilitator) | facilitator |
| `/api/retro/[boardId]/export` | GET | Export board (facilitator) | closed (recommended) |

### Client components

- `RetroBoardView` — new, mobile-first board renderer (desktop positioned lanes / mobile stacked). Independent of pulse canvas code (Requirement 9.5).
- `RetroCard` — sticky-note card with author-only edit/delete affordances.
- `RetroFacilitatorControls` — phase advance + reveal/anonymise + export, embedded in the existing Facilitate dashboard.
- `ActivityTypeSelector` — Pulse/Retro choice at creation, gated by the flag.
- `lib/featureFlags.ts` — exports `RETRO_ENABLED`.

## Correctness Properties

These are the highest-value invariants for property-based testing (fast-check + Vitest):

Property 1: Vote cap invariant — for any sequence of vote operations by a single `voterToken` on a board with cap `N`, the number of that voter's stored votes never exceeds `N`.

**Validates: Requirements 7.2**

Property 2: One-vote-per-card invariant — for any voter and card, at most one `RetroVote` row exists (enforced by `@@unique([cardId, voterToken])` and service logic).

**Validates: Requirements 7.3**

Property 3: Phase-gate invariant — card creation succeeds only while phase is `gather`; vote operations succeed only while phase is `vote`; in `closed` no participant mutation succeeds.

**Validates: Requirements 5.1, 5.6, 7.1, 7.4, 8.3**

Property 4: Ownership invariant — a card can be edited or deleted only by a request bearing its `authorToken`.

**Validates: Requirements 5.3, 5.4**

Property 5: Anonymity invariant — for any board in anonymous state, a `getBoard` view rendered for participant A never contains author identity for cards authored by participant B.

**Validates: Requirements 6.2, 6.3, 7.6**

Property 6: Pulse preservation invariant — for all pulse operations, behavior and outputs are identical before and after the Phase 2 schema change (existing pulse PBT suite stays green).

**Validates: Requirements 11.1, 11.3, 11.4**

## Error Handling

- **Flag-off access:** retro routes return HTTP 404 (not 403) so the feature's existence is not revealed in production (Requirement 1.2).
- **Phase violations:** mutations attempted in the wrong phase return HTTP 409 Conflict with a code (e.g. `WRONG_PHASE`); the client surfaces a non-destructive message and re-syncs board state.
- **Vote cap exceeded:** returns HTTP 409 with code `VOTE_CAP_EXCEEDED`; the optimistic vote is rolled back in the client.
- **Ownership violation:** edit/delete of a non-owned card returns HTTP 403 `NOT_CARD_OWNER`.
- **Validation errors:** empty/over-length card text or invalid lane config return HTTP 400 with field-level messages, mirroring the existing pulse validation pattern.
- **Optimistic rollback:** any failed optimistic action (add/edit/delete/vote) reverts the local change on the next poll cycle or immediately on error response.
- **Not found / expired token:** joining with an invalid or expired access token reuses the existing pulse error path.

## Testing Strategy

- **Property-based tests (fast-check + Vitest):** the retro state machine is the highest-value PBT target — phase transitions (gather→vote→closed), vote-cap invariants (no voter exceeds `votesPerUser`; `@@unique([cardId, voterToken])` holds), and anonymity invariants (no author identity leaks to other participants while anonymous).
- **Preservation tests:** prove pulse behavior is unchanged after adding `Poll.type` and the new tables (existing pulse PBT suite must stay green).
- **Component tests:** retro board renders correctly desktop vs mobile; gated correctly by the feature flag.
- **Migration test:** existing pulse rows default to `type="pulse"`; purge cron skips retro tables.

## Phased Roadmap

- **Phase 2A (this design):** create retro, lanes from built-in templates, add cards, anonymous-by-default, reveal/hide, basic capped voting, export, desktop+mobile. Behind flag, on branch.
- **Phase 2B:** clustering/grouping, drag cards between lanes, action items (owner + due date), carry-forward actions, swap polling → Supabase Realtime.
- **Phase 2C:** template library (templates-as-data), board duplication, AI clustering/summarisation, Jira/ADO export, cross-sprint history/compare.

## Risks

| Risk | Mitigation |
|------|------------|
| Retro code accidentally reaching prod | Branch isolation + feature flag default false + flag absent in prod env |
| Interval polling feels laggy with many cards | Optimistic UI for own actions in 2A; Realtime planned for 2B |
| Reusing canvas drags in known mobile bugs | New board component, independent of existing canvas code |
| `Poll.type` migration risk to live pulse | Single additive defaulted column; no change to Question/Response |
| Retro boards lost to 90-day purge | Purge cron updated to exclude retro tables |
| Scope creep | 2A non-goals explicitly listed; phases gate further work |
