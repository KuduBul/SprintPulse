# Requirements Document

## Introduction

The mobile participant view (accessed via QR code) currently does not display the poll's background image. This feature redesigns the mobile `ListLayout` component to render the background image as a sticky, full-width element with a 16:9 aspect ratio positioned above the questions, remaining visible while the participant scrolls through the question list.

## Glossary

- **ListLayout**: The vertical list layout component used for rendering poll questions on mobile viewports (width < 768px)
- **CanvasLayout**: The desktop layout component that renders questions at canvas positions over a background image
- **ParticipantForm**: The top-level participant-facing form component that selects between CanvasLayout and ListLayout based on viewport size
- **Background_Image**: The poll's `backgroundImageUrl` property, a URL string or null, representing the visual context image configured by the facilitator
- **Sticky_Image_Container**: The container element that holds the background image at the top of the mobile viewport and remains fixed during scroll

## Requirements

### Requirement 1

**User Story:** As a mobile participant, I want to see the poll's background image displayed above the questions, so that I have the same visual context as desktop participants.

#### Acceptance Criteria

1. WHEN the ParticipantForm renders on a mobile viewport and the Background_Image is not null, THE ListLayout SHALL display the Background_Image in a Sticky_Image_Container positioned above the question list.
2. WHEN the ParticipantForm renders on a mobile viewport and the Background_Image is null, THE ListLayout SHALL render the question list without a Sticky_Image_Container.
3. THE ListLayout SHALL accept the `backgroundImageUrl` property from the ParticipantForm component.

### Requirement 2

**User Story:** As a mobile participant, I want the background image to maintain a 16:9 aspect ratio at full viewport width, so that the image displays consistently across different mobile devices.

#### Acceptance Criteria

1. THE Sticky_Image_Container SHALL render the Background_Image at full viewport width (edge-to-edge, no horizontal padding or margin).
2. THE Sticky_Image_Container SHALL maintain a 16:9 aspect ratio regardless of the device viewport width.
3. THE Sticky_Image_Container SHALL scale the Background_Image to cover the entire container area without distortion, cropping as needed to preserve the aspect ratio.

### Requirement 3

**User Story:** As a mobile participant, I want the background image to remain visible at the top of the screen while I scroll through questions, so that I can reference the image context at any time.

#### Acceptance Criteria

1. WHILE the participant scrolls through the question list, THE Sticky_Image_Container SHALL remain fixed at the top of the viewport.
2. THE question list content SHALL scroll beneath the Sticky_Image_Container without overlapping the image visually.
3. THE Sticky_Image_Container SHALL occupy a fixed vertical space equal to the viewport width multiplied by 9/16 so that the question list is offset below the image.

### Requirement 4

**User Story:** As a mobile participant, I want the layout to remain usable and accessible with the sticky image present, so that I can still answer all questions comfortably.

#### Acceptance Criteria

1. THE ListLayout SHALL ensure all question cards remain fully reachable by scrolling, even with the Sticky_Image_Container occupying top viewport space.
2. THE Sticky_Image_Container SHALL include an accessible `role` attribute and descriptive `aria-label` so that screen readers identify the image region.
3. IF the Background_Image fails to load, THEN THE Sticky_Image_Container SHALL hide itself gracefully without leaving an empty placeholder visible to the participant.
