# Requirements Document

## Introduction

This document specifies requirements for Phase 2B of the SprintPulse retro board. Phase 2B builds on the interactive retro board delivered in Phase 2A and introduces: icon-based templates, a custom template builder, runtime column modification, action items with assignment, PDF export, a facilitator preview facility, and participant UI styling improvements. All work continues on the `phase-2-retro` branch behind the `NEXT_PUBLIC_RETRO_ENABLED` feature flag. The development database is isolated at `jrcnttzdgipoalxxcnuh.supabase.co`.

## Glossary

- **Retro_Board**: The collaborative retrospective board belonging to a retro activity, backed by the `RetroBoard` model.
- **Lane**: A named column on a board (e.g. "Went well") into which cards are added. Backed by the `RetroLane` model.
- **Template**: A predefined or custom configuration of lanes including titles, icons, and colors used to initialise a Retro_Board.
- **Template_Selector**: The UI component that presents available templates during board creation.
- **Icon**: An emoji character used as a visual identifier for a lane or template.
- **Column_Color**: A CSS-compatible color value associated with a lane for visual differentiation.
- **Custom_Template_Builder**: The UI for defining a fully custom template from scratch with unlimited columns, icons, colors, and background.
- **Action_Item**: A follow-up task captured during or after a retrospective, with text, assignee, and optional due date.
- **PDF_Export**: A styled PDF report of the retro board including lanes, cards, votes, and action items.
- **Preview_Facility**: A read-only view showing the facilitator how participants see the board.
- **Facilitator**: Authenticated owner who creates and runs activities.
- **Participant**: A team member who joins via team PIN / access token.
- **Phase**: The retro lifecycle stage: `gather`, `vote`, or `closed`.
- **Feature_Flag**: `NEXT_PUBLIC_RETRO_ENABLED`; gates all retro visibility.
- **Emoji_Picker**: A UI component allowing selection of emoji characters for lane icons.
- **Background_Image**: An uploaded image displayed behind columns on the board.

## Requirements

### Requirement 1: Icon-Based Template Data Model

**User Story:** As a facilitator, I want templates to include icons and colors per column, so that the board is visually engaging and easy to scan.

#### Acceptance Criteria

1. THE Template_Selector SHALL define each template with a name, a set of column definitions, and a template-level icon set
2. WHEN a template is defined, THEN each column definition SHALL include a title, an icon (emoji character), and a Column_Color
3. THE System SHALL provide the following enhanced built-in templates with icons and colors: "Start/Stop/Continue", "4Ls" (Liked/Learned/Lacked/Longed For), "Mad/Sad/Glad", "Sailboat", and "Liked/Learned/Lacked/Longed For"
4. WHEN a built-in template is selected, THEN the System SHALL create RetroLane records with the corresponding icon and Column_Color stored per lane
5. THE RetroLane model SHALL store an `icon` field (emoji character, nullable for backward compatibility) and a `color` field (CSS color string, nullable for backward compatibility)

### Requirement 2: Template Selector UI

**User Story:** As a facilitator, I want to see template cards with icons so I can quickly identify each template's purpose.

#### Acceptance Criteria

1. WHEN the Template_Selector is rendered, THEN the System SHALL display each template as a card showing the template icon set (top row of column icons) and the template name below
2. WHEN a facilitator hovers over or focuses a template card, THEN the System SHALL provide a visual highlight indicating the card is interactive
3. THE Template_Selector SHALL include both the enhanced built-in templates and a "Create Your Own" option
4. WHEN a facilitator selects a built-in template, THEN the System SHALL proceed to board creation with the corresponding lane configuration

### Requirement 3: Lane Header Icon Display

**User Story:** As a participant, I want to see icons in column headers so I can quickly identify each lane's theme.

#### Acceptance Criteria

1. WHEN a lane has an icon assigned, THEN the System SHALL display the icon alongside the lane title in the column header
2. WHEN a lane has a Column_Color assigned, THEN the System SHALL apply the color to the lane header background or accent
3. THE System SHALL render lane icons with accompanying text labels (icon plus title) to maintain accessibility
4. WHEN a lane has no icon assigned (legacy boards), THEN the System SHALL render the lane header with title only

### Requirement 4: Emoji Picker for Icon Selection

**User Story:** As a facilitator, I want to pick emojis for my columns, so I can personalise the board's appearance.

#### Acceptance Criteria

1. WHEN the facilitator edits a lane icon, THEN the System SHALL present the Emoji_Picker component
2. THE Emoji_Picker SHALL allow searching emojis by keyword
3. THE Emoji_Picker SHALL organise emojis into categories (e.g. smileys, objects, symbols)
4. WHEN the facilitator selects an emoji from the Emoji_Picker, THEN the System SHALL assign it as the lane icon
5. THE Emoji_Picker SHALL be navigable via keyboard for accessibility

### Requirement 5: Custom Template Builder

**User Story:** As a facilitator, I want to build my own template from scratch, so I can tailor the retro to my team's specific needs.

#### Acceptance Criteria

1. WHEN the facilitator selects "Create Your Own" from the Template_Selector, THEN the System SHALL present the Custom_Template_Builder with zero pre-defined columns
2. THE Custom_Template_Builder SHALL allow the facilitator to add columns, each with a title, icon, and Column_Color
3. THE Custom_Template_Builder SHALL enforce a minimum of 1 column before the board can be created
4. THE Custom_Template_Builder SHALL enforce a maximum of 8 columns
5. WHEN the facilitator reorders columns in the Custom_Template_Builder, THEN the System SHALL support drag-and-drop reordering
6. THE Custom_Template_Builder SHALL allow the facilitator to upload a background image for the board
7. WHEN a background image is uploaded, THEN the System SHALL provide an opacity slider (range 0% to 100%) controlling background visibility
8. WHEN a background image is uploaded, THEN the System SHALL provide display options of "cover" (fill entire board) and "contain" (fit within board)
9. WHEN a background image is applied, THEN the System SHALL render columns with sufficient contrast to remain clearly readable over the background
10. THE System SHALL optimise uploaded background images to a maximum of 2MB file size and appropriate dimensions for web display

### Requirement 6: Runtime Column Modification

**User Story:** As a facilitator, I want to add, edit, reorder, and remove columns on any active retro board, so I can adapt the session in real time.

#### Acceptance Criteria

1. THE System SHALL display a "+ Add Column" button on all active Retro_Board instances regardless of the template used
2. WHEN the facilitator clicks "+ Add Column", THEN the System SHALL add a new lane with a default title, allowing immediate editing of title, icon, and color
3. WHEN the facilitator edits an existing column, THEN the System SHALL allow changing the title, icon, and Column_Color
4. WHEN the facilitator removes a column, THEN the System SHALL display a confirmation prompt before deletion
5. IF a facilitator confirms column removal AND the column contains cards, THEN the System SHALL delete the column and its associated cards
6. THE System SHALL support drag-and-drop reordering of columns on the active board
7. THE System SHALL enforce a minimum of 1 lane per board (preventing removal of the last column)
8. THE System SHALL enforce a maximum of 8 lanes per board (preventing addition beyond the cap)
9. WHEN a column is modified at runtime, THEN the System SHALL persist the change to the specific retro instance only, leaving the original template definition unchanged
10. WHEN columns are modified, THEN the System SHALL reflect the change to all connected participants within the next poll cycle

### Requirement 7: Action Items with Assignment

**User Story:** As a facilitator, I want to capture action items with assignees during the retro, so the team leaves with clear follow-ups.

#### Acceptance Criteria

1. WHILE the board phase is "vote" or "closed", THE System SHALL allow the facilitator to add action items
2. WHEN the facilitator adds an action item, THEN the System SHALL require non-empty text of at most 500 characters
3. WHEN the facilitator adds an action item, THEN the System SHALL allow assigning it to a participant name (free-text, at most 100 characters)
4. WHEN the facilitator adds an action item, THEN the System SHALL allow setting an optional due date
5. WHILE the board phase is "closed", THE System SHALL display all action items with their text, assignee, and due date to participants
6. THE System SHALL allow the facilitator to edit or delete action items after creation
7. THE System SHALL store action items in the RetroActionItem model with `boardId`, `text`, `owner` (assignee), and `dueDate` fields

### Requirement 8: PDF Export

**User Story:** As a facilitator, I want to export the retro as a styled PDF, so I can share a professional report with stakeholders.

#### Acceptance Criteria

1. WHEN the facilitator requests an export, THEN the System SHALL generate a styled PDF document
2. THE PDF SHALL include the board title, all lanes with their cards, vote counts per card, and action items with assignees and due dates
3. THE PDF SHALL apply SprintPulse branding including the application logo and consistent color scheme
4. THE PDF SHALL render lane headers with their assigned icons and colors
5. THE PDF SHALL list cards within each lane sorted by vote count (descending)
6. WHEN action items exist, THEN the PDF SHALL include an "Action Items" section listing each item with assignee and due date
7. THE System SHALL also offer a secondary JSON export format for machine-readable access
8. WHEN the facilitator exports, THEN the System SHALL present a choice between PDF (primary) and JSON (secondary) format

### Requirement 9: Facilitator Preview Facility

**User Story:** As a facilitator, I want to preview the participant view, so I can verify what my team will see before and during the session.

#### Acceptance Criteria

1. THE System SHALL provide a "Preview as Participant" control on the Facilitate dashboard for retro boards
2. WHEN the facilitator activates the preview, THEN the System SHALL display a read-only participant view in a modal or side panel
3. THE Preview_Facility SHALL apply anonymity rules as a participant would see them (author names hidden when board is anonymous)
4. THE Preview_Facility SHALL reflect the current board phase and its display rules (e.g. card counts only in anonymous gather phase)
5. THE Preview_Facility SHALL NOT allow the facilitator to interact with cards or votes from within the preview
6. WHEN the facilitator closes the preview, THEN the System SHALL return to the full facilitator view without state change

### Requirement 10: Participant UI Styling Improvements

**User Story:** As a participant, I want the retro board to be visually polished and match the quality of the facilitator experience, so that participation feels engaging.

#### Acceptance Criteria

1. THE System SHALL render participant lane headers with their assigned icons and Column_Colors, matching the facilitator board appearance
2. THE System SHALL render participant cards with improved styling including consistent spacing, shadows, and rounded corners
3. THE System SHALL display a phase indicator to participants showing the current board phase (Gathering, Voting, or Closed)
4. WHEN the board is viewed on mobile, THEN the System SHALL provide touch-friendly card interactions with minimum tap targets of 44×44 CSS pixels
5. WHEN the board is viewed on mobile, THEN the System SHALL support horizontal scrolling for boards with more than 3 columns
6. THE System SHALL ensure all interactive elements meet WCAG 2.1 AA color contrast requirements (minimum 4.5:1 for text, 3:1 for large text and UI components)
7. THE System SHALL apply consistent typography, spacing, and elevation patterns across facilitator and participant views

### Requirement 11: Accessibility for Icon-Based UI

**User Story:** As a participant using assistive technology, I want icons to have text alternatives, so I can understand the board without relying on visual cues alone.

#### Acceptance Criteria

1. WHEN a lane icon is displayed, THEN the System SHALL include an accessible text label (via `aria-label` or visible text) conveying the icon meaning
2. THE System SHALL NOT rely on icon or color alone to convey information; text labels SHALL accompany all icons
3. WHEN the Emoji_Picker is rendered, THEN the System SHALL be operable via keyboard navigation (arrow keys, Enter to select, Escape to close)
4. WHEN a Column_Color is used for visual differentiation, THEN the System SHALL ensure the color meets WCAG 2.1 AA contrast requirements against adjacent backgrounds
5. THE System SHALL announce lane and column changes to screen readers via ARIA live regions when columns are added, removed, or reordered at runtime

### Requirement 12: Background Image Performance

**User Story:** As a facilitator, I want background images to load quickly without degrading the board experience.

#### Acceptance Criteria

1. WHEN a background image is uploaded, THEN the System SHALL compress and resize the image to a maximum of 2MB and 1920px on the longest edge
2. THE System SHALL lazy-load background images so that board interactivity is not blocked while the image downloads
3. WHEN a background image is applied, THEN the System SHALL serve the image via Supabase Storage with appropriate cache headers (minimum 1 hour cache)
4. IF the background image fails to load, THEN the System SHALL render the board with a plain background and display no error to participants

### Requirement 13: Persistence of Runtime Customisations

**User Story:** As a facilitator, I want my column changes to persist for the session without affecting templates used by others.

#### Acceptance Criteria

1. WHEN a facilitator modifies columns at runtime (add, edit, remove, reorder), THEN the System SHALL persist changes to the RetroLane records of that specific Retro_Board instance
2. THE System SHALL NOT modify the built-in template definitions based on runtime changes to an individual board
3. WHEN a facilitator creates a new retro using the same template, THEN the System SHALL apply the original template configuration without any runtime modifications from other boards
4. WHEN a board is reloaded after a column modification, THEN the System SHALL restore all columns with their modified titles, icons, colors, and order

### Requirement 14: Backward Compatibility with Phase 2A Boards

**User Story:** As an existing user, I want my Phase 2A retro boards to continue working after Phase 2B is deployed.

#### Acceptance Criteria

1. WHEN a RetroLane has null `icon` and null `color` fields, THEN the System SHALL render the lane with title-only headers using default styling
2. THE System SHALL NOT require data migration of existing RetroLane records to add icon or color values
3. WHEN a Phase 2A board is opened after Phase 2B deployment, THEN the System SHALL allow the facilitator to add icons and colors via the runtime column edit flow
4. THE System SHALL maintain all existing Phase 2A API routes and their behavior without breaking changes
