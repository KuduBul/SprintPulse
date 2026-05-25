# Implementation Plan: Mobile Background Image

## Overview

Extend the mobile `ListLayout` component in `ParticipantForm.tsx` to display the poll's background image as a sticky, full-width 16:9 header. This involves changing the `ListLayout` type signature, creating a `StickyImageContainer` inline component, passing `backgroundImageUrl` from `ParticipantForm`, and handling error/accessibility concerns.

## Tasks

- [x] 1. Update ListLayout type and add backgroundImageUrl prop
  - [x] 1.1 Change ListLayout signature from `Omit<LayoutProps, 'backgroundImageUrl'>` to `LayoutProps`
    - Update the function parameter type in `components/participant/ParticipantForm.tsx`
    - Destructure `backgroundImageUrl` in the ListLayout function parameters
    - _Requirements: 1.3_

  - [x] 1.2 Pass `backgroundImageUrl` from ParticipantForm to ListLayout
    - Add `backgroundImageUrl={poll.backgroundImageUrl}` to the `<ListLayout>` JSX in the ParticipantForm render section
    - _Requirements: 1.3_

- [x] 2. Implement StickyImageContainer component
  - [x] 2.1 Create the StickyImageContainer component inline in `components/participant/ParticipantForm.tsx`
    - Define `StickyImageContainerProps` interface with `imageUrl: string`
    - Implement `useState` for `isVisible` with `true` default
    - Add `onError` handler that sets `isVisible` to `false`
    - Return `null` when `!isVisible` (graceful error hiding)
    - Apply sticky positioning: `position: 'sticky'`, `top: 0`, `zIndex: 10`
    - Apply full-width: `width: '100vw'`, `marginLeft: 'calc(-50vw + 50%)'`
    - Apply aspect ratio: `aspectRatio: '16 / 9'`, `overflow: 'hidden'`
    - Render `<img>` with `objectFit: 'cover'`, `width: '100%'`, `height: '100%'`, `display: 'block'`
    - Add `role="img"` and `aria-label="Poll background image"` on the container
    - Set `alt=""` on the inner `<img>` element
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.3, 4.2, 4.3_

  - [x] 2.2 Integrate StickyImageContainer into ListLayout
    - Conditionally render `<StickyImageContainer imageUrl={backgroundImageUrl} />` when `backgroundImageUrl` is non-null
    - Ensure question list renders below the sticky container in normal document flow
    - _Requirements: 1.1, 1.2, 3.2, 4.1_

- [x] 3. Checkpoint - Verify component renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Write tests for StickyImageContainer and ListLayout changes
  - [x] 4.1 Write property test: Non-null image URL renders sticky container
    - **Property 1: Non-null image URL renders sticky container**
    - **Validates: Requirements 1.1**

  - [x] 4.2 Write property test: Null image URL renders no container
    - **Property 2: Null image URL renders no container**
    - **Validates: Requirements 1.2**

  - [x] 4.3 Write property test: Aspect ratio invariant
    - **Property 3: Aspect ratio invariant (height = width * 9/16)**
    - **Validates: Requirements 2.2, 3.3**

  - [x] 4.4 Write property test: All questions remain scrollable
    - **Property 4: All questions remain scrollable with sticky container present**
    - **Validates: Requirements 4.1**

  - [x] 4.5 Write property test: Failed image load hides container
    - **Property 5: Failed image load hides container**
    - **Validates: Requirements 4.3**

  - [x] 4.6 Write unit tests for styling and accessibility
    - Verify `position: sticky` and `top: 0` on the container
    - Verify `width: 100vw` and edge-to-edge margin calculation
    - Verify `object-fit: cover` on the image element
    - Verify `role="img"` and `aria-label` attributes present
    - Verify z-index layering between container and question list
    - _Requirements: 2.1, 2.3, 3.1, 3.2, 4.2_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All changes are contained within `components/participant/ParticipantForm.tsx`
- Uses Vitest with React Testing Library and fast-check for property tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"] }
  ]
}
```
