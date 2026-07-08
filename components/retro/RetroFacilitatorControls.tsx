'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@/lib/hooks/useApi';
import { BoardView, BoardLaneView } from '@/lib/services/retroService';
import { PollUrlDisplay } from '@/components/admin/PollUrlDisplay';
import { ExportDialog } from './ExportDialog';
import { PreviewFacility } from './PreviewFacility';
import { ActionItemsPanel } from './ActionItemsPanel';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface RetroFacilitatorControlsProps {
  boardId: string;
  pollTitle: string;
  accessToken?: string | null;
}

type RetroPhase = 'gather' | 'vote' | 'closed';

const PHASE_LABELS: Record<RetroPhase, string> = {
  gather: 'Gather',
  vote: 'Vote',
  closed: 'Closed',
};

const PHASE_DESCRIPTIONS: Record<RetroPhase, string> = {
  gather: 'Participants are adding cards to lanes',
  vote: 'Participants are voting on cards',
  closed: 'Board is read-only — session complete',
};

const NEXT_PHASE: Record<RetroPhase, RetroPhase | null> = {
  gather: 'vote',
  vote: 'closed',
  closed: null,
};

const MAX_LANES = 8;
const EMOJI_OPTIONS = ['📝', '💡', '🚀', '⭐', '🎯', '❤️', '🔥', '✅', '⚡', '🌟', '🛑', '⚓', '🏝️', '🎉', '😊', '😢', '😡'];

// --------------------------------------------------------------------------
// Lane Editor Sub-component
// --------------------------------------------------------------------------

interface LaneEditorProps {
  lane: BoardLaneView;
  boardId: string;
  laneCount: number;
  onMutate: () => void;
  onFeedback: (type: 'success' | 'error', msg: string) => void;
}

function LaneEditor({ lane, boardId, laneCount, onMutate, onFeedback }: LaneEditorProps) {
  const { patch, del } = useApi();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(lane.title);
  const [editIcon, setEditIcon] = useState(lane.icon || '');
  const [editColor, setEditColor] = useState(lane.color || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed.length > 100) return;
    setSaving(true);
    const res = await patch(`/api/retro/${boardId}/lanes/${lane.id}`, {
      title: trimmed,
      icon: editIcon || null,
      color: editColor || null,
    });
    if (res.status < 400) {
      setIsEditing(false);
      onFeedback('success', `Lane "${trimmed}" updated`);
      onMutate();
    } else {
      onFeedback('error', 'Failed to update lane');
    }
    setSaving(false);
  }, [editTitle, editIcon, editColor, boardId, lane.id, patch, onMutate, onFeedback]);

  const handleDelete = useCallback(async () => {
    const res = await del(`/api/retro/${boardId}/lanes/${lane.id}`);
    if (res.status < 400) {
      setConfirmDelete(false);
      onFeedback('success', `Lane "${lane.title}" deleted`);
      onMutate();
    } else {
      onFeedback('error', 'Failed to delete lane');
    }
  }, [boardId, lane.id, lane.title, del, onMutate, onFeedback]);

  if (confirmDelete) {
    return (
      <div style={{
        padding: 'var(--space-3)',
        backgroundColor: 'var(--color-error-50)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-error-200)',
      }}>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error-700)', margin: 0, marginBottom: 'var(--space-2)' }}>
          Delete &quot;{lane.title}&quot;? Cards in this lane will be removed.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{ padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', cursor: 'pointer', minHeight: '44px', minWidth: '44px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            style={{ padding: 'var(--space-2) var(--space-3)', border: 'none', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-error-600)', color: 'var(--color-text-inverse)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', cursor: 'pointer', minHeight: '44px', minWidth: '44px' }}
            aria-label="Confirm delete lane"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div style={{
        padding: 'var(--space-3)',
        backgroundColor: 'var(--color-bg-primary)',
        borderRadius: 'var(--radius-md)',
        border: '2px solid var(--color-border-focus)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}>
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          maxLength={100}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          style={{ width: '100%', padding: 'var(--space-2)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-sans)' }}
          aria-label="Lane title"
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              type="button"
              style={{ padding: 'var(--space-2)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-primary)', cursor: 'pointer', fontSize: 'var(--font-size-base)', minHeight: '44px', minWidth: '44px' }}
              aria-label="Pick emoji icon"
            >
              {editIcon || '😀'}
            </button>
            {showEmojiPicker && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 10,
                backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-md)', padding: 'var(--space-2)', boxShadow: 'var(--shadow-lg)',
                display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-1)', width: '200px',
              }}>
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { setEditIcon(emoji); setShowEmojiPicker(false); }}
                    style={{ padding: 'var(--space-1)', border: 'none', backgroundColor: editIcon === emoji ? 'var(--color-primary-100)' : 'transparent', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--font-size-base)', minHeight: '32px', minWidth: '32px' }}
                    aria-label={`Select ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            type="color"
            value={editColor || '#3396ff'}
            onChange={(e) => setEditColor(e.target.value)}
            style={{ width: '44px', height: '44px', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '2px' }}
            aria-label="Lane color"
          />
          {editColor && (
            <button
              onClick={() => setEditColor('')}
              style={{ padding: 'var(--space-1) var(--space-2)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-primary)', fontSize: 'var(--font-size-xs)', cursor: 'pointer', color: 'var(--color-text-secondary)', minHeight: '44px' }}
              aria-label="Clear color"
            >
              Clear
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setIsEditing(false)}
            style={{ padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', cursor: 'pointer', minHeight: '44px', minWidth: '44px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || editTitle.trim().length === 0}
            style={{ padding: 'var(--space-2) var(--space-3)', border: 'none', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-primary-600)', color: 'var(--color-text-inverse)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', cursor: 'pointer', minHeight: '44px', minWidth: '44px', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  // Normal display: lane header with edit/delete buttons
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 'var(--space-2) var(--space-3)',
      backgroundColor: lane.color ? `${lane.color}15` : 'var(--color-bg-primary)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border-default)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
        {lane.icon && <span style={{ fontSize: 'var(--font-size-base)' }}>{lane.icon}</span>}
        <span style={{
          fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: lane.color || 'var(--color-text-primary)',
        }}>
          {lane.title}
        </span>
        <span style={{
          fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
          backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-full)',
          padding: '0.125rem var(--space-2)', fontWeight: 'var(--font-weight-medium)',
        }}>
          {lane.cardCount}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
        <button
          onClick={() => { setEditTitle(lane.title); setEditIcon(lane.icon || ''); setEditColor(lane.color || ''); setIsEditing(true); }}
          aria-label={`Edit lane: ${lane.title}`}
          style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', transition: 'background-color var(--transition-fast)' }}
        >
          ✏️
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={laneCount <= 1}
          aria-label={`Delete lane: ${lane.title}`}
          style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', cursor: laneCount <= 1 ? 'not-allowed' : 'pointer', fontSize: 'var(--font-size-sm)', opacity: laneCount <= 1 ? 0.4 : 1, transition: 'background-color var(--transition-fast)' }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Main Component
// --------------------------------------------------------------------------

export function RetroFacilitatorControls({
  boardId,
  pollTitle,
  accessToken,
}: RetroFacilitatorControlsProps) {
  const { get, post } = useApi();

  const [board, setBoard] = useState<BoardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [showAuthors, setShowAuthors] = useState(false);
  const [stateAnnouncement, setStateAnnouncement] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [addingLane, setAddingLane] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Show temporary feedback toast
  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  }, []);

  // Fetch board view as facilitator
  const fetchBoard = useCallback(async () => {
    const res = await get<BoardView>(
      `/api/retro/${boardId}?role=facilitator`
    );
    if (res.data) {
      setBoard(res.data);
      setError(null);
    } else if (res.error) {
      setError(res.error.message || 'Failed to fetch board');
    }
    setLoading(false);
  }, [get, boardId]);

  // Poll board state every 3 seconds
  useEffect(() => {
    fetchBoard();
    pollingRef.current = setInterval(() => { fetchBoard(); }, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchBoard]);

  // Advance phase
  const handleAdvancePhase = useCallback(async () => {
    if (!board) return;
    const next = NEXT_PHASE[board.phase as RetroPhase];
    if (!next) return;
    setAdvancing(true);
    const res = await post(`/api/retro/${boardId}/phase`, { phase: next });
    if (res.data) {
      setBoard((prev) => prev ? { ...prev, phase: next } : prev);
      setStateAnnouncement(`Phase advanced to ${PHASE_LABELS[next]}`);
    } else if (res.error) {
      setStateAnnouncement(`Failed to advance phase: ${res.error.message}`);
    }
    setAdvancing(false);
  }, [board, boardId, post]);

  // Toggle reveal/anonymise
  const handleToggleReveal = useCallback(() => {
    setShowAuthors((prev) => {
      const next = !prev;
      setStateAnnouncement(next ? 'Author names revealed' : 'Author names hidden');
      return next;
    });
  }, []);

  // Add column
  const handleAddLane = useCallback(async () => {
    setAddingLane(true);
    const res = await post(`/api/retro/${boardId}/lanes`, {
      title: 'New Column',
      icon: '📝',
      color: null,
    });
    if (res.status < 400) {
      showFeedback('success', 'Column added');
      fetchBoard();
    } else {
      showFeedback('error', 'Failed to add column');
    }
    setAddingLane(false);
  }, [boardId, post, fetchBoard, showFeedback]);

  // Build poll URL for sharing
  const pollUrl = accessToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/poll/${accessToken}`
    : null;

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading retro facilitator controls...</p>
      </div>
    );
  }

  if (error && !board) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <p style={{ color: 'var(--color-error-600)' }}>{error}</p>
      </div>
    );
  }

  if (!board) return null;

  const currentPhase = board.phase as RetroPhase;
  const nextPhase = NEXT_PHASE[currentPhase];
  const isClosed = currentPhase === 'closed';
  const lanes = board.lanes ?? [];
  const totalCards = lanes.reduce((sum, lane) => sum + lane.cardCount, 0);
  const totalVotes = lanes.reduce(
    (sum, lane) => sum + (lane.cards ?? []).reduce((s, c) => s + c.voteCount, 0),
    0
  );

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Screen reader announcements */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only" role="status">
        {stateAnnouncement}
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', top: 'var(--space-4)', right: 'var(--space-4)', zIndex: 1100,
            padding: 'var(--space-3) var(--space-5)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
            fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)',
            backgroundColor: feedback.type === 'success' ? 'var(--color-success-600)' : 'var(--color-error-600)',
            color: 'var(--color-text-inverse)',
            animation: 'fadeIn 150ms ease',
          }}
        >
          {feedback.type === 'success' ? '✓' : '✗'} {feedback.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
          Facilitate Retro: {pollTitle}
        </h1>
      </div>

      {/* Share Section */}
      {pollUrl && (
        <section aria-label="Share retro" style={{ padding: 'var(--space-6)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)', backgroundColor: 'var(--color-bg-secondary)' }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-3)' }}>
            Share Retro
          </h2>
          <PollUrlDisplay url={pollUrl} />
        </section>
      )}

      {/* Phase Controls */}
      <section aria-label="Retro phase controls" style={{ padding: 'var(--space-6)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)', backgroundColor: 'var(--color-bg-secondary)' }}>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-4)' }}>
          Phase Controls
        </h2>

        {/* Phase indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }} role="group" aria-label="Board phase progression">
            {(['gather', 'vote', 'closed'] as RetroPhase[]).map((phase) => {
              const isActive = currentPhase === phase;
              const isPast = (currentPhase === 'vote' && phase === 'gather') || (currentPhase === 'closed' && (phase === 'gather' || phase === 'vote'));
              return (
                <div
                  key={phase}
                  style={{
                    padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)',
                    backgroundColor: isActive ? 'var(--color-primary-700)' : isPast ? 'var(--color-success-100)' : 'var(--color-bg-primary)',
                    color: isActive ? 'var(--color-text-inverse)' : isPast ? 'var(--color-success-700)' : 'var(--color-text-secondary)',
                    border: isActive ? '1px solid var(--color-primary-700)' : '1px solid var(--color-border-default)',
                  }}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isPast ? '✓ ' : ''}{PHASE_LABELS[phase]}
                </div>
              );
            })}
          </div>
        </div>

        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          {PHASE_DESCRIPTIONS[currentPhase]}
        </p>

        {/* Action buttons row */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {isClosed ? (
            <button disabled style={{ padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-neutral-300)', color: 'var(--color-text-secondary)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', cursor: 'not-allowed' }} aria-label="Board closed">
              Board Closed
            </button>
          ) : (
            <button
              onClick={handleAdvancePhase}
              disabled={advancing}
              style={{ padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-primary-700)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', cursor: advancing ? 'not-allowed' : 'pointer', opacity: advancing ? 0.7 : 1 }}
              aria-label={`Advance to ${nextPhase ? PHASE_LABELS[nextPhase] : ''} phase`}
            >
              {advancing ? 'Advancing...' : `Next Phase → ${nextPhase ? PHASE_LABELS[nextPhase] : ''}`}
            </button>
          )}

          <button
            onClick={handleToggleReveal}
            aria-pressed={showAuthors}
            aria-label={showAuthors ? 'Hide author names' : 'Show author names'}
            style={{ padding: 'var(--space-3) var(--space-4)', backgroundColor: showAuthors ? 'var(--color-success-600)' : 'var(--color-neutral-600)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', cursor: 'pointer' }}
          >
            {showAuthors ? '✓ Authors Revealed' : '✗ Anonymous'}
          </button>

          <button
            onClick={() => setExportOpen(true)}
            style={{ padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-secondary-700)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', cursor: 'pointer' }}
            aria-label="Export board"
          >
            Export Board
          </button>

          <button
            onClick={() => setPreviewOpen(true)}
            style={{ padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-warning-600)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', cursor: 'pointer' }}
            aria-label="Preview as participant"
          >
            👁️ Preview as Participant
          </button>
        </div>
      </section>

      {/* Live Stats */}
      <section aria-label="Retro statistics" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div style={{ padding: 'var(--space-4)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-700)' }}>{lanes.length}</div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Lanes</div>
        </div>
        <div style={{ padding: 'var(--space-4)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-700)' }}>{totalCards}</div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Cards</div>
        </div>
        <div style={{ padding: 'var(--space-4)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary-700)' }}>{totalVotes}</div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Votes</div>
        </div>
      </section>

      {/* Board Overview with lane management */}
      <section aria-label="Retro board overview" style={{ padding: 'var(--space-6)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg-secondary)', marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-4)' }}>
          Board Overview
        </h2>

        {lanes.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>No lanes on this board.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            {[...lanes]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((lane) => (
                <LaneEditor
                  key={lane.id}
                  lane={lane}
                  boardId={boardId}
                  laneCount={lanes.length}
                  onMutate={fetchBoard}
                  onFeedback={showFeedback}
                />
              ))}
          </div>
        )}

        {/* Add Column button */}
        {lanes.length < MAX_LANES && (
          <button
            onClick={handleAddLane}
            disabled={addingLane}
            style={{
              width: '100%', padding: 'var(--space-3)',
              border: '2px dashed var(--color-border-strong)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'transparent',
              color: 'var(--color-primary-600)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              cursor: addingLane ? 'not-allowed' : 'pointer',
              minHeight: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 'var(--space-2)',
              transition: 'background-color var(--transition-fast)',
              opacity: addingLane ? 0.7 : 1,
            }}
            aria-label="Add column"
          >
            {addingLane ? 'Adding...' : '+ Add Column'}
          </button>
        )}
      </section>

      {/* Board Cards View (read-only overview) */}
      <section aria-label="Retro board cards" style={{ padding: 'var(--space-6)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg-secondary)', marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-4)' }}>
          Cards
        </h2>
        {lanes.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>No lanes.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(lanes.length, 4)}, 1fr)`, gap: 'var(--space-4)' }}>
            {[...lanes].sort((a, b) => a.displayOrder - b.displayOrder).map((lane) => (
              <div key={lane.id} style={{ backgroundColor: 'var(--color-bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderBottom: '1px solid var(--color-border-default)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: lane.color ? `${lane.color}10` : 'var(--color-bg-primary)',
                  borderLeft: lane.color ? `3px solid ${lane.color}` : 'none',
                }}>
                  <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                    {lane.icon && <span>{lane.icon}</span>}
                    {lane.title}
                  </h3>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-full)', padding: '0.125rem var(--space-2)', fontWeight: 'var(--font-weight-medium)' }}>
                    {lane.cardCount}
                  </span>
                </div>
                <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '300px', overflowY: 'auto' }}>
                  {lane.cards.length === 0 ? (
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-2)', margin: 0 }}>No cards</p>
                  ) : (
                    lane.cards.map((card) => (
                      <div key={card.id} style={{ padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)', fontSize: 'var(--font-size-sm)' }}>
                        <p style={{ margin: 0, marginBottom: 'var(--space-1)' }}>{card.text}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                          <span>{showAuthors && card.authorName ? card.authorName : 'Anonymous'}</span>
                          <span style={{ fontWeight: 'var(--font-weight-medium)', color: card.voteCount > 0 ? 'var(--color-primary-700)' : 'var(--color-text-muted)' }}>
                            {card.voteCount} vote{card.voteCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Action Items Panel */}
      <ActionItemsPanel boardId={boardId} phase={currentPhase} role="facilitator" />

      {/* Export Dialog */}
      <ExportDialog boardId={boardId} isOpen={exportOpen} onClose={() => setExportOpen(false)} />

      {/* Preview Facility */}
      {board && (
        <PreviewFacility board={board} isOpen={previewOpen} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}
