# Design Document

## Overview

This design extends the mobile `ListLayout` component to render the poll's background image as a sticky, full-width header with a 16:9 aspect ratio. The image remains fixed at the top of the viewport while participants scroll through questions, providing the same visual context available on desktop.

## Architecture

### Component Hierarchy

```
ParticipantForm
├── CanvasLayout (desktop: width >= 768px, has canvas positions)
│   └── backgroundImageUrl rendered as CSS background-image
└── ListLayout (mobile: width < 768px)
    ├── StickyImageContainer (new, conditional on backgroundImageUrl)
    │   └── <img> element with error handling
    └── Question list (scrollable beneath image)
```

### Data Flow

1. `ParticipantForm` passes `backgroundImageUrl` to `ListLayout` (currently omitted from props)
2. `ListLayout` conditionally renders `StickyImageContainer` when `backgroundImageUrl` is non-null
3. `StickyImageContainer` manages its own visibility state based on image load success/failure

## Components and Interfaces

### ListLayout Changes

The `ListLayout` component type changes from `Omit<LayoutProps, 'backgroundImageUrl'>` to include `backgroundImageUrl`:

```typescript
function ListLayout({
  questions,
  backgroundImageUrl,
  selections,
  customTexts,
  errors,
  onOptionSelect,
  onCustomTextChange,
  disabled,
}: LayoutProps) {
  return (
    <div role="list" aria-label="Poll questions">
      {backgroundImageUrl && (
        <StickyImageContainer imageUrl={backgroundImageUrl} />
      )}
      <div style={{ /* question list container */ }}>
        {questions.map((question) => (
          // ... existing question rendering
        ))}
      </div>
    </div>
  );
}
```

### StickyImageContainer (New Component)

A self-contained component that renders the background image with sticky positioning and handles load errors.

```typescript
interface StickyImageContainerProps {
  imageUrl: string;
}

function StickyImageContainer({ imageUrl }: StickyImageContainerProps) {
  const [isVisible, setIsVisible] = useState(true);

  function handleImageError() {
    setIsVisible(false);
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="img"
      aria-label="Poll background image"
      style={{
        position: 'sticky',
        top: 0,
        width: '100vw',
        marginLeft: 'calc(-50vw + 50%)',
        aspectRatio: '16 / 9',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      <img
        src={imageUrl}
        alt=""
        onError={handleImageError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </div>
  );
}
```

### ParticipantForm Changes

Pass `backgroundImageUrl` to `ListLayout`:

```typescript
<ListLayout
  questions={sortedQuestions}
  backgroundImageUrl={poll.backgroundImageUrl}
  selections={selections}
  customTexts={customTexts}
  errors={errors}
  onOptionSelect={handleOptionSelect}
  onCustomTextChange={handleCustomTextChange}
  disabled={votingClosed}
/>
```

### Updated Type Signature

```typescript
// Before: ListLayout used Omit<LayoutProps, 'backgroundImageUrl'>
// After: ListLayout uses the full LayoutProps interface

interface LayoutProps {
  questions: Question[];
  backgroundImageUrl?: string | null;
  selections: Record<string, string>;
  customTexts: Record<string, string>;
  errors: Record<string, string>;
  onOptionSelect: (questionId: string, option: string) => void;
  onCustomTextChange: (questionId: string, text: string) => void;
  disabled: boolean;
}
```

### StickyImageContainer Props

```typescript
interface StickyImageContainerProps {
  imageUrl: string;
}
```

## Styling Strategy

All styling uses inline styles with CSS custom properties, consistent with the existing codebase pattern.

### Sticky Positioning

- `position: sticky` with `top: 0` keeps the image fixed at the viewport top during scroll
- `zIndex: 10` ensures the image stays above scrolling question cards

### Full-Width Edge-to-Edge

- `width: 100vw` ensures the image spans the full viewport width
- `marginLeft: calc(-50vw + 50%)` breaks out of any parent padding/container constraints to achieve true edge-to-edge rendering

### 16:9 Aspect Ratio

- `aspectRatio: '16 / 9'` on the container maintains the ratio at any viewport width
- The container height is implicitly `viewport_width * 9 / 16`

### Image Scaling

- `objectFit: 'cover'` on the `<img>` element scales the image to fill the container, cropping as needed without distortion

### Question List Offset

- The sticky container occupies space in the normal document flow, so the question list naturally starts below it
- When scrolled, questions slide beneath the sticky container due to z-index layering

## Data Models

No new data models are introduced. The existing `PublicPollView.backgroundImageUrl` field (type `string | null`) is the sole data source. The `LayoutProps` interface is updated to include `backgroundImageUrl` as an optional nullable string, matching the existing pattern used by `CanvasLayout`.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `backgroundImageUrl` is `null` | No `StickyImageContainer` rendered |
| Image URL fails to load (404, network error) | `onError` handler sets `isVisible` to `false`, component returns `null` |
| Image loads successfully | Container remains visible with sticky behavior |

## Accessibility

- `StickyImageContainer` has `role="img"` and `aria-label="Poll background image"` for screen reader identification
- The inner `<img>` uses `alt=""` since the role/aria-label on the container provides the accessible name (the image is decorative context, not informational)
- Question list remains fully scrollable and reachable; the sticky container does not trap focus or block interaction

## Testing Strategy

### Unit Tests (Example-Based)
- Verify full-width styling (100vw, no padding/margin) — Requirements 2.1
- Verify `object-fit: cover` on the image element — Requirements 2.3
- Verify `position: sticky` and `top: 0` on the container — Requirements 3.1
- Verify z-index layering between container and question list — Requirements 3.2
- Verify `role="img"` and `aria-label` attributes present — Requirements 4.2
- Verify TypeScript compilation accepts `backgroundImageUrl` on ListLayout — Requirements 1.3

### Property Tests (100+ iterations each)
- Property 1: Non-null image URL renders sticky container
- Property 2: Null image URL renders no container
- Property 3: Aspect ratio invariant (height = width * 9/16)
- Property 4: All questions remain scrollable with sticky container present
- Property 5: Failed image load hides container

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Non-null image URL renders sticky container

*For any* non-null, non-empty `backgroundImageUrl` string passed to `ListLayout`, the rendered output SHALL contain a `StickyImageContainer` element with the image URL applied.

**Validates: Requirements 1.1**

### Property 2: Null image URL renders no container

*For any* render of `ListLayout` where `backgroundImageUrl` is `null` or `undefined`, the rendered output SHALL NOT contain a `StickyImageContainer` element.

**Validates: Requirements 1.2**

### Property 3: Aspect ratio invariant

*For any* viewport width, the `StickyImageContainer` height SHALL equal the viewport width multiplied by 9/16, maintaining a 16:9 aspect ratio.

**Validates: Requirements 2.2, 3.3**

### Property 4: All questions remain scrollable

*For any* list of N questions (where N >= 1) rendered in `ListLayout` with a `StickyImageContainer` present, all N question cards SHALL be reachable within the scrollable area below the sticky container.

**Validates: Requirements 4.1**

### Property 5: Failed image load hides container

*For any* `backgroundImageUrl` that triggers an image load error, the `StickyImageContainer` SHALL remove itself from the visible DOM, leaving no empty placeholder.

**Validates: Requirements 4.3**
