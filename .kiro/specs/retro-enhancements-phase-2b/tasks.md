# Implementation Plan: Retro Enhancements Phase 2B

## Overview

This plan implements Phase 2B of the SprintPulse retro board, adding icon-based templates, a custom template builder, runtime column modification, action items with assignment, PDF export, facilitator preview, and participant UI polish. Work is on the `phase-2-retro` branch behind `NEXT_PUBLIC_RETRO_ENABLED`. Dependencies to install: `@react-pdf/renderer`, `emoji-mart`, `@dnd-kit/core`, `@dnd-kit/sortable`, `sharp`.

## Tasks

- [x] 1. Database migration and schema updates
  - [x] 1.1 Apply Prisma migration adding `icon` and `color` to RetroLane and `backgroundImage` to RetroBoard
    - Add `icon String? @db.VarChar(10)` to RetroLane model
    - Add `color String? @db.VarChar(30)` to RetroLane model
    - Add `backgroundImage Json?` to RetroBoard model
    - Run `npx prisma migrate dev` to create migration
    - Verify existing Phase 2A boards remain unaffected (nullable columns, no backfill)
    - _Requirements: 1.5, 14.1, 14.2_

  - [x] 1.2 Install new dependencies
    - Install `@react-pdf/renderer`, `emoji-mart`, `@dnd-kit/core`, `@dnd-kit/sortable`, `sharp`
    - Add `@emoji-mart/data` and `@emoji-mart/react` for emoji-mart v5
    - Update TypeScript types as needed
    - _Requirements: 4.1, 5.5, 8.1_

- [x] 2. Template registry module
  - [x] 2.1 Create `lib/retro/templateRegistry.ts` with built-in template definitions
    - Define `TemplateColumnDef`, `RetroTemplateDefinition` interfaces
    - Implement `BUILT_IN_TEMPLATES` array with Start/Stop/Continue, 4Ls, Mad/Sad/Glad, Sailboat templates
    - Each template column includes title, icon (emoji), and color (CSS hex)
    - Export `getTemplateById()` and `getAllTemplates()` helper functions
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 Write property test for template structure completeness
    - **Property 1: Template structure completeness**
    - Verify every built-in template has non-empty name, id, and ≥1 column with non-empty title, icon, and color
    - **Validates: Requirements 1.1, 1.2**

- [x] 3. Service layer — lane management
  - [x] 3.1 Extend `retroService` with `addLane`, `updateLane`, `deleteLane`, `reorderLanes` methods
    - Implement `addLane(boardId, input)` — validates max 8 lanes, creates lane with next displayOrder
    - Implement `updateLane(laneId, input)` — partial update of title/icon/color
    - Implement `deleteLane(laneId)` — validates min 1 lane, cascades deletion to associated cards
    - Implement `reorderLanes(boardId, input)` — resets displayOrder based on provided laneIds array
    - Enforce lane count min (1) and max (8) with appropriate error codes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 13.1_

  - [x] 3.2 Write property tests for lane count enforcement
    - **Property 4: Lane count minimum enforcement** — deleting last lane fails with validation error
    - **Property 5: Lane count maximum enforcement** — adding lane when 8 exist fails with validation error
    - **Validates: Requirements 5.3, 5.4, 6.7, 6.8**

  - [x] 3.3 Write property tests for lane CRUD operations
    - **Property 7: Add lane grows lane count** — addLane increases count by 1 for boards with <8 lanes
    - **Property 8: Lane update persistence round-trip** — updateLane values are readable via getBoard
    - **Property 9: Lane deletion cascades to cards** — deleteLane removes lane and all associated cards
    - **Property 10: Lane reorder preserves correct display order** — permutation maps to displayOrder indices
    - **Validates: Requirements 6.2, 6.3, 6.5, 6.6, 13.4**

  - [x] 3.4 Write property test for board instance isolation
    - **Property 11: Board instance isolation** — modifying lanes on board A leaves board B and template registry unchanged
    - **Validates: Requirements 6.9, 13.1, 13.2, 13.3**

- [x] 4. Service layer — action items
  - [x] 4.1 Implement action item CRUD methods in `retroService`
    - Implement `addActionItem(boardId, input)` — validates phase (vote/closed only), text 1–500 chars, owner ≤100 chars
    - Implement `updateActionItem(itemId, input)` — partial update of text/owner/dueDate
    - Implement `deleteActionItem(itemId)` — removes action item record
    - Implement `getActionItems(boardId)` — returns all action items for a board
    - Return appropriate error codes for phase gate and validation failures
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 4.2 Write property tests for action item validation
    - **Property 12: Action item phase gate** — addActionItem succeeds in vote/closed, fails in gather
    - **Property 13: Action item text validation** — accepts 1–500 char trimmed text, rejects empty/whitespace/over-500
    - **Property 14: Action item owner length validation** — accepts ≤100 chars, rejects >100 chars
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 5. Service layer — PDF export
  - [x] 5.1 Create `lib/retro/pdfExportService.ts` with PDF document generation
    - Define `PdfExportData` interface
    - Create React-PDF document component with header (logo, title, date), lane sections, and action items section
    - Apply SprintPulse branding (logo, colors)
    - Render lane headers with icons and colors
    - Sort cards by vote count descending within each lane
    - Include action items table with text, assignee, and due date columns
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 5.2 Implement `exportBoardPdf` method in `retroService` that aggregates board data and calls `generateRetroPdf`
    - Gather lanes, cards with vote counts, and action items into `PdfExportData`
    - Return generated PDF buffer
    - _Requirements: 8.1, 8.2_

  - [x] 5.3 Write property tests for PDF export
    - **Property 15: PDF content completeness** — generated PDF contains all lane titles, card texts, vote counts, and action items
    - **Property 16: PDF card ordering by votes** — cards within each lane are ordered by descending vote count
    - **Validates: Requirements 8.2, 8.4, 8.5, 8.6**

- [x] 6. Service layer — image processing
  - [x] 6.1 Create `lib/retro/imageService.ts` for background image upload and deletion
    - Implement `uploadBackgroundImage(boardId, file, mimeType)` using `sharp`
    - Validate file type (JPEG, PNG, WebP only)
    - Resize to max 1920px longest edge
    - Compress to max 2MB output
    - Upload to Supabase Storage bucket `retro-backgrounds/{boardId}/{filename}`
    - Set cache headers `Cache-Control: public, max-age=3600`
    - Implement `deleteBackgroundImage(boardId)` to remove from storage and clear DB field
    - _Requirements: 5.10, 12.1, 12.3_

  - [x] 6.2 Write property test for image processing output bounds
    - **Property 6: Image processing output bounds** — for any input, output is ≤2MB and ≤1920px longest edge
    - **Validates: Requirements 5.10, 12.1**

- [x] 7. Checkpoint — core services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. API routes — lane management
  - [x] 8.1 Create `/api/retro/[boardId]/lanes` route (POST for add, PATCH for reorder)
    - POST: validate facilitator auth, call `addLane`, return created lane
    - PATCH: validate facilitator auth, accept `{ laneIds: string[] }`, call `reorderLanes`
    - Return appropriate error responses (400 LANE_LIMIT_EXCEEDED, 403 FORBIDDEN)
    - _Requirements: 6.1, 6.2, 6.6_

  - [x] 8.2 Create `/api/retro/[boardId]/lanes/[laneId]` route (PATCH for update, DELETE for removal)
    - PATCH: validate facilitator auth, call `updateLane` with partial body
    - DELETE: validate facilitator auth, call `deleteLane`, return 400 MIN_LANES_REQUIRED if last lane
    - _Requirements: 6.3, 6.4, 6.5, 6.7_

- [x] 9. API routes — action items
  - [x] 9.1 Create `/api/retro/[boardId]/action-items` route (GET for list, POST for create)
    - GET: allow facilitator + participants (closed phase), call `getActionItems`
    - POST: validate facilitator auth, validate phase (vote/closed), call `addActionItem`
    - Return 409 WRONG_PHASE if gather phase, 400 VALIDATION_ERROR for invalid input
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 9.2 Create `/api/retro/[boardId]/action-items/[itemId]` route (PATCH for update, DELETE for removal)
    - PATCH: validate facilitator auth, call `updateActionItem`
    - DELETE: validate facilitator auth, call `deleteActionItem`
    - _Requirements: 7.6_

- [x] 10. API routes — export and background
  - [x] 10.1 Create `/api/retro/[boardId]/export/pdf` route (GET)
    - Validate facilitator auth
    - Call `exportBoardPdf`, return PDF buffer with `Content-Type: application/pdf` and `Content-Disposition: attachment`
    - Also implement JSON export option (return board data as JSON)
    - _Requirements: 8.1, 8.7, 8.8_

  - [x] 10.2 Create `/api/retro/[boardId]/background` route (POST for upload, DELETE for removal)
    - POST: validate facilitator auth, parse multipart form, validate file size (<10MB) and type
    - Call `uploadBackgroundImage`, store result in `RetroBoard.backgroundImage` JSON field
    - DELETE: validate facilitator auth, call `deleteBackgroundImage`, clear `backgroundImage` field
    - _Requirements: 5.6, 5.7, 12.1, 12.3_

- [x] 11. Checkpoint — API layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. UI — Template selector enhancement
  - [x] 12.1 Update `TemplateSelector` component to display icon-enriched template cards
    - Render each template as a card showing top row of column icons and template name below
    - Add hover/focus highlight styling for interactivity indication
    - Include all built-in templates from `templateRegistry` plus "Create Your Own" option
    - Wire template selection to board creation with lane icon/color configuration
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 12.2 Write property test for template-to-lane creation round-trip
    - **Property 2: Template-to-lane creation round-trip** — selected template column icons/colors match resulting RetroLane records
    - **Validates: Requirements 1.4, 2.4**

- [x] 13. UI — Emoji picker component
  - [x] 13.1 Create `EmojiPicker` wrapper component around `emoji-mart`
    - Implement `EmojiPickerProps` interface (onSelect, onClose, anchorEl)
    - Configure category tabs (smileys, objects, symbols, nature)
    - Enable keyword search input
    - Implement full keyboard navigation (arrow keys, Enter, Escape)
    - Lazy-load emoji data to keep bundle small
    - Add `aria-label` on each emoji option for screen reader accessibility
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 11.3_

- [x] 14. UI — Custom template builder
  - [x] 14.1 Create `CustomTemplateBuilder` component
    - Start with 0 columns; provide "+ Add Column" button
    - Each column row: title input, emoji picker trigger, color picker (swatch palette)
    - Implement drag-and-drop column reordering with `@dnd-kit/core` and `@dnd-kit/sortable`
    - Enforce min 1 column (disable "Create Board" when 0), max 8 columns (disable "Add" when 8)
    - Add background image upload section with opacity slider (0–100%) and cover/contain toggle
    - "Create Board" button calls `onComplete` with `CustomBoardConfig`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

- [x] 15. UI — Lane header enhancement
  - [x] 15.1 Enhance `LaneHeader` component to display icon and color
    - Render emoji icon alongside lane title when icon is non-null
    - Apply Column_Color to header background or accent when color is non-null
    - Include `aria-label` with icon meaning for accessibility
    - Maintain text labels alongside icons (never icon-only)
    - For legacy lanes (null icon/color), render title-only with default styling
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 11.1, 11.2, 14.1_

  - [x] 15.2 Write property test for lane header rendering
    - **Property 3: Lane header renders icon and title together** — non-null icon lanes render both icon and title with aria-label
    - **Validates: Requirements 3.1, 3.3, 10.1, 11.1, 11.2**

- [x] 16. UI — Runtime column modification controls
  - [x] 16.1 Implement runtime column management UI on the facilitator board
    - Add "+ Add Column" button visible on all active boards
    - New lanes get default title with immediate inline editing for title, icon (emoji picker), and color
    - Add edit controls on existing lane headers (title, icon, color) for facilitators
    - Add delete button with confirmation modal before lane removal
    - Implement drag-and-drop reordering of columns on active board using `@dnd-kit`
    - Add ARIA live regions to announce lane add/remove/reorder to screen readers
    - Wire all mutations to lane CRUD API routes with optimistic updates and rollback on error
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.10, 11.5_

- [x] 17. UI — Action items panel
  - [x] 17.1 Create `ActionItemsPanel` component for facilitator and participant views
    - Show panel when board phase is "vote" or "closed"
    - Add action item form: text input (max 500), assignee input (max 100), optional date picker
    - Display list of action items with text, assignee, and due date
    - Allow facilitator to edit/delete action items (inline edit + delete button)
    - In "closed" phase, display action items read-only to participants
    - Wire to action items API routes
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 18. UI — Export dialog
  - [x] 18.1 Create `ExportDialog` component with PDF and JSON export options
    - Present modal with two format choices: PDF (primary) and JSON (secondary)
    - PDF option triggers download via `/api/retro/[boardId]/export/pdf`
    - JSON option triggers download of board data as `.json` file
    - Show loading state during PDF generation
    - _Requirements: 8.1, 8.7, 8.8_

- [x] 19. UI — Preview facility
  - [x] 19.1 Create `PreviewFacility` modal component
    - Add "Preview as Participant" button on facilitator dashboard for retro boards
    - Render read-only participant view in a modal overlay
    - Apply anonymity rules (hide author names when board is anonymous)
    - Reflect current phase display rules (card counts only in anonymous gather phase)
    - Disable all interactive controls (vote buttons, card add) within preview
    - Escape key or close button dismisses without state change
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 20. UI — Participant styling improvements
  - [x] 20.1 Apply participant UI polish and responsive enhancements
    - Render participant lane headers with icons and Column_Colors matching facilitator view
    - Apply improved card styling: consistent spacing, shadows, rounded corners
    - Add phase indicator showing current board phase (Gathering, Voting, Closed)
    - Implement touch-friendly interactions with min 44×44px tap targets for mobile
    - Add horizontal scrolling for boards with >3 columns on mobile viewports
    - Ensure WCAG 2.1 AA contrast (4.5:1 text, 3:1 large text/UI components) for all template colors
    - Apply consistent typography, spacing, and elevation across facilitator and participant views
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 11.4_

- [x] 21. UI — Background image rendering
  - [x] 21.1 Implement background image display on the board with lazy loading and graceful fallback
    - Read `backgroundImage` JSON from board data (url, opacity, displayMode)
    - Apply as CSS background with correct opacity and cover/contain mode
    - Lazy-load image (do not block board interactivity)
    - Ensure columns have sufficient contrast over background (semi-transparent column overlays)
    - On image load failure, render plain background silently (no error shown to participants)
    - _Requirements: 5.8, 5.9, 12.2, 12.4_

- [x] 22. Final checkpoint — full integration verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify Phase 2A backward compatibility: existing boards render with null icon/color as title-only
  - Verify all existing Phase 2A API routes and tests remain unchanged
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All work is behind the `NEXT_PUBLIC_RETRO_ENABLED` feature flag
- Dependencies: `@react-pdf/renderer`, `emoji-mart`, `@emoji-mart/data`, `@emoji-mart/react`, `@dnd-kit/core`, `@dnd-kit/sortable`, `sharp`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1", "5.1", "6.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "4.2", "5.2", "6.2"] },
    { "id": 4, "tasks": ["5.3", "8.1", "8.2", "9.1", "9.2", "10.1", "10.2"] },
    { "id": 5, "tasks": ["12.1", "13.1"] },
    { "id": 6, "tasks": ["12.2", "14.1", "15.1"] },
    { "id": 7, "tasks": ["15.2", "16.1", "17.1", "18.1", "19.1"] },
    { "id": 8, "tasks": ["20.1", "21.1"] }
  ]
}
```
