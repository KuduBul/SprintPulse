'use client';

import { useEffect, useRef, useMemo } from 'react';
import { BoardView } from '@/lib/services/retroService';
import { RetroBoardView } from './RetroBoardView';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface PreviewFacilityProps {
  board: BoardView;
  isOpen: boolean;
  onClose: () => void;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const PHASE_LABELS: Record<string, { label: string; icon: string }> = {
  gather: { label: 'Gathering Cards', icon: '🟢' },
  vote: { label: 'Voting', icon: '🗳️' },
  closed: { label: 'Closed', icon: '🔒' },
};

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

/**
 * PreviewFacility — Modal showing the participant view of the retro board.
 *
 * Renders the RetroBoardView component in read-only mode:
 * - Strips author names (applies anonymity)
 * - Shows phase indicator at top
 * - All interactive elements are disabled or hidden
 * - Dismissible via close button or Escape key
 */
export function PreviewFacility({ board, isOpen, onClose }: PreviewFacilityProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button on open
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Escape key dismissal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Apply anonymity: strip author names from non-facilitator view
  const anonymizedBoard = useMemo<BoardView>(() => {
    return {
      ...board,
      lanes: board.lanes.map((lane) => ({
        ...lane,
        cards: lane.cards.map((card) => ({
          ...card,
          authorName: null,
          authorToken: null,
          isOwn: false,
        })),
      })),
    };
  }, [board]);

  if (!isOpen) return null;

  const phaseInfo = PHASE_LABELS[board.phase] ?? { label: board.phase, icon: '⚡' };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 150ms ease',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          margin: 'var(--space-6) auto',
          width: '95%',
          maxWidth: '1200px',
          maxHeight: 'calc(100vh - 3rem)',
          backgroundColor: 'var(--color-bg-page)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-4) var(--space-6)',
            borderBottom: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-bg-primary)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span
              style={{
                padding: 'var(--space-1) var(--space-3)',
                backgroundColor: 'var(--color-warning-100)',
                color: 'var(--color-warning-800)',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-semibold)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              👁️ Preview as Participant
            </span>
            <h2
              id="preview-dialog-title"
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                margin: 0,
                color: 'var(--color-text-primary)',
              }}
            >
              Participant View
            </h2>
          </div>

          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close preview"
            style={{
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
              transition: 'background-color var(--transition-fast)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Phase indicator */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-6)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderBottom: '1px solid var(--color-border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 'var(--font-size-base)' }}>{phaseInfo.icon}</span>
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Current phase: {phaseInfo.label}
          </span>
        </div>

        {/* Board content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-6)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
          aria-label="Preview of participant board view (read-only)"
        >
          <RetroBoardView board={anonymizedBoard} />
        </div>
      </div>
    </div>
  );
}
