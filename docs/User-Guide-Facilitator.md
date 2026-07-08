# SprintPulse — Facilitator User Guide

## Overview

As a facilitator, you create teams, manage polls and retros, control live sessions, and view results. This guide covers everything you need to run engaging workshops, retrospectives, and PI events using SprintPulse.

---

## Getting Started

### Creating Your Account

1. Navigate to your app URL and click **Facilitator** (e.g., `https://sprintpulse-app.vercel.app`)
2. Click the **Register** tab
3. Enter your **display name**, **email**, and **password** (minimum 8 characters)
4. Click **Create Account**
5. You're now logged in and can start creating teams and polls

### Signing In

1. Navigate to the app and click **Facilitator**
2. Enter your **email** and **password**
3. Click **Sign In**

### Resetting Your Password

1. On the login screen, click **Forgot password?**
2. Enter your email address
3. Click **Send Reset Link**
4. Check your email for a password reset link
5. Follow the link to set a new password

Your session persists across browser tabs and page refreshes. Click **Logout** in the top-right to sign out.

---

## Managing Teams

Teams let you organize polls for different groups. Each team has a unique PIN that participants use to access their team's polls.

### Creating a Team

1. Click **Teams** in the navigation bar
2. Enter a team name (e.g., "Sprint Team Alpha") in the input field
3. Click **Create Team**
4. A unique PIN is auto-generated (e.g., "A3K7")

### Sharing the Team PIN

- The PIN is displayed prominently next to each team name
- Click the **copy** button to copy the PIN to your clipboard
- Share the PIN with participants verbally, via chat, or on screen

### Renaming a Team

1. On the Teams page, click the team name to edit it
2. Type the new name and confirm

### Deleting a Team

1. Click **Delete** next to the team
2. Confirm the action
3. Polls previously assigned to this team become visible to all participants

---

## Managing Polls

### Creating a New Poll

1. From the admin dashboard, click **Create New Poll**
2. Fill in:
   - **Team** (required) — select which team this poll belongs to
   - **Title** (required, max 200 characters) — displayed to participants
   - **Description** (optional, max 1000 characters) — context for participants
   - **Background Image** (optional) — JPEG, PNG, or WebP, max 5 MB
3. Click **Create Poll**

### Editing a Poll

1. Find the poll in the dashboard list
2. Click **Edit**
3. Update the title, description, team assignment, or background image
4. Add or edit questions in the **Questions** section
5. Position questions on the **Visual Canvas Editor**
6. Click **Save Changes** at the bottom of the page (below all sections)

### Filtering Polls by Team

- Use the **team filter dropdown** at the top of the poll list to show only polls for a specific team

### Cloning a Poll

1. Click **Clone** next to the poll
2. A new poll is created with "(Copy)" appended to the title
3. All questions are duplicated; responses are not copied

### Resetting Responses

To clear all participant responses (e.g., for a fresh session):

1. Click **Reset** next to the poll
2. Confirm the action
3. All responses are permanently removed
4. Participants can now re-submit (they'll need to refresh their page)

### Deleting a Poll

1. Click **Delete** next to the poll
2. Confirm the action

---

## Managing Questions

### Adding Questions

1. Navigate to the poll's **Edit** page
2. Scroll down to the **Questions** section
3. Click **+ Add Question**
4. Fill in:
   - **Question Text** (required, max 500 characters)
   - **Options** (2–10 predefined choices)
   - **Allow custom free-text answer** (checkbox)
5. Click **Add Question**

### Editing and Deleting Questions

- Click **Edit** next to a question to modify it
- Click **Delete** to remove it (with confirmation)

### Question Limits

- Maximum 20 questions per poll
- 2–10 options per question
- Question text: max 500 characters

---

## Visual Canvas Editor

Position questions visually on a background image. The canvas editor appears on the Edit page once you have at least one question.

### Placing Questions

1. Scroll to the **Visual Canvas Editor** section
2. Drag questions from the **sidebar** onto the canvas
3. Positions are saved automatically

### Repositioning and Resizing

- Drag a placed question to move it
- Use corner handles to resize
- Right-click → "Remove from canvas" to unplace

### Canvas Background

- Upload via the poll form (JPEG, PNG, or WebP, max 5 MB)
- Questions are positioned as percentages, so they scale across screen sizes

---

## Running a Live Session

### Opening the Facilitator Dashboard

1. Click **Facilitate** next to the poll
2. The live control dashboard opens

### Session Controls

| Control | Default | Description |
|---------|---------|-------------|
| **Voting** | Closed | Opens/closes participant submissions |
| **Live Results** | Off | Auto-refreshes results every 3 seconds |
| **Anonymisation** | On | Hides participant names in results |

### Reveal Stages

| Stage | What's Shown |
|-------|-------------|
| **HIDDEN** | No results visible |
| **COUNTS** | Aggregated totals and percentages per option |
| **DETAILS** | Full results including free-text responses and participant names for all response types |

When **DETAILS** is selected and **Anonymisation** is off, participant names are shown for both custom free-text responses and predefined option selections (e.g., you can see who voted for each option).

### Typical Session Flow

1. Create team → create poll → add questions → position on canvas
2. Share the **team PIN** with participants
3. Open the facilitator dashboard → **Open voting**
4. Monitor submissions via live statistics
5. **Close voting** when ready
6. **Reveal results** progressively: HIDDEN → COUNTS → DETAILS

### Testing Your Poll

Before going live, you can submit test responses to verify everything works:

1. Open the poll in a separate browser/incognito window as a participant
2. Submit test responses (these are flagged as test data)
3. In the facilitator dashboard, switch to the **Test Responses** tab to see only your test submissions
4. The **Results** tab always shows only real participant responses
5. Click **Clear Test Responses** to remove test data before the live session

---

## Running a Retro Session

Retro boards provide a collaborative space for team retrospectives. Participants add anonymous cards to themed lanes, vote on what matters most, and the team captures action items to drive improvement.

---

### Creating a Retro

1. From the admin dashboard, click **Create New Poll**
2. Select **Retro** as the activity type
3. Fill in:
   - **Team** (required) — select which team this retro belongs to
   - **Title** (required, max 200 characters) — displayed to participants
   - **Template** — choose a built-in template or start from scratch
   - **Votes per User** — how many votes each participant can cast (default: 5)
   - **Background Image** (optional) — JPEG, PNG, or WebP, max 5 MB
4. Click **Create Poll**

---

### Templates

SprintPulse includes several built-in templates, each pre-configured with themed columns, icons, and colors:

| Template | Columns | Best For |
|----------|---------|----------|
| **Start/Stop/Continue** | Start, Stop, Continue | General sprint retros |
| **4Ls** | Liked, Learned, Lacked, Longed For | Broader reflection sessions |
| **Mad/Sad/Glad** | Mad, Sad, Glad | Emotional pulse checks |
| **Sailboat** | Wind (helps), Anchor (hinders), Rocks (risks), Island (goals) | Visual metaphor retros |
| **Custom** | You define your own | Any custom format |

Each template comes with distinct lane colors and icons for easy visual identification.

---

### Custom Template

To create a retro with your own structure:

1. Select **Custom** as the template
2. Click **+ Add Column** to add lanes
3. For each column, configure:
   - **Title** — the lane heading (e.g., "What went well?")
   - **Icon** — choose from the icon picker
   - **Color** — select a lane color
4. Add as many columns as you need
5. Click **Create Poll**

---

### Editing a Retro

1. Find the retro in the dashboard list
2. Click **Edit**
3. On the Edit page you can:
   - Change **Votes per User**
   - Add new columns with **+ Add Column**
   - Edit existing column **title**, **icon**, or **color**
   - Delete columns (with confirmation)
   - Update the background image
4. Click **Save Changes** at the bottom of the page

---

### Facilitating a Retro Session

A retro progresses through three phases, controlled from the Facilitate page:

#### Gather Phase

1. Click **Facilitate** next to the retro
2. Set the phase to **Gather**
3. Participants add anonymous cards to any lane
4. Cards are anonymous by default — participants see only their own cards and a count of others
5. As facilitator, you can see all cards across all lanes in real time

#### Vote Phase

1. Advance the phase to **Vote**
2. All cards become visible to everyone
3. Participants vote on cards by clicking the thumbs-up icon
4. Each participant is limited to the configured votes-per-user count
5. You can begin adding action items during this phase

#### Closed Phase

1. Advance the phase to **Closed**
2. The board becomes read-only — no new cards or votes
3. Action items are visible to all participants
4. Export the board for record-keeping

---

### Managing Columns at Runtime

You can add, edit, delete, and reorder columns during a live retro session directly from the Facilitate page:

1. Click the **column settings** icon on the Facilitate page
2. **Add** — click **+ Add Column** and configure title, icon, and color
3. **Edit** — click a column's edit icon to change its title, icon, or color
4. **Delete** — click the delete icon next to a column (with confirmation)
5. **Reorder** — drag columns to rearrange their order

Changes are reflected to all participants in real time.

---

### Action Items

Capture next steps during the Vote or Closed phase:

1. Click **+ Add Action Item** on the Facilitate page
2. Fill in:
   - **Text** (required) — describe the action
   - **Assignee** (required) — who is responsible
   - **Due Date** (optional) — when it should be completed
3. Click **Add**
4. Action items appear on the board for all participants in the Closed phase

---

### Exporting

Two export formats are available from the Facilitate page during the Closed phase:

| Format | Contents |
|--------|----------|
| **PDF** | Styled report with lane headings, cards, vote counts, and action items |
| **JSON** | Structured data export of all lanes, cards, votes, and action items |

Click the **Export** button and select your preferred format.

---

### Preview as Participant

To see exactly what participants see during a session:

1. On the Facilitate page, click the **Preview** button
2. A participant-perspective view opens
3. Verify card visibility, lane layout, and phase indicators
4. Close the preview to return to the facilitator view

---

### Sharing the Retro

Share the retro with your team using either method:

1. **Team PIN** — participants join via PIN and see the retro in their list (same as polls)
2. **Direct Link / QR Code** — click the **Share** button on the Facilitate page to copy the unique URL or display a QR code for participants to scan

---

## Profile Management

1. Click **Profile** in the navigation bar
2. View your email (read-only) and edit your display name
3. Click **Save Changes**

---

## Tips

- Create separate teams for different groups (e.g., "Dev Team", "Design Team")
- Share the team PIN at the start of each session
- Test your poll before going live using a different browser/incognito window
- Use the HIDDEN → COUNTS → DETAILS progression to build suspense
- Enable anonymisation for sensitive topics

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't sign in | Check email/password; use "Forgot password?" to reset |
| Forgot password | Click "Forgot password?" on the login screen to receive a reset link |
| Participants can't see polls | Ensure they entered the correct team PIN |
| Results not updating | Enable "Live Results" toggle |
| Participants can't submit | Check that voting is open |
| Reset didn't work | Participants need to refresh their page after a reset |
| Test Responses tab shows wrong data | Ensure you're using the Test Responses tab (not Results) to view test submissions |

---

*SprintPulse v3.0.0*
