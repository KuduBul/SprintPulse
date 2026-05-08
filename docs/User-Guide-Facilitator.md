# SprintPulse — Facilitator User Guide

## Overview

As a facilitator, you manage polls, control live sessions, and view results. This guide covers everything you need to run engaging workshops, retrospectives, and PI events.

---

## Getting Started

### Accessing the Admin Dashboard

1. Navigate to your app URL followed by `/admin` (e.g., `https://your-app.vercel.app/admin`)
2. Enter the **admin token** provided by your system administrator
3. Click **Sign In**

Your token is stored in your browser — you won't need to re-enter it unless you clear your browser data.

---

## Managing Polls

### Creating a New Poll

1. From the admin dashboard, click **Create New Poll**
2. Fill in:
   - **Title** (required, max 200 characters) — displayed to participants
   - **Description** (optional, max 1000 characters) — context for participants
   - **Background Image** (optional) — JPEG, PNG, or WebP, max 5 MB
3. Click **Create Poll**

### Editing a Poll

1. Find the poll in the dashboard list
2. Click **Edit**
3. Update the title, description, or background image
4. Click **Save Changes**

### Cloning a Poll

Use this to reuse a poll structure without affecting the original:

1. Click **Clone** next to the poll
2. A new poll is created with "(Copy)" appended to the title
3. All questions are duplicated; responses are not copied

### Resetting Responses

To clear all participant responses (e.g., for a fresh session):

1. Click **Reset** next to the poll
2. Confirm the action
3. All responses are permanently removed

### Deleting a Poll

1. Click **Delete** next to the poll
2. Confirm the action
3. The poll is soft-deleted (hidden from views but retained for 30 days)

---

## Managing Questions

### Adding Questions

1. Navigate to the poll's **Edit** page (click "Edit" from the admin dashboard)
2. Scroll down to the **Questions** section
3. Click **+ Add Question**
4. Fill in:
   - **Question Text** (required, max 500 characters) — the prompt shown to participants
   - **Options** (2–10 predefined choices) — click "+ Add Option" to add more, "✕" to remove
   - **Allow custom free-text answer** (checkbox) — adds a "Custom" option where participants can type their own response
5. Click **Add Question**

### Editing Questions

1. Find the question in the list on the Edit page
2. Click **Edit** next to the question
3. Modify the text, options, or custom setting
4. Click **Update Question**

### Deleting Questions

1. Click **Delete** next to the question
2. Confirm the deletion

### Question Limits

- Minimum 1, maximum 20 questions per poll
- Minimum 2, maximum 10 options per question
- Question text: max 500 characters

---

## Visual Canvas Editor

The canvas editor appears at the bottom of the Edit page once you have at least one question. It lets you visually position questions on a background image.

### Placing Questions on the Canvas

On desktop (1024px+):

1. Scroll down to the **Visual Canvas Editor** section on the Edit page
2. **Unplaced questions** appear in the sidebar on the left
3. **Drag** a question from the sidebar onto the canvas area
4. The question card appears where you dropped it
5. Positions are saved automatically

### Repositioning and Resizing

- **Drag** a placed question to move it
- **Resize** using the corner handles on the question card
- Positions are stored as percentages (0–100%), so they scale across screen sizes

### Removing from Canvas

- **Right-click** a placed question and select "Remove from canvas"
- The question returns to the sidebar (it's not deleted, just unplaced)
- Unplaced questions still appear in the participant's list view

### Canvas Background

- Upload a background image via the poll metadata form (JPEG, PNG, or WebP, max 5 MB)
- If no image is set, a neutral grey canvas is displayed
- If the image fails to load, a placeholder with an error message is shown

### Responsive Behaviour

| Viewport | Behaviour |
|----------|-----------|
| Desktop (≥1024px) | Full canvas editor with drag-and-drop |
| Tablet (768–1023px) | View-only canvas mode |
| Mobile (<768px) | Vertical scrollable list (no canvas) |

**Note:** If the browser doesn't support the Drag and Drop API, a warning banner is shown and coordinate input fields are provided as a fallback.

---

## Running a Live Session

### Opening the Facilitator Dashboard

1. Click **Facilitate** next to the poll
2. The facilitator dashboard opens with live controls

### Session Controls

| Control | Default | Description |
|---------|---------|-------------|
| **Voting** | Closed | Opens/closes participant submissions |
| **Live Results** | Off | Auto-refreshes results every 3 seconds |
| **Anonymisation** | On | Replaces names with "Participant 1, 2, ..." |

### Reveal Stages

Control how much detail participants and viewers see:

| Stage | What's Shown |
|-------|-------------|
| **HIDDEN** | No results visible |
| **COUNTS** | Aggregated totals per option |
| **DETAILS** | Full results including free-text responses and names (if anonymisation is off) |

### Live Statistics

The dashboard shows in real time:
- **Participant count** — unique participants who submitted
- **Submission count** — total individual question responses

### Typical Session Flow

1. **Before the session:** Create poll, add questions, position on canvas
2. **Start session:** Open the facilitator dashboard
3. **Share the poll URL** with participants (e.g., via chat or screen share)
4. **Open voting** — participants can now submit
5. **Monitor** submissions via the live statistics
6. **Close voting** when ready (participants are notified within 5 seconds)
7. **Reveal results** progressively: HIDDEN → COUNTS → DETAILS
8. **Toggle anonymisation** off if you want to show who said what

---

## Test Mode

Preview the participant experience without polluting real data:

1. Click **Preview as Participant** in the facilitator dashboard
2. A new tab opens with `?testMode=true`
3. Submit test responses — they're tagged as test data
4. View test responses in the **Test Responses** tab
5. Click **Clear Test Responses** to remove them (real data is unaffected)

---

## Viewing Results

### Results Tab

The Results tab shows aggregated data per question:
- Option counts and percentages (bar chart)
- Free-text responses grouped under "Custom"
- "No responses yet" for questions with zero submissions

### Privacy Controls

- When **anonymisation is on**: No real names appear anywhere
- When **anonymisation is off** + **DETAILS** reveal: Names shown alongside responses
- Free-text section is hidden when no custom entries exist

---

## Tips

- Always test your poll before a live session using Test Mode
- Keep voting open long enough for all participants to submit
- Use the HIDDEN → COUNTS → DETAILS progression to build suspense
- Enable anonymisation for sensitive topics to encourage honest feedback
- The "Another facilitator session may be active" warning appears if multiple people open the facilitator view — changes use last-write-wins

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid or missing admin token" | Re-enter your admin token on the login page |
| Results not updating | Enable "Live Results" toggle |
| Participants can't submit | Check that voting is open |
| Poll not showing for participants | Ensure the poll isn't deleted |
| Connection lost | Check your internet; the app retries automatically |

---

*SprintPulse v1.0.0*
