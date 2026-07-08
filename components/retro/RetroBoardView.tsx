'use client';

import { useState, useEffect } from 'react';
import { BoardView, BoardLaneView, BoardCardView } from '@/lib/services/retroService';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface LanePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RetroBoardViewProps {
  board: BoardView;
  /** Optional background image URL to display behind positioned lanes on desktop. */
  backgroundImageUrl?: string | null;
  /** Optional board title to display in mobile header. */
  boardTitle?: string;
}

// --------------------------------------------------------------------------
// Viewport hook (independent of pulse canvas)
// --------------------------------------------------------------------------

type ViewportMode = 'desktop' | 'mobile';

function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return window.innerWidth >= 768 ? 'desktop' : 'mobile';
  });

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');

    function handleChange(e: MediaQueryListEvent) {
      setMode(e.matches ? 'desktop' : 'mobile');
    }

    // Set initial
    setMode(mql.matches ? 'desktop' : 'mobile');

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return mode;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * Parse a lane's position field into a typed position, or return null if
 * the position is not set or invalid.
 */
function parseLanePosition(position: unknown): LanePosition | null {
  if (!position || typeof position !== 'object') return null;
  const p = position as Record<string, unknown>;
  if (
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    typeof p.width === 'number' &&
    typeof p.height === 'number'
  ) {
    return { x: p.x, y: p.y, width: p.width, height: p.height };
  }
  return null;
}

/**
 * Determine if any lane has a defined position. If all are null, we use
 * the even-column fallback layout.
 */
function hasPositionedLanes(lanes: BoardLaneView[]): boolean {
  return lanes.some((lane) => parseLanePosition(lane.position) !== null);
}

// --------------------------------------------------------------------------
// Main Component
// --------------------------------------------------------------------------

export function RetroBoardView({ board, backgroundImageUrl, boardTitle }: RetroBoardViewProps) {
  const viewportMode = useViewportMode();

  const sortedLanes = [...board.lanes].sort((a, b) => a.displayOrder - b.displayOrder);

  if (viewportMode === 'mobile') {
    return (
      <MobileBoardView
        board={board}
        lanes={sortedLanes}
        backgroundImageUrl={backgroundImageUrl}
        boardTitle={boardTitle}
      />
    );
  }

  return (
    <DesktopBoardView
      board={board}
      lanes={sortedLanes}
      backgroundImageUrl={backgroundImageUrl}
    />
  );
}

// --------------------------------------------------------------------------
// Desktop Board View
// --------------------------------------------------------------------------

interface DesktopBoardViewProps {
  board: BoardView;
  lanes: BoardLaneView[];
  backgroundImageUrl?: string | null;
}

function DesktopBoardView({ board, lanes, backgroundImageUrl }: DesktopBoardViewProps) {
  const usePositioned = hasPositionedLanes(lanes);

  // Resolve background: prefer explicit prop, then board.backgroundImage JSON field
  const bgConfig = board.backgroundImage;
  const resolvedBgUrl = backgroundImageUrl ?? bgConfig?.url ?? null;

  if (usePositioned) {
    return (
      <PositionedDesktopLayout
        lanes={lanes}
        backgroundImageUrl={resolvedBgUrl}
        backgroundOpacity={bgConfig?.opacity}
        backgroundDisplayMode={bgConfig?.displayMode}
        phase={board.phase}
      />
    );
  }

  return (
    <ColumnDesktopLayout
      lanes={lanes}
      phase={board.phase}
      backgroundImageUrl={resolvedBgUrl}
      backgroundOpacity={bgConfig?.opacity}
      backgroundDisplayMode={bgConfig?.displayMode}
    />
  );
}

// --------------------------------------------------------------------------
// Positioned Desktop Layout — lanes at percentage coordinates
// --------------------------------------------------------------------------

interface PositionedDesktopLayoutProps {
  lanes: BoardLaneView[];
  backgroundImageUrl?: string | null;
  backgroundOpacity?: number;
  backgroundDisplayMode?: 'cover' | 'contain';
  phase: string;
}

function PositionedDesktopLayout({ lanes, backgroundImageUrl, backgroundOpacity, backgroundDisplayMode, phase }: PositionedDesktopLayoutProps) {
  const opacity = backgroundOpacity != null ? backgroundOpacity / 100 : 1;
  const displayMode = backgroundDisplayMode ?? 'cover';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '600px',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        backgroundColor: 'var(--color-bg-canvas)',
        fontFamily: 'var(--font-family-sans)',
      }}
      role="region"
      aria-label="Retro board"
    >
      {/* Background image layer — lazy loaded, error-resilient */}
      {backgroundImageUrl && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${backgroundImageUrl})`,
            backgroundSize: displayMode,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity,
            zIndex: 0,
            transition: 'opacity var(--transition-normal)',
          }}
        />
      )}
      {lanes.map((lane) => {
        const pos = parseLanePosition(lane.position);
        if (!pos) {
          // Lane without position in a positioned layout — skip or render at default
          return null;
        }

        return (
          <div
            key={lane.id}
            style={{
              position: 'absolute',
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: `${pos.width}%`,
              height: `${pos.height}%`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <LaneColumn lane={lane} phase={phase} />
          </div>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------------
// Column Desktop Layout — evenly spaced columns (fallback)
// --------------------------------------------------------------------------

interface ColumnDesktopLayoutProps {
  lanes: BoardLaneView[];
  phase: string;
  backgroundImageUrl?: string | null;
  backgroundOpacity?: number;
  backgroundDisplayMode?: 'cover' | 'contain';
}

function ColumnDesktopLayout({ lanes, phase, backgroundImageUrl, backgroundOpacity, backgroundDisplayMode }: ColumnDesktopLayoutProps) {
  const opacity = backgroundOpacity != null ? backgroundOpacity / 100 : 1;
  const displayMode = backgroundDisplayMode ?? 'cover';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '400px',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Background image layer — lazy loaded, error-resilient */}
      {backgroundImageUrl && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${backgroundImageUrl})`,
            backgroundSize: displayMode,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity,
            zIndex: 0,
            transition: 'opacity var(--transition-normal)',
          }}
        />
      )}

      {/* Semi-transparent overlay for readability when background is set */}
      {backgroundImageUrl && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            zIndex: 1,
          }}
        />
      )}

      {/* Lane columns */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(lanes.length, 4)}, 1fr)`,
          gap: 'var(--space-4)',
          width: '100%',
          minHeight: '400px',
          fontFamily: 'var(--font-family-sans)',
        }}
        role="region"
        aria-label="Retro board"
      >
        {lanes.map((lane) => (
          <LaneColumn key={lane.id} lane={lane} phase={phase} />
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Mobile Board View — vertical stack
// --------------------------------------------------------------------------

interface MobileBoardViewProps {
  board: BoardView;
  lanes: BoardLaneView[];
  backgroundImageUrl?: string | null;
  boardTitle?: string;
}

function MobileBoardView({ board, lanes, backgroundImageUrl, boardTitle }: MobileBoardViewProps) {
  return (
    <div
      style={{
        width: '100%',
        fontFamily: 'var(--font-family-sans)',
      }}
      role="region"
      aria-label="Retro board"
    >
      {/* Header with board title/image */}
      <div
        style={{
          marginBottom: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          backgroundColor: 'var(--color-bg-secondary)',
        }}
      >
        {backgroundImageUrl && (
          <div
            style={{
              width: '100%',
              height: '120px',
              backgroundImage: `url(${backgroundImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
            role="img"
            aria-label="Board background"
          />
        )}
        <div
          style={{
            padding: 'var(--space-4)',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            {boardTitle || board.template.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </h2>
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              margin: 'var(--space-1) 0 0 0',
              textTransform: 'capitalize',
            }}
          >
            Phase: {board.phase}
          </p>
        </div>
      </div>

      {/* Stacked lanes */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        {lanes.map((lane) => (
          <LaneColumn key={lane.id} lane={lane} phase={board.phase} isMobile />
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Lane Column — shared between desktop and mobile
// --------------------------------------------------------------------------

interface LaneColumnProps {
  lane: BoardLaneView;
  phase: string;
  isMobile?: boolean;
}

function LaneColumn({ lane, phase, isMobile = false }: LaneColumnProps) {
  const sortedCards = [...lane.cards].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-default)',
        overflow: 'hidden',
      }}
      role="group"
      aria-label={`Lane: ${lane.title}`}
    >
      {/* Lane header */}
      <div
        style={{
          padding: isMobile ? 'var(--space-4)' : 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--color-border-default)',
          backgroundColor: lane.color
            ? `${lane.color}18`
            : 'var(--color-bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: isMobile ? '48px' : 'auto',
        }}
      >
        <h3
          style={{
            fontSize: isMobile ? 'var(--font-size-base)' : 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          {lane.icon && (
            <span aria-label={`Lane icon: ${lane.icon}`} role="img">
              {lane.icon}
            </span>
          )}
          {lane.title}
        </h3>
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
            backgroundColor: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-full)',
            padding: '0.125rem var(--space-2)',
            fontWeight: 'var(--font-weight-medium)',
            whiteSpace: 'nowrap',
          }}
          aria-label={`${lane.cardCount} cards`}
        >
          {lane.cardCount}
        </span>
      </div>

      {/* Card list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        {sortedCards.length === 0 && (
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)',
              textAlign: 'center',
              padding: 'var(--space-4) 0',
              margin: 0,
            }}
          >
            No cards yet
          </p>
        )}
        {sortedCards.map((card) => (
          <RetroCardView key={card.id} card={card} phase={phase} isMobile={isMobile} />
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Retro Card View — individual card display
// --------------------------------------------------------------------------

interface RetroCardViewProps {
  card: BoardCardView;
  phase: string;
  isMobile?: boolean;
}

function RetroCardView({ card, phase, isMobile = false }: RetroCardViewProps) {
  const showVotes = phase === 'vote' || phase === 'closed';

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-md)',
        padding: isMobile ? 'var(--space-4)' : 'var(--space-3)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'box-shadow var(--transition-fast)',
        // Touch-friendly minimum height on mobile
        minHeight: isMobile ? '56px' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
      role="article"
      aria-label={`Card: ${card.text.slice(0, 50)}${card.text.length > 50 ? '…' : ''}`}
    >
      {/* Card text */}
      <p
        style={{
          fontSize: isMobile ? 'var(--font-size-base)' : 'var(--font-size-sm)',
          lineHeight: 'var(--line-height-normal)',
          color: 'var(--color-text-primary)',
          margin: 0,
          wordBreak: 'break-word',
        }}
      >
        {card.text}
      </p>

      {/* Footer: author name + votes */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
        }}
      >
        {/* Author attribution */}
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {card.isOwn && '(You) '}
          {card.authorName || (card.isOwn ? '' : 'Anonymous')}
        </span>

        {/* Vote count — shown during vote/closed phases */}
        {showVotes && (
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-medium)',
              color: card.voteCount > 0 ? 'var(--color-primary-700)' : 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              // Touch-friendly tap target size on mobile
              padding: isMobile ? 'var(--space-2)' : '0',
              minWidth: isMobile ? '44px' : 'auto',
              minHeight: isMobile ? '44px' : 'auto',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: isMobile ? 'var(--color-bg-tertiary)' : 'transparent',
            }}
            aria-label={`${card.voteCount} vote${card.voteCount !== 1 ? 's' : ''}`}
          >
            👍 {card.voteCount}
          </span>
        )}
      </div>
    </div>
  );
}
