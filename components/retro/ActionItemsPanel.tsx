'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '@/lib/hooks/useApi';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface ActionItemsPanelProps {
  boardId: string;
  phase: string;
  role: 'facilitator' | 'participant';
}

interface ActionItem {
  id: string;
  boardId: string;
  text: string;
  owner: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

/**
 * ActionItemsPanel — Displays and manages action items for a retro board.
 *
 * Behavior:
 * - gather phase: renders nothing
 * - vote/closed + facilitator: full CRUD (add, edit, delete)
 * - closed + participant: read-only list
 *
 * Polls every 3s to stay current, or re-fetches on mutations.
 */
export function ActionItemsPanel({ boardId, phase, role }: ActionItemsPanelProps) {
  const { get, post, patch, del } = useApi();

  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [text, setText] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Don't render during gather phase
  const shouldRender = phase === 'vote' || phase === 'closed';
  const canEdit = role === 'facilitator' && (phase === 'vote' || phase === 'closed');
  const isReadOnly = role === 'participant' && phase === 'closed';

  // Fetch action items
  const fetchItems = useCallback(async () => {
    const res = await get<ActionItem[]>(
      `/api/retro/${boardId}/action-items?role=${role}`
    );
    if (res.data) {
      setItems(res.data);
      setError(null);
    } else if (res.error) {
      setError(res.error.message || 'Failed to load action items');
    }
    setLoading(false);
  }, [get, boardId, role]);

  // Polling
  useEffect(() => {
    if (!shouldRender) return;

    fetchItems();
    pollingRef.current = setInterval(fetchItems, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchItems, shouldRender]);

  // Show temporary feedback
  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  }, []);

  // Add action item
  const handleAdd = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText || trimmedText.length > 500) return;

    setSubmitting(true);
    const res = await post(`/api/retro/${boardId}/action-items`, {
      text: trimmedText,
      owner: assignee.trim() || null,
      dueDate: dueDate || null,
    });

    if (res.data) {
      setText('');
      setAssignee('');
      setDueDate('');
      showFeedback('success', 'Action item added');
      fetchItems();
    } else if (res.error) {
      showFeedback('error', res.error.message || 'Failed to add item');
    }
    setSubmitting(false);
  }, [text, assignee, dueDate, boardId, post, fetchItems, showFeedback]);

  // Start editing
  const startEdit = useCallback((item: ActionItem) => {
    setEditingId(item.id);
    setEditText(item.text);
    setEditAssignee(item.owner || '');
    setEditDueDate(item.dueDate ? item.dueDate.split('T')[0] : '');
  }, []);

  // Save edit
  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    const trimmedText = editText.trim();
    if (!trimmedText || trimmedText.length > 500) return;

    const res = await patch(`/api/retro/${boardId}/action-items/${editingId}`, {
      text: trimmedText,
      owner: editAssignee.trim() || null,
      dueDate: editDueDate || null,
    });

    if (res.data || res.status === 200) {
      setEditingId(null);
      showFeedback('success', 'Action item updated');
      fetchItems();
    } else if (res.error) {
      showFeedback('error', res.error.message || 'Failed to update item');
    }
  }, [editingId, editText, editAssignee, editDueDate, boardId, patch, fetchItems, showFeedback]);

  // Delete action item
  const handleDelete = useCallback(async (itemId: string) => {
    const res = await del(`/api/retro/${boardId}/action-items/${itemId}`);
    if (res.status < 400) {
      setDeletingId(null);
      showFeedback('success', 'Action item deleted');
      fetchItems();
    } else if (res.error) {
      showFeedback('error', res.error.message || 'Failed to delete item');
    }
  }, [boardId, del, fetchItems, showFeedback]);

  // Don't render during gather phase
  if (!shouldRender) return null;

  // Participant in non-closed phase: nothing to show
  if (role === 'participant' && phase !== 'closed') return null;

  return (
    <section
      aria-label="Action items"
      style={{
        padding: 'var(--space-6)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-bg-secondary)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-4)',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <span>📋</span> Action Items
          {items.length > 0 && (
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                backgroundColor: 'var(--color-primary-100)',
                color: 'var(--color-primary-800)',
                borderRadius: 'var(--radius-full)',
                padding: '0.125rem var(--space-2)',
                fontWeight: 'var(--font-weight-medium)',
              }}
            >
              {items.length}
            </span>
          )}
        </h2>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginBottom: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            backgroundColor: feedback.type === 'success' ? 'var(--color-success-50)' : 'var(--color-error-50)',
            color: feedback.type === 'success' ? 'var(--color-success-700)' : 'var(--color-error-700)',
            border: `1px solid ${feedback.type === 'success' ? 'var(--color-success-200)' : 'var(--color-error-200)'}`,
          }}
        >
          {feedback.type === 'success' ? '✓' : '✗'} {feedback.message}
        </div>
      )}

      {/* Add form (facilitator only) */}
      {canEdit && (
        <div
          style={{
            marginBottom: 'var(--space-5)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-bg-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label
              htmlFor="action-item-text"
              style={{
                display: 'block',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--space-1)',
              }}
            >
              Action Item
            </label>
            <textarea
              id="action-item-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe the action item..."
              maxLength={500}
              rows={2}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family-sans)',
                resize: 'vertical',
                minHeight: '60px',
              }}
            />
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-muted)',
                textAlign: 'right',
                marginTop: 'var(--space-1)',
              }}
            >
              {text.length}/500
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label
                htmlFor="action-item-assignee"
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Assignee
              </label>
              <input
                id="action-item-assignee"
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Who's responsible?"
                maxLength={100}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'var(--font-family-sans)',
                  minHeight: '44px',
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label
                htmlFor="action-item-date"
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Due Date
              </label>
              <input
                id="action-item-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'var(--font-family-sans)',
                  minHeight: '44px',
                }}
              />
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={submitting || text.trim().length === 0}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: text.trim().length > 0 ? 'var(--color-primary-700)' : 'var(--color-neutral-300)',
              color: 'var(--color-text-inverse)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: text.trim().length > 0 && !submitting ? 'pointer' : 'not-allowed',
              minHeight: '44px',
              transition: 'opacity var(--transition-fast)',
              opacity: submitting ? 0.7 : 1,
            }}
            aria-label="Add action item"
          >
            {submitting ? 'Adding...' : '+ Add Action Item'}
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Loading action items...
        </p>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <p style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-size-sm)',
          textAlign: 'center',
          padding: 'var(--space-6) 0',
        }}>
          No action items yet.
          {canEdit && ' Add one using the form above.'}
        </p>
      )}

      {/* Items list */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {items.map((item) => {
            // Editing mode
            if (editingId === item.id && canEdit) {
              return (
                <div
                  key={item.id}
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-bg-primary)',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--color-border-focus)',
                  }}
                >
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    maxLength={500}
                    rows={2}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2)',
                      border: '1px solid var(--color-border-default)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-sm)',
                      fontFamily: 'var(--font-family-sans)',
                      resize: 'vertical',
                      marginBottom: 'var(--space-2)',
                    }}
                    aria-label="Edit action item text"
                  />
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={editAssignee}
                      onChange={(e) => setEditAssignee(e.target.value)}
                      placeholder="Assignee"
                      maxLength={100}
                      style={{
                        flex: 1,
                        minWidth: '120px',
                        padding: 'var(--space-2)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-sm)',
                        fontFamily: 'var(--font-family-sans)',
                        minHeight: '44px',
                      }}
                      aria-label="Edit assignee"
                    />
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: '120px',
                        padding: 'var(--space-2)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-sm)',
                        fontFamily: 'var(--font-family-sans)',
                        minHeight: '44px',
                      }}
                      aria-label="Edit due date"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-bg-primary)',
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-sm)',
                        cursor: 'pointer',
                        minHeight: '44px',
                        minWidth: '44px',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={editText.trim().length === 0}
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-primary-600)',
                        color: 'var(--color-text-inverse)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        cursor: 'pointer',
                        minHeight: '44px',
                        minWidth: '44px',
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            }

            // Delete confirmation mode
            if (deletingId === item.id && canEdit) {
              return (
                <div
                  key={item.id}
                  style={{
                    padding: 'var(--space-4)',
                    backgroundColor: 'var(--color-error-50)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-error-200)',
                  }}
                >
                  <p style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-error-700)',
                    marginBottom: 'var(--space-3)',
                  }}>
                    Delete this action item?
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      onClick={() => setDeletingId(null)}
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-bg-primary)',
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-sm)',
                        cursor: 'pointer',
                        minHeight: '44px',
                        minWidth: '44px',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-error-600)',
                        color: 'var(--color-text-inverse)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        cursor: 'pointer',
                        minHeight: '44px',
                        minWidth: '44px',
                      }}
                      aria-label="Confirm delete"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            }

            // Normal display mode
            return (
              <div
                key={item.id}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                }}
              >
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-primary)',
                    margin: 0,
                    marginBottom: 'var(--space-2)',
                    lineHeight: 'var(--line-height-normal)',
                    wordBreak: 'break-word',
                  }}>
                    {item.text}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
                    {item.owner && (
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          backgroundColor: 'var(--color-secondary-100)',
                          color: 'var(--color-secondary-800)',
                          padding: '0.125rem var(--space-2)',
                          borderRadius: 'var(--radius-full)',
                          fontWeight: 'var(--font-weight-medium)',
                        }}
                      >
                        👤 {item.owner}
                      </span>
                    )}
                    {item.dueDate && (
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          backgroundColor: 'var(--color-warning-100)',
                          color: 'var(--color-warning-800)',
                          padding: '0.125rem var(--space-2)',
                          borderRadius: 'var(--radius-full)',
                          fontWeight: 'var(--font-weight-medium)',
                        }}
                      >
                        📅 {new Date(item.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions (facilitator only) */}
                {canEdit && (
                  <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                    <button
                      onClick={() => startEdit(item)}
                      aria-label={`Edit action item: ${item.text.slice(0, 30)}`}
                      style={{
                        minWidth: '44px',
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-base)',
                        transition: 'background-color var(--transition-fast)',
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setDeletingId(item.id)}
                      aria-label={`Delete action item: ${item.text.slice(0, 30)}`}
                      style={{
                        minWidth: '44px',
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-base)',
                        transition: 'background-color var(--transition-fast)',
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
