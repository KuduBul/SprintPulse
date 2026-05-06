'use client';

import { useState, useEffect, useCallback } from 'react';
import { PollCanvas } from './PollCanvas';
import { CanvasFallback } from './CanvasFallback';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface Position {
  x: number;      // 0-100 percentage
  y: number;      // 0-100 percentage
  width: number;  // 0-100 percentage
  height: number; // 0-100 percentage
}

interface Question {
  id: string;
  text: string;
  options: string[];
  allowCustom: boolean;
  position: Position | null;
  displayOrder: number;
}

interface ResponsivePollCanvasProps {
  pollId: string;
  questions: Question[];
  backgroundImageUrl: string | null;
  onQuestionPositionChange: (questionId: string, position: Position) => void;
  onQuestionRemoveFromCanvas: (questionId: string) => void;
}

type ViewportMode = 'desktop' | 'tablet' | 'mobile';

// --------------------------------------------------------------------------
// Hooks
// --------------------------------------------------------------------------

function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return getViewportMode(window.innerWidth);
  });

  useEffect(() => {
    function handleResize() {
      setMode(getViewportMode(window.innerWidth));
    }

    // Use matchMedia for efficient breakpoint detection
    const desktopMql = window.matchMedia('(min-width: 1024px)');
    const tabletMql = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');

    function handleChange() {
      handleResize();
    }

    desktopMql.addEventListener('change', handleChange);
    tabletMql.addEventListener('change', handleChange);

    // Set initial value
    handleResize();

    return () => {
      desktopMql.removeEventListener('change', handleChange);
      tabletMql.removeEventListener('change', handleChange);
    };
  }, []);

  return mode;
}

function getViewportMode(width: number): ViewportMode {
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

function useDragAndDropSupport(): boolean {
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof document === 'undefined') {
      setSupported(true);
      return;
    }
    const div = document.createElement('div');
    setSupported('draggable' in div);
  }, []);

  return supported;
}

function useImageLoadState(url: string | null): { loaded: boolean; error: boolean } {
  const [state, setState] = useState<{ loaded: boolean; error: boolean }>({
    loaded: false,
    error: false,
  });

  useEffect(() => {
    if (!url) {
      setState({ loaded: false, error: false });
      return;
    }

    const img = new Image();
    img.onload = () => setState({ loaded: true, error: false });
    img.onerror = () => setState({ loaded: false, error: true });
    img.src = url;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  return state;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export function ResponsivePollCanvas({
  pollId,
  questions,
  backgroundImageUrl,
  onQuestionPositionChange,
  onQuestionRemoveFromCanvas,
}: ResponsivePollCanvasProps) {
  const viewportMode = useViewportMode();
  const dndSupported = useDragAndDropSupport();
  const imageState = useImageLoadState(backgroundImageUrl);

  // Determine the effective background URL (null if image failed to load)
  const effectiveBackgroundUrl = imageState.error ? null : backgroundImageUrl;

  // Mobile: vertical scrollable list
  if (viewportMode === 'mobile') {
    return (
      <MobileQuestionList
        questions={questions}
        backgroundImageUrl={backgroundImageUrl}
        imageError={imageState.error}
      />
    );
  }

  // Tablet: view-only canvas
  if (viewportMode === 'tablet') {
    return (
      <ViewOnlyCanvas
        questions={questions}
        backgroundImageUrl={effectiveBackgroundUrl}
        imageError={imageState.error}
      />
    );
  }

  // Desktop: full editor
  // If DnD not supported, show fallback with coordinate inputs
  if (!dndSupported) {
    return (
      <div>
        {imageState.error && (
          <ImageErrorBanner />
        )}
        <CanvasFallback
          questions={questions}
          onQuestionPositionChange={onQuestionPositionChange}
        />
      </div>
    );
  }

  // Desktop with DnD support: full PollCanvas editor
  return (
    <div>
      {imageState.error && (
        <ImageErrorBanner />
      )}
      <PollCanvas
        pollId={pollId}
        questions={questions}
        backgroundImageUrl={effectiveBackgroundUrl}
        onQuestionPositionChange={onQuestionPositionChange}
        onQuestionRemoveFromCanvas={onQuestionRemoveFromCanvas}
      />
    </div>
  );
}

// --------------------------------------------------------------------------
// MobileQuestionList — vertical scrollable list for <768px
// --------------------------------------------------------------------------

interface MobileQuestionListProps {
  questions: Question[];
  backgroundImageUrl: string | null;
  imageError: boolean;
}

function MobileQuestionList({ questions, backgroundImageUrl, imageError }: MobileQuestionListProps) {
  const sortedQuestions = [...questions].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div
      style={{
        fontFamily: 'var(--font-family-sans)',
        maxHeight: '600px',
        overflowY: 'auto',
      }}
      role="list"
      aria-label="Poll questions"
    >
      {imageError && (
        <ImageErrorBanner />
      )}

      {sortedQuestions.length === 0 && (
        <p
          style={{
            padding: 'var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
          }}
        >
          No questions added yet.
        </p>
      )}

      {sortedQuestions.map((question) => (
        <div
          key={question.id}
          role="listitem"
          style={{
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
          }}
          aria-label={question.text}
        >
          <p
            style={{
              margin: '0 0 var(--space-2) 0',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)',
            }}
          >
            {question.text}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-muted)',
            }}
          >
            {question.options.length} options
            {question.allowCustom && ' • Custom text allowed'}
          </p>
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------
// ViewOnlyCanvas — shows placed questions without drag/resize (768–1023px)
// --------------------------------------------------------------------------

interface ViewOnlyCanvasProps {
  questions: Question[];
  backgroundImageUrl: string | null;
  imageError: boolean;
}

function ViewOnlyCanvas({ questions, backgroundImageUrl, imageError }: ViewOnlyCanvasProps) {
  const placedQuestions = questions.filter((q) => q.position !== null);
  const unplacedQuestions = questions.filter((q) => q.position === null);

  return (
    <div
      style={{
        fontFamily: 'var(--font-family-sans)',
      }}
    >
      {imageError && (
        <ImageErrorBanner />
      )}

      {/* View-only info banner */}
      <div
        role="status"
        style={{
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--color-primary-50)',
          border: '1px solid var(--color-primary-200)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-3)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-primary-800)',
        }}
      >
        View-only mode. Use a larger screen to edit question positions.
      </div>

      {/* Canvas area (no interaction) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '450px',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '2px solid var(--color-border-strong)',
          backgroundColor: backgroundImageUrl ? undefined : 'var(--color-bg-canvas)',
          backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
        role="img"
        aria-label="Poll canvas preview"
      >
        {!backgroundImageUrl && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-sm)',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <p style={{ margin: 0 }}>No background image set</p>
          </div>
        )}

        {/* Placed questions (view-only, no drag/resize) */}
        {placedQuestions.map((question, index) => {
          const pos = question.position!;
          return (
            <div
              key={question.id}
              style={{
                position: 'absolute',
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${pos.width}%`,
                height: `${pos.height}%`,
                zIndex: index + 1,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
              aria-label={question.text}
            >
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {question.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Unplaced questions listed below */}
      {unplacedQuestions.length > 0 && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <h4
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Unplaced Questions
          </h4>
          {unplacedQuestions.map((question) => (
            <div
              key={question.id}
              style={{
                padding: 'var(--space-3)',
                marginBottom: 'var(--space-2)',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-primary)',
              }}
              aria-label={question.text}
            >
              {question.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// ImageErrorBanner — shown when background image fails to load
// --------------------------------------------------------------------------

function ImageErrorBanner() {
  return (
    <div
      role="alert"
      style={{
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: 'var(--color-error-50)',
        border: '1px solid var(--color-error-200)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--space-3)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
      }}
    >
      <span
        style={{
          fontSize: 'var(--font-size-lg)',
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        🖼️
      </span>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-error-700)',
          fontWeight: 'var(--font-weight-medium)',
        }}
      >
        Background image failed to load. Questions remain interactive on the placeholder canvas.
      </p>
    </div>
  );
}
