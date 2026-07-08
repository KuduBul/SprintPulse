'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/lib/hooks/useApi';

interface LaneView {
  id: string;
  title: string;
  displayOrder: number;
  icon: string | null;
  color: string | null;
  cardCount: number;
}

interface BoardView {
  id: string;
  votesPerUser: number;
  lanes: LaneView[];
}

interface RetroSettingsEditorProps {
  /** RetroBoard.id */
  boardId: string;
}

const MIN_LANES = 1;
const MAX_LANES = 8;
const EMOJI_CHOICES = ['📝', '🚀', '🛑', '✅', '❤️', '📚', '⭐', '😡', '😢', '😊', '💨', '⚓', '🪨', '🏝️', '🎯', '💡', '🔥', '🎉'];

/**
 * Edit-time settings for a retro board: per-user vote cap and column
 * (lane) management. Reuses the same lane CRUD API routes as the facilitate
 * screen so behaviour is consistent. Template switching is intentionally not
 * offered here because it would destroy existing lanes and cards.
 */
export function RetroSettingsEditor({ boardId }: RetroSettingsEditorProps) {
  const { get, post, patch, del } = useApi();

  const [board, setBoard] = useState<BoardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [votes, setVotes] = useState(3);
  const [votesSaving, setVotesSaving] = useState(false);
  const [votesMessage, setVotesMessage] = useState<string | null>(null);

  const [busyLaneId, setBusyLaneId] = useState<string | null>(null);
  const [addingLane, setAddingLane] = useState(false);

  const fetchBoard = useCallback(async () => {
    const res = await get<BoardView>(`/api/retro/${boardId}?role=facilitator`);
    if (res.error) {
      setError(res.error.message || 'Failed to load retro board.');
      setLoading(false);
      return;
    }
    if (res.data) {
      setBoard(res.data);
      setVotes(res.data.votesPerUser);
    }
    setLoading(false);
  }, [boardId, get]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const refreshLanes = useCallback(async () => {
    const res = await get<BoardView>(`/api/retro/${boardId}?role=facilitator`);
    if (res.data) setBoard(res.data);
  }, [boardId, get]);

  async function handleSaveVotes() {
    setVotesSaving(true);
    setVotesMessage(null);
    const res = await patch(`/api/retro/${boardId}`, { votesPerUser: votes });
    setVotesSaving(false);
    if (res.error) {
      setVotesMessage(res.error.message || 'Failed to update votes per user.');
      return;
    }
    setVotesMessage('Saved.');
  }

  async function handleAddLane() {
    if (!board || board.lanes.length >= MAX_LANES) return;
    setAddingLane(true);
    const res = await post(`/api/retro/${boardId}/lanes`, {
      title: 'New Column',
      icon: '📝',
      color: '#4CAF50',
    });
    setAddingLane(false);
    if (!res.error) await refreshLanes();
  }

  async function handleUpdateLane(laneId: string, updates: { title?: string; icon?: string | null; color?: string | null }) {
    setBusyLaneId(laneId);
    const res = await patch(`/api/retro/${boardId}/lanes/${laneId}`, updates);
    setBusyLaneId(null);
    if (!res.error) await refreshLanes();
  }

  async function handleDeleteLane(laneId: string) {
    if (!board || board.lanes.length <= MIN_LANES) return;
    if (!confirm('Delete this column? Any cards in it will also be removed.')) return;
    setBusyLaneId(laneId);
    const res = await del(`/api/retro/${boardId}/lanes/${laneId}`);
    setBusyLaneId(null);
    if (!res.error) await refreshLanes();
  }

  if (loading) {
    return <p style={{ color: 'var(--color-text-secondary)' }}>Loading retro settings...</p>;
  }

  if (error) {
    return <p style={{ color: 'var(--color-error-600)' }}>{error}</p>;
  }

  if (!board) return null;

  const lanes = [...board.lanes].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Votes per user */}
      <div>
        <label htmlFor="retro-votes" style={{ display: 'block', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-2)' }}>
          Votes Per User
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <input
            id="retro-votes"
            type="number"
            min={1}
            max={20}
            value={votes}
            onChange={(e) => setVotes(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
            style={{ width: '80px', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-base)' }}
          />
          <button
            type="button"
            onClick={handleSaveVotes}
            disabled={votesSaving || votes === board.votesPerUser}
            style={{ padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-primary-700)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: votesSaving || votes === board.votesPerUser ? 'not-allowed' : 'pointer', opacity: votesSaving || votes === board.votesPerUser ? 0.5 : 1, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}
          >
            {votesSaving ? 'Saving...' : 'Save Votes'}
          </button>
          {votesMessage && (
            <span style={{ fontSize: 'var(--font-size-sm)', color: votesMessage === 'Saved.' ? 'var(--color-success-600, green)' : 'var(--color-error-600)' }}>
              {votesMessage}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-1)' }}>
          Maximum votes each participant can cast (1–20).
        </p>
      </div>

      {/* Columns */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', margin: 0 }}>
            Columns ({lanes.length}/{MAX_LANES})
          </h3>
          <button
            type="button"
            onClick={handleAddLane}
            disabled={addingLane || lanes.length >= MAX_LANES}
            style={{ padding: 'var(--space-2) var(--space-4)', backgroundColor: 'var(--color-primary-700)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: addingLane || lanes.length >= MAX_LANES ? 'not-allowed' : 'pointer', opacity: addingLane || lanes.length >= MAX_LANES ? 0.5 : 1, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}
          >
            + Add Column
          </button>
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {lanes.map((lane) => (
            <LaneRow
              key={lane.id}
              lane={lane}
              busy={busyLaneId === lane.id}
              canDelete={lanes.length > MIN_LANES}
              emojiChoices={EMOJI_CHOICES}
              onSave={(updates) => handleUpdateLane(lane.id, updates)}
              onDelete={() => handleDeleteLane(lane.id)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

interface LaneRowProps {
  lane: LaneView;
  busy: boolean;
  canDelete: boolean;
  emojiChoices: string[];
  onSave: (updates: { title?: string; icon?: string | null; color?: string | null }) => void;
  onDelete: () => void;
}

function LaneRow({ lane, busy, canDelete, emojiChoices, onSave, onDelete }: LaneRowProps) {
  const [title, setTitle] = useState(lane.title);
  const [icon, setIcon] = useState(lane.icon || '');
  const [color, setColor] = useState(lane.color || '#4CAF50');
  const [showEmoji, setShowEmoji] = useState(false);

  useEffect(() => {
    setTitle(lane.title);
    setIcon(lane.icon || '');
    setColor(lane.color || '#4CAF50');
  }, [lane.title, lane.icon, lane.color]);

  const dirty = title.trim() !== lane.title || (icon || null) !== lane.icon || color !== (lane.color || '#4CAF50');
  const titleValid = title.trim().length >= 1 && title.trim().length <= 100;

  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)' }}>
      {/* Emoji picker */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setShowEmoji((s) => !s)}
          aria-label="Choose column icon"
          style={{ padding: 'var(--space-2)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-bg-primary)', cursor: 'pointer', fontSize: 'var(--font-size-base)', minHeight: '40px', minWidth: '40px' }}
        >
          {icon || '😀'}
        </button>
        {showEmoji && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-1)', padding: 'var(--space-2)', backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.15))' }}>
            {emojiChoices.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { setIcon(e); setShowEmoji(false); }}
                aria-label={`Select ${e}`}
                style={{ padding: 'var(--space-1)', border: 'none', backgroundColor: icon === e ? 'var(--color-primary-100)' : 'transparent', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--font-size-base)', minHeight: '32px', minWidth: '32px' }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Color */}
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        aria-label="Column color"
        style={{ width: '40px', height: '40px', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: 0 }}
      />

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        aria-label={`Column title for ${lane.title}`}
        style={{ flex: 1, padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)' }}
      />

      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
        {lane.cardCount} {lane.cardCount === 1 ? 'card' : 'cards'}
      </span>

      <button
        type="button"
        onClick={() => onSave({ title: title.trim(), icon: icon || null, color })}
        disabled={busy || !dirty || !titleValid}
        style={{ padding: 'var(--space-1) var(--space-3)', backgroundColor: 'var(--color-primary-700)', color: 'var(--color-text-on-primary)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: busy || !dirty || !titleValid ? 'not-allowed' : 'pointer', opacity: busy || !dirty || !titleValid ? 0.5 : 1, fontSize: 'var(--font-size-xs)' }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy || !canDelete}
        aria-label={`Delete column ${lane.title}`}
        title={canDelete ? 'Delete column' : 'A board must have at least one column'}
        style={{ padding: 'var(--space-1) var(--space-2)', backgroundColor: 'var(--color-error-50)', border: '1px solid var(--color-error-300)', borderRadius: 'var(--radius-sm)', color: 'var(--color-error-700)', cursor: busy || !canDelete ? 'not-allowed' : 'pointer', opacity: busy || !canDelete ? 0.5 : 1, fontSize: 'var(--font-size-xs)' }}
      >
        🗑️
      </button>
    </li>
  );
}
