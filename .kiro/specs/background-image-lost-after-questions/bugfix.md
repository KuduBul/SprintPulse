# Bugfix Requirements Document

## Introduction

The background image selected during poll creation is never uploaded to storage, and when editing a poll the image upload is disconnected from the question-editing workflow. This means a facilitator who selects a background image during poll creation loses it entirely because the creation flow ignores the image file. Additionally, when a facilitator edits a poll (to add questions), the background image state is not properly carried through the full editing lifecycle — the image must be re-uploaded separately from the question-editing flow, creating confusion and data loss.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a facilitator creates a new poll and selects a background image file THEN the system ignores the image file entirely — it is never uploaded to storage and the poll is created without a backgroundImageUrl

1.2 WHEN a facilitator creates a poll with a background image and is redirected to the admin dashboard THEN the system does not provide an opportunity to upload the image before redirect, resulting in the image being lost

1.3 WHEN a facilitator edits a poll that has no background image (because it was lost during creation) and adds questions THEN the system shows no background image in the canvas editor because it was never persisted

### Expected Behavior (Correct)

2.1 WHEN a facilitator creates a new poll and selects a background image file THEN the system SHALL upload the image to storage and associate the resulting URL with the newly created poll before completing the creation flow

2.2 WHEN a facilitator creates a poll with a background image THEN the system SHALL persist the backgroundImageUrl on the poll record so it is available when the facilitator later edits the poll or adds questions

2.3 WHEN a facilitator edits a poll that has a background image and adds questions THEN the system SHALL retain the existing backgroundImageUrl on the poll — the background image SHALL remain visible in the canvas editor throughout the question-editing workflow

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a facilitator creates a poll without selecting a background image THEN the system SHALL CONTINUE TO create the poll successfully with a null backgroundImageUrl

3.2 WHEN a facilitator edits a poll and uploads a new background image via the edit form THEN the system SHALL CONTINUE TO upload the new image and update the poll's backgroundImageUrl

3.3 WHEN a facilitator edits a poll and changes only the title or description (without selecting a new image) THEN the system SHALL CONTINUE TO preserve the existing backgroundImageUrl unchanged

3.4 WHEN a facilitator adds, edits, or deletes questions on a poll THEN the system SHALL CONTINUE TO leave the poll's backgroundImageUrl unchanged in the database

3.5 WHEN a facilitator positions questions on the canvas THEN the system SHALL CONTINUE TO display the existing background image behind the positioned questions
