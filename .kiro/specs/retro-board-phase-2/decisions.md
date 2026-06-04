# Phase 2 Foundational Decisions

This document records the cross-cutting decisions that constrain the entire Retro Board feature. Every requirement and design choice downstream must respect these. It is the single source of truth for "why is it built this way".

## Current-State Audit (as built, verified against code)

These facts are confirmed against the live codebase, not the design docs:

1. **No type discriminator exists.** `Poll` has no `type` field today. The earlier `retro-free-text-responses` spec proposed one but it was never implemented. Phase 2 introduces it fresh.
2. **`Response` has a hard uniqueness constraint.** `@@unique([pollId, questionId, sessionToken])` enforces one response per participant per question. There is no `responseIndex` column. The pulse model is single-submission by design.
3. **Live updates use client-side interval polling.** `FacilitatorDashboard` calls `setInterval` (~3s) to re-fetch state and results. There is no WebSocket or Server-Sent-Events layer. Supabase Realtime is available in the stack but unused.
4. **Canvas is static placement, not an interactive board.** `Question.position` is a `{x,y,width,height}` JSON blob set by the facilitator at setup. There is no drag-between-regions or multi-user live movement. Known issues exist: mobile participants don't see the background image; the placement edit flow has UX friction.
5. **Data is purged after 90 days** via a nightly cron (`/api/system/purge`, `vercel.json`).
6. **Production deploys automatically from `main`** via Vercel git integration.

## Locked Decisions

### Decision 1 — Production Isolation: Long-lived branch + feature flag
- All Phase 2 work lives on the `phase-2-retro` git branch. It is **never merged to `main`** until the owner explicitly declares readiness.
- A feature flag `NEXT_PUBLIC_RETRO_ENABLED` (default `false`, absent/false in production env) gates every retro entry point: the Pulse/Retro selector, all `/retro` routes, and any retro nav links.
- Production's Vercel env must **not** define the flag, so retro cannot be enabled from the dashboard by accident.
- Rationale: `main` auto-deploys to prod. Two independent locks (branch + flag) guarantee retro stays invisible in production until declared ready. All testing happens on `localhost`.

### Decision 2 — MVP Scope: Thin interactive board first (skip free-text-on-poll model)
- Phase 2A builds the thinnest *interactive board*: lanes, add cards, reveal/hide, basic voting, export. No clustering, no drag-between-lanes, no action items yet.
- The older `retro-free-text-responses` spec (free text on the pulse `Response` model) is **superseded and not implemented**. Building it would be thrown away in 2B.
- Rationale: the owner explicitly wants the board/canvas concept. Going straight to a thin board avoids rework.

### Decision 3 — Real-time: Keep interval polling for MVP; design for Realtime later
- The MVP reuses the existing `setInterval` polling approach for facilitator and participant views.
- The card author's own add/edit/delete uses optimistic UI so their own actions feel instant.
- The data layer is designed so Supabase Realtime (Postgres change subscriptions) can be dropped in during Phase 2B without reshaping the schema.
- Rationale: polling is adequate for a 5–15 person retro. Realtime adds complexity/risk best deferred until drag-and-drop makes lag painful.

### Decision 4 — Canvas: Build a NEW board component, mobile-first, independent of current canvas
- The retro board is a new component. It reuses the *concept* of background image + percentage positioning, and may reuse the image-upload/storage layer, but it does **not** depend on the existing `Question.position` canvas placement code.
- It is designed desktop + mobile together from day one: desktop = positioned lanes; mobile = vertical stacked lanes with the board header/image visible.
- Rationale: the existing canvas has known mobile/edit-flow bugs. A clean board component sidesteps those blockers entirely and avoids inheriting their debt.

### Decision 5 — Data Model + Retention: Additive `type` discriminator + separate retro tables; retro exempt from purge
- Add `type` ("pulse" | "retro") to `Poll`, defaulting to `"pulse"` so all existing rows and pulse behavior are untouched (zero-downtime additive migration).
- Retro data lives in **new** tables (`RetroBoard`, `RetroLane`, `RetroCard`, `RetroVote`, `RetroActionItem`) — not shoehorned into `Response`.
- The 90-day purge cron is updated to **exclude** retro tables, since retro boards are living artefacts revisited across sprints.
- Rationale: additive change protects the live pulse product; separate tables keep the domain clean for richer 2B/2C features.

## Out of Scope for Phase 2A (deferred)
- Clustering / grouping of cards; drag cards between lanes.
- Action items with owners and due dates; "carry forward last retro's actions".
- Template library, board duplication, AI summarisation, Jira/ADO integrations, cross-sprint history/compare.
- WebSocket/Realtime transport (designed-for, not built).
