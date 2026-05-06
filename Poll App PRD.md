# Product Requirements Document (PRD)
## Shoprite‑X Polling & Live Facilitation App

---

## 1. Overview

### 1.1 Purpose
The Shoprite‑X Polling & Live Facilitation App is a **web‑based internal tool** designed to support **workshops, retrospectives, PI events, and engagement sessions**. It enables facilitators to create visually rich polls, collect structured and free‑text input, and **control how and when results are revealed in live sessions**.

The product prioritises:
- Psychological safety
- Professional, enterprise‑grade UX
- Facilitator control
- Auditability and data governance

---

### 1.2 Target Users

| Persona | Description |
|------|-------------|
| **Admin / Facilitator** | Scrum Masters, Coaches, RTEs, Workshop Facilitators |
| **Participant** | Team members attending a session |
| **Viewer (Future)** | Managers or stakeholders reviewing results |

---

### 1.3 Key Differentiators

- Visual **drag‑and‑drop question placement** on custom images
- **Facilitator Mode** with live controls (lock voting, staged reveal)
- Support for **custom free‑text answers**
- Enterprise‑ready **audit logging and data retention**
- Built on **Supabase Postgres + Prisma** for scalability and reporting

---

## 2. Goals & Success Criteria

### 2.1 Product Goals
- Enable fast creation of visually engaging polls
- Support live facilitation with controlled result reveal
- Ensure psychological safety during feedback sessions
- Provide reliable persistence and auditability
- Be easy to deploy and operate internally (Vercel + Supabase)

### 2.2 Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Poll creation time | < 5 minutes for a 5‑question poll | Timed usability test with 3 facilitators |
| Facilitator intervention during voting | Zero manual workarounds needed | Post‑session facilitator survey (Likert 1–5) |
| Poll reuse rate | ≥ 30% of polls reused across sessions | Database query on cloned polls |
| Live result latency | < 3 seconds from vote to display | Automated performance test |
| Facilitator satisfaction | ≥ 4.0 / 5.0 average | Post‑session survey after first 10 sessions |
| System uptime during sessions | 99.5% | Vercel + Supabase monitoring dashboards |

---

## 3. In‑Scope Features (Phase 1)

### 3.1 Priority Matrix (MoSCoW)

| Priority | Feature |
|----------|---------|
| **Must Have** | Poll CRUD, question management, participant voting, facilitator controls (open/close voting, reveal stages), audit logging |
| **Must Have** | Visual canvas editor with drag‑and‑drop question placement |
| **Must Have** | Participant name entry and response submission |
| **Should Have** | Background image upload for canvas |
| **Should Have** | Free‑text custom answer option |
| **Should Have** | Facilitator test mode (preview as participant) |
| **Should Have** | Anonymisation toggle |
| **Could Have** | Print‑friendly results view |
| **Could Have** | Poll cloning (reuse) |
| **Won't Have (this phase)** | PDF export, Supabase Auth, RLS, Realtime subscriptions, cross‑poll analytics |

### 3.2 Delivery Phases

| Phase | Scope | Target |
|-------|-------|--------|
| Phase 1 | Core polling, facilitator mode, canvas editor, audit logging | MVP |
| Phase 2 | Authentication (Supabase Auth), RLS, poll templates, PDF export | Post‑MVP |
| Phase 3 | Realtime subscriptions, presenter mode, cross‑poll analytics | Future |

---

## 4. Functional Requirements

### 4.1 Poll Administration

#### 4.1.1 Authentication & Roles

**Interim mechanism (Phase 1):**
- Admin access gated by a shared secret passed as an environment variable (`ADMIN_SECRET`)
- Admin routes require an `x-admin-token` header matching the secret
- No user accounts or sessions in Phase 1

**Accepted risks:**
- Anyone with the token has full admin access
- No per‑user attribution on admin actions (audit logs record "admin" as actor)

**Future (Phase 2):**
- Supabase Auth with email/password or SSO
- Role types: `ADMIN`, `VIEWER` (read‑only)
- Row Level Security policies on all tables

---

#### 4.1.2 Poll Management

Admins can:
- Create and edit polls
- Define poll metadata:
  - Title (required, max 200 characters)
  - Optional description (max 1000 characters)
  - Optional background image (JPEG/PNG/WebP, max 5 MB)
- Reset all responses for a poll (with confirmation prompt)
- Clone an existing poll for a new session (creates a new poll with identical questions but no responses; original poll and its data remain untouched)
- Delete a poll (soft delete; data retained per retention policy)

**Acceptance Criteria:**
- AC1: Creating a poll with title only succeeds and poll appears in admin list
- AC2: Uploading an image > 5 MB shows a validation error before submission
- AC3: Resetting responses removes all response records and logs the action
- AC4: Cloning a poll produces a new poll with `(Copy)` suffix in title and zero responses
- AC5: Deleting a poll hides it from all views but retains data for audit purposes

---

#### 4.1.3 Questions

Each poll supports 1–20 questions.

Each question:
- Has a text prompt (required, max 500 characters)
- Has 2–10 predefined options
- May include a **"Custom" free‑text option** (enabled per question)
- Has an optional visual position on the canvas (percentage‑based x/y coordinates)
- Has a display order (integer, used for list fallback)

**Acceptance Criteria:**
- AC1: A poll cannot be saved with zero questions
- AC2: Adding an 11th option to a question shows a validation error
- AC3: Enabling the custom option adds a free‑text input field for participants
- AC4: Questions without canvas positions appear in the sidebar as "unplaced"

---

## 5. Visual Poll Editor (PollCanvas)

### 5.1 Description
The PollCanvas is a visual editor that allows admins to place questions on a background image using drag‑and‑drop.

### 5.2 Functional Behaviour
- Questions start in a sidebar (unplaced)
- Questions can be dragged onto the canvas
- Once placed, questions can be:
  - Repositioned (drag)
  - Resized (corner handles)
  - Returned to sidebar (right‑click → "Remove from canvas")
- Positions are stored as **percentage‑based coordinates** (relative to canvas dimensions)
- If no background image is set, a neutral grey canvas is shown

### 5.3 Edge Cases
- **Image fails to load:** Show placeholder with error message; questions remain interactive
- **Browser doesn't support Drag and Drop API:** Show a warning banner and fall back to coordinate input fields
- **Overlapping questions:** Allowed; last‑placed question renders on top (z‑index by placement order)

### 5.4 Responsiveness

| Viewport | Behaviour |
|----------|-----------|
| Desktop (≥ 1024px) | Full canvas editor with drag‑and‑drop |
| Tablet (768–1023px) | Canvas view‑only for facilitators; editing requires desktop |
| Mobile (< 768px) | Automatic fallback to vertical question list; no canvas interactions |

### 5.5 Acceptance Criteria
- AC1: Dragging a question from sidebar to canvas saves its position on drop
- AC2: Positions persist after page reload
- AC3: On mobile, all questions render as a scrollable vertical list regardless of canvas positions
- AC4: A question removed from canvas reappears in the sidebar

---

## 6. Poll Participation (Public View)

### 6.1 Access
- Public access via unique poll URL (`/poll/{pollId}`)
- No authentication required

### 6.2 Participant Identity

**Mechanism:**
- Participant enters a display name (required, 2–50 characters)
- A session token is generated and stored in `localStorage` to prevent duplicate submissions from the same browser
- The session token is tied to the poll ID + participant name combination

**Constraints:**
- Same name from different browsers/devices is treated as a different participant
- If a participant refreshes mid‑session, their progress is restored via the session token
- No global deduplication (acceptable trade‑off for Phase 1 given no auth)

**Accepted risks:**
- A determined user could vote multiple times using incognito/different devices
- Mitigation: facilitator can reset responses if abuse is detected

### 6.3 Participant Flow
1. Participant opens poll URL
2. If voting is closed, a "Voting is currently closed" message is displayed (no name entry)
3. Participant enters their name
4. Participant sees all questions (canvas layout on desktop, list on mobile)
5. Participant answers all questions
6. Participant submits responses
7. Confirmation screen shown; no further edits allowed

### 6.4 Submission Validation
Submission is blocked (with inline error messages) if:
- Name is missing or < 2 characters
- Any question is unanswered
- Custom free‑text field is selected but left empty
- Voting has been closed by the facilitator (race condition: show "Voting closed" message)

### 6.5 Concurrent Submission Edge Case
- If a facilitator closes voting while a participant is mid‑form:
  - The submit button becomes disabled
  - A banner appears: "Voting has been closed by the facilitator"
  - Partial answers are **not** saved
  - Participant can copy their free‑text answers before navigating away

### 6.6 Acceptance Criteria
- AC1: A participant cannot submit without answering all questions
- AC2: Refreshing the page after entering a name restores the name field
- AC3: Submitting the same poll from the same browser a second time shows "Already submitted"
- AC4: If voting closes mid‑session, the submit button disables within 5 seconds (next poll cycle)

---

## 7. Facilitator Mode (Live Sessions)

### 7.1 Purpose
Facilitator Mode enables **real‑time control** during live sessions.

### 7.2 Controls

| Control | Description | Default |
|---------|-------------|---------|
| Open / Close voting | Enables or disables participant submissions | Closed |
| Live result updates | Toggles automatic result refresh | Off |
| Anonymise names | Hides participant names from results view | On |
| Reveal stage | Controls what data is visible | HIDDEN |

**Reveal Stages:**
- `HIDDEN` – no results shown to participants/viewers
- `COUNTS` – option totals only (bar chart)
- `DETAILS` – free‑text responses and participant names (if anonymisation is off)

### 7.3 Concurrency
- Only one facilitator session is active per poll at a time
- If a second facilitator opens the same poll's facilitator view, they see a warning: "Another facilitator session may be active"
- No hard lock — both can operate, but last‑write‑wins on state changes
- All state changes are audit‑logged with timestamp for conflict resolution

### 7.4 Live View
- Displays aggregated results per question
- Updates automatically while live results are enabled
- Polling interval: **3 seconds** (configurable via environment variable `POLL_INTERVAL_MS`)
- Displays participant count and submission count in real time

### 7.5 Edge Cases
- **Zero responses when results revealed:** Show "No responses yet" placeholder per question
- **Poll with no questions:** Facilitator view shows "Add questions before starting a session"

### 7.6 Acceptance Criteria
- AC1: Toggling "Close voting" prevents new submissions within one poll cycle (≤ 3s)
- AC2: Changing reveal stage from HIDDEN to COUNTS shows aggregated totals immediately
- AC3: Enabling anonymisation replaces participant names with "Participant 1, 2, …" in results
- AC4: Facilitator state persists across page refresh
- AC5: All facilitator actions appear in the audit log within 1 second

### 7.7 Test Mode (Facilitator Preview)

**Purpose:** Allows a facilitator to experience the poll exactly as a participant would, without polluting real response data.

**Behaviour:**
- Activated via a "Preview as Participant" button in the facilitator view
- Opens the participant view in a new tab/modal with a `?testMode=true` flag
- Responses submitted in test mode are tagged with `isTest: true` and excluded from real results
- Test responses are visible in a separate "Test Responses" tab in the facilitator view
- Facilitator can clear all test responses with a single action

**Constraints:**
- Test mode respects the current facilitator state (voting open/closed, reveal stage)
- Test responses do not increment the participant count shown in live view
- Test responses are purged with the same retention policy as real responses

**Acceptance Criteria:**
- AC1: Submitting in test mode does not appear in the public results view
- AC2: Facilitator can see test responses separately from real responses
- AC3: Clearing test responses does not affect real participant data
- AC4: Test mode honours the current voting open/closed state

---

## 8. Results & Reporting

### 8.1 Aggregation
Results are aggregated per question:
- Count per predefined option
- Percentage per option (relative to total responses for that question)
- List of free‑text responses (grouped under "Custom")
- Optional participant list (shown only when anonymisation is off and reveal stage is DETAILS)

### 8.2 Privacy
- Participant names hidden by default (anonymisation ON)
- Revealed only if facilitator explicitly disables anonymisation AND sets reveal to DETAILS
- Two deliberate actions required — prevents accidental exposure

### 8.3 Empty States
- Question with zero responses: "No responses yet"
- Free‑text option with no entries: Section hidden entirely

### 8.4 Printing & Export (Phase 2)
- Print‑friendly layout (CSS `@media print`)
- PDF export via server‑side rendering

### 8.5 Acceptance Criteria
- AC1: Results page shows correct counts matching database records
- AC2: Percentages sum to 100% (±1% due to rounding)
- AC3: Free‑text responses are displayed verbatim without truncation
- AC4: With anonymisation on, no participant names appear anywhere in the DOM

---

## 9. Data Model Overview

### 9.1 Core Entities

```
Poll
├── id (UUID, PK)
├── title (string)
├── description (string, nullable)
├── backgroundImageUrl (string, nullable)
├── facilitatorState (JSON)
├── isDeleted (boolean, default false)
├── createdAt (timestamp)
└── updatedAt (timestamp)

Question
├── id (UUID, PK)
├── pollId (FK → Poll)
├── text (string)
├── options (JSON array)
├── allowCustom (boolean)
├── position (JSON: {x, y, width, height} | null)
├── displayOrder (integer)
├── createdAt (timestamp)
└── updatedAt (timestamp)

Response
├── id (UUID, PK)
├── pollId (FK → Poll)
├── questionId (FK → Question)
├── participantName (string)
├── sessionToken (string)
├── selectedOption (string)
├── customText (string, nullable)
├── isTest (boolean, default false)
├── createdAt (timestamp)
└── updatedAt (timestamp)

AuditLog
├── id (UUID, PK)
├── pollId (FK → Poll, nullable)
├── action (enum)
├── actor (string)
├── metadata (JSON)
├── createdAt (timestamp)
└── (no updatedAt — immutable)
```

### 9.2 JSON Field Schemas

**facilitatorState:**
```json
{
  "votingOpen": false,
  "liveResults": false,
  "anonymise": true,
  "revealStage": "HIDDEN"
}
```

**question.position:**
```json
{
  "x": 25.5,
  "y": 10.0,
  "width": 20.0,
  "height": 15.0
}
```
All values are percentages (0–100).

**Migration strategy for JSON fields:**
- Schema version stored in a top‑level `_v` key (e.g., `"_v": 1`)
- Application code handles migration on read (transform old shape to current)
- No destructive migrations — old fields preserved until retention purge

### 9.3 Persistence
- Supabase Postgres
- Prisma ORM
- Indexes on: `Response.pollId`, `Response.questionId`, `Response.sessionToken`, `AuditLog.pollId`, `AuditLog.createdAt`

---

## 10. API Surface (High‑Level)

### 10.1 Admin Endpoints (require `x-admin-token`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/polls` | List all polls |
| POST | `/api/polls` | Create a poll |
| GET | `/api/polls/:id` | Get poll details |
| PATCH | `/api/polls/:id` | Update poll metadata |
| DELETE | `/api/polls/:id` | Soft‑delete a poll |
| POST | `/api/polls/:id/clone` | Clone a poll |
| POST | `/api/polls/:id/reset` | Reset all responses |
| POST | `/api/polls/:id/questions` | Add a question |
| PATCH | `/api/polls/:id/questions/:qId` | Update a question |
| DELETE | `/api/polls/:id/questions/:qId` | Delete a question |
| GET | `/api/polls/:id/facilitator` | Get facilitator state |
| PATCH | `/api/polls/:id/facilitator` | Update facilitator state |
| GET | `/api/polls/:id/results` | Get aggregated results |

### 10.2 Public Endpoints (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/polls/:id/public` | Get poll for participation (questions + facilitator state) |
| POST | `/api/polls/:id/respond` | Submit responses |
| GET | `/api/polls/:id/results/public` | Get results (respects reveal stage) |

### 10.3 System Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/system/purge` | Run data retention purge (cron‑triggered) |

---

## 11. Audit Logging

### 11.1 Logged Actions

| Action | Trigger |
|--------|---------|
| `POLL_CREATED` | Admin creates a poll |
| `POLL_UPDATED` | Admin updates poll metadata |
| `POLL_DELETED` | Admin soft‑deletes a poll |
| `POLL_CLONED` | Admin clones a poll |
| `QUESTION_CREATED` | Admin adds a question |
| `QUESTION_UPDATED` | Admin updates a question |
| `QUESTION_DELETED` | Admin deletes a question |
| `RESPONSES_SUBMITTED` | Participant submits responses |
| `RESPONSES_RESET` | Admin resets all responses |
| `FACILITATOR_SESSION_STARTED` | Admin opens facilitator mode |
| `FACILITATOR_STATE_UPDATED` | Any facilitator control change |
| `REVEAL_STAGE_CHANGED` | Facilitator changes reveal stage (subset of above, explicit for traceability) |
| `VOTING_OPENED` | Facilitator opens voting |
| `VOTING_CLOSED` | Facilitator closes voting |
| `DATA_PURGED` | Retention purge executed |

### 11.2 Purpose
- Governance and compliance
- Traceability of sensitive actions (reveal, anonymisation changes)
- Operational diagnostics and incident investigation

---

## 12. Data Retention Policy

| Data Type | Retention | Justification |
|-----------|-----------|---------------|
| Poll responses | 90 days (configurable via `RETENTION_RESPONSES_DAYS`) | Storage cost; polls are session‑specific |
| Audit logs | 12 months (configurable via `RETENTION_AUDIT_DAYS`) | Compliance and governance requirements |
| Soft‑deleted polls | 30 days then hard‑delete | Grace period for accidental deletion |

- Automated purge endpoint (`/api/system/purge`)
- Triggered via Vercel Cron (daily at 02:00 UTC)
- Purge actions are themselves audit‑logged

---

## 13. Non‑Functional Requirements

### 13.1 Security
- Admin routes protected by shared secret (Phase 1) / Supabase Auth (Phase 2)
- Server‑side validation on all inputs (Zod schemas)
- No client‑trusted writes — all mutations go through API routes
- Rate limiting: 60 requests/minute per IP on public endpoints
- Input sanitisation for free‑text fields (prevent XSS in results display)

### 13.2 Performance & Scale

| Metric | Target |
|--------|--------|
| Concurrent participants per poll | 100 |
| API response time (p95) | < 500ms |
| Poll result refresh latency | ≤ 3 seconds |
| Maximum polls in system | 1000 (before retention purge) |
| Database connection pool | 10 connections (Supabase free tier) |

### 13.3 Accessibility
- Keyboard navigation for all interactive elements
- Semantic HTML (`<main>`, `<nav>`, `<section>`, `<button>`)
- ARIA labels on canvas‑placed questions
- Colour contrast ratio ≥ 4.5:1 (WCAG AA)
- Focus indicators visible on all interactive elements
- Screen reader announcements for facilitator state changes

### 13.4 Maintainability
- Strong typing (TypeScript strict mode + Zod runtime validation)
- Clear separation of concerns (API routes → service layer → data access)
- Modular components (< 200 lines per component file)
- Consistent error handling pattern across all API routes

### 13.5 Reliability & Recovery
- **Backup:** Supabase automated daily backups (point‑in‑time recovery on Pro plan)
- **Outage during live session:** Facilitator sees "Connection lost" banner; app retries with exponential backoff; no data loss for already‑submitted responses
- **Deployment during session:** Vercel's atomic deployments ensure no partial states; in‑flight requests complete on old version

---

## 14. Dependencies & Risks

### 14.1 External Dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Supabase (database) | Outage during live session | Retry logic; facilitator can pause session |
| Vercel (hosting) | Cold start latency on serverless functions | Keep functions warm via cron ping; optimise bundle size |
| Browser Drag and Drop API | Not supported on older mobile browsers | Feature detection + graceful fallback to list view |
| localStorage | Disabled in some enterprise browsers | Fallback to cookie‑based session token |

### 14.2 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Supabase free tier connection limits hit during large session | Medium | High | Monitor connections; upgrade plan if > 50 concurrent users expected |
| JSON schema drift in facilitatorState | Low | Medium | Versioned schema with read‑time migration |
| Participant vote manipulation | Medium | Low | Session tokens + facilitator reset capability; acceptable for internal tool |
| Facilitator state conflict (two facilitators) | Low | Medium | Last‑write‑wins + audit log for conflict resolution |

---

## 15. Out of Scope (Current Phase)

- External user authentication (SSO, OAuth)
- Public dashboards
- Cross‑poll analytics
- Sentiment analysis
- Multi‑language support
- Native mobile app
- Offline support
- Real‑time WebSocket connections (polling used instead)

---

## 16. Future Enhancements

| Enhancement | Phase | Notes |
|-------------|-------|-------|
| Supabase Auth integration | 2 | Email/password + SSO |
| Row Level Security (RLS) | 2 | Per‑user data isolation |
| Poll templates | 2 | Pre‑built question sets |
| PDF export | 2 | Server‑side rendering |
| Supabase Realtime | 3 | Replace polling with subscriptions |
| Facilitator presenter mode | 3 | Fullscreen results display |
| Cross‑poll analytics | 3 | Trends across sessions |
| Sentiment analysis on free‑text | 3 | NLP integration |

---

## 17. Technical Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 14+ (App Router) | React Server Components where applicable |
| Backend | Next.js API Routes | Serverless functions on Vercel |
| Database | Supabase Postgres | Free tier initially; Pro for production |
| ORM | Prisma | Type‑safe queries, migrations |
| Validation | Zod | Runtime schema validation on API inputs |
| Hosting | Vercel | Automatic deployments from Git |
| Styling | CSS variables (Shoprite‑X design tokens) | No external CSS framework |
| Image storage | Supabase Storage | Background images for canvas |

---

## 18. Appendix

### 18.1 Key Principles
- Facilitation first — every feature serves the live session experience
- Psychological safety by default — anonymisation on, reveal staged
- Enterprise readiness — audit everything, retain responsibly
- Simplicity over cleverness — boring technology, clear patterns

### 18.2 Glossary

| Term | Definition |
|------|-----------|
| Poll | A collection of questions presented to participants |
| Canvas | The visual editor where questions are placed on a background image |
| Reveal stage | The level of detail shown in results (HIDDEN → COUNTS → DETAILS) |
| Session token | A browser‑generated identifier to prevent duplicate submissions |
| Facilitator state | The JSON object controlling voting, anonymisation, and reveal |

### 18.3 Resolved Questions

| Question | Decision |
|----------|----------|
| Should we support "edit after submit" for participants? | No — submissions are final |
| What is the maximum expected session size? | 100 participants |
| Should audit logs be exportable? | Deferred to Phase 2 |
| Do we need a "test mode" for facilitators to preview the participant experience? | Yes — included in Phase 1 (see Section 7.7) |

---
