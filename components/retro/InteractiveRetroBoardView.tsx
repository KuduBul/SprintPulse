'use client';

import { useState, useCallback, useRef } from 'react';
import { BoardView, BoardLaneView, BoardCardView } from '@/lib/services/retroService';
import { useParticipantToken } from '@/lib/hooks/useParticipantToken';
import { useApi } from '@/lib/hooks/useApi';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/**
 * Props for the interactive retro board wrapper. Provides the server-polled
 * board view and context needed to make mutations.
 */
export interface InteractiveRetroBoardViewProps {
  /** The latest server-polled board view (source of truth). */
  board: BoardView;
  /** The board ID used in API route paths. */
  boardId: string;
  /** Optional background image URL for the board. */
  backgroundImageUrl?: string | null;
  /** Optional board title for the mobile header. */
  boardTitle?: string;
  /** Callback invoked after a successful mutation to trigger a re-fetch. */
  onMutate?: () => void;
  /**
   * The poll ID used as the localStorage key for participant tokens.
   * If omitted, defaults to boardId. Participants store their token keyed by
   * pollId, so callers from the participant view should pass the poll's UUID.
   */
  participantPollId?: string;
}

/**
 * Optimistic state overlays on top of the server board view. Each operation
 * records its optimistic delta; on error or next poll cycle the optimistic
 * state is cleared and the server view becomes the sole source of truth.
 */
interface OptimisticState {
  /** Cards added optimistically (shown immediately in the lane). */
  addedCards: Map<string, BoardCardView>;
  /** Card IDs that have been optimistically deleted. */
  deletedCardIds: Set<string>;
  /** Card text edits keyed by card ID. */
  editedCards: Map<string, string>;
  /** Card IDs that have been optimistically voted on. */
  votedCardIds: Set<string>;
  /** Card IDs where the user's vote has been optimistically removed. */
  unvotedCardIds: Set<string>;
}

function emptyOptimisticState(): OptimisticState {
  return {
    addedCards: new Map(),
    deletedCardIds: new Set(),
    editedCards: new Map(),
    votedCardIds: new Set(),
    unvotedCardIds: new Set(),
  };
}

// --------------------------------------------------------------------------
// Hook: useOptimisticBoard
// --------------------------------------------------------------------------

/**
 * Manages optimistic overlays on the server board view. Resets when the
 * server board changes (detected by comparing board ID + lane card counts).
 */
function useOptimisticBoard(serverBoard: BoardView) {
  const [optimistic, setOptimistic] = useState<OptimisticState>(emptyOptimisticState);
  const prevBoardRef = useRef<string>('');

  // Reset optimistic state when server data changes (next poll cycle).
  // Keep optimistically-added cards until the server response reflects them,
  // to avoid flicker when read-after-write lag through PgBouncer means the
  // GET fires before the INSERT is visible on the read connection.
  const boardFingerprint = JSON.stringify({
    id: serverBoard.id,
    phase: serverBoard.phase,
    lanes: serverBoard.lanes.map((l) => ({ id: l.id, cc: l.cardCount, cards: l.cards.map((c) => c.id + c.text + c.voteCount) })),
  });

  if (boardFingerprint !== prevBoardRef.current) {
    prevBoardRef.current = boardFingerprint;
    if (
      optimistic.addedCards.size > 0 ||
      optimistic.deletedCardIds.size > 0 ||
      optimistic.editedCards.size > 0 ||
      optimistic.votedCardIds.size > 0 ||
      optimistic.unvotedCardIds.size > 0
    ) {
      // For everything except addedCards, clear immediately on fingerprint change.
      // For addedCards, clear only if the server response already includes them
      // (detected by checking if the server's total visible card count grew).
      // This prevents clearing an optimistic card that the server hasn't seen yet.
      const hasNonAddOptimistic =
        optimistic.deletedCardIds.size > 0 ||
        optimistic.editedCards.size > 0 ||
        optimistic.votedCardIds.size > 0 ||
        optimistic.unvotedCardIds.size > 0;

      if (hasNonAddOptimistic && optimistic.addedCards.size === 0) {
        setOptimistic(emptyOptimisticState());
      } else if (optimistic.addedCards.size > 0) {
        // Check if the server now includes the cards we added optimistically
        // by comparing text content. If a match is found, the card propagated.
        const serverCardTexts = new Set(
          serverBoard.lanes.flatMap((l) => l.cards.map((c) => c.text))
        );
        const allOptimisticConfirmed = [...optimistic.addedCards.values()].every(
          (oc) => serverCardTexts.has(oc.text)
        );
        if (allOptimisticConfirmed) {
          setOptimistic(emptyOptimisticState());
        } else if (hasNonAddOptimistic) {
          // Clear non-add optimistic state but keep addedCards that aren't confirmed
          setOptimistic((prev) => ({
            ...emptyOptimisticState(),
            addedCards: prev.addedCards,
          }));
        }
        // else: keep all optimistic state (cards not confirmed by server yet)
      } else {
        setOptimistic(emptyOptimisticState());
      }
    }
  }

  const addCard = useCallback((tempId: string, card: BoardCardView) => {
    setOptimistic((prev) => {
      const next = { ...prev, addedCards: new Map(prev.addedCards) };
      next.addedCards.set(tempId, card);
      return next;
    });
  }, []);

  const removeOptimisticCard = useCallback((tempId: string) => {
    setOptimistic((prev) => {
      const next = { ...prev, addedCards: new Map(prev.addedCards) };
      next.addedCards.delete(tempId);
      return next;
    });
  }, []);

  const deleteCard = useCallback((cardId: string) => {
    setOptimistic((prev) => {
      const next = { ...prev, deletedCardIds: new Set(prev.deletedCardIds) };
      next.deletedCardIds.add(cardId);
      return next;
    });
  }, []);

  const undeleteCard = useCallback((cardId: string) => {
    setOptimistic((prev) => {
      const next = { ...prev, deletedCardIds: new Set(prev.deletedCardIds) };
      next.deletedCardIds.delete(cardId);
      return next;
    });
  }, []);

  const editCard = useCallback((cardId: string, text: string) => {
    setOptimistic((prev) => {
      const next = { ...prev, editedCards: new Map(prev.editedCards) };
      next.editedCards.set(cardId, text);
      return next;
    });
  }, []);

  const uneditCard = useCallback((cardId: string) => {
    setOptimistic((prev) => {
      const next = { ...prev, editedCards: new Map(prev.editedCards) };
      next.editedCards.delete(cardId);
      return next;
    });
  }, []);

  const voteCard = useCallback((cardId: string) => {
    setOptimistic((prev) => {
      const next = {
        ...prev,
        votedCardIds: new Set(prev.votedCardIds),
        unvotedCardIds: new Set(prev.unvotedCardIds),
      };
      next.votedCardIds.add(cardId);
      next.unvotedCardIds.delete(cardId);
      return next;
    });
  }, []);

  const unvoteCard = useCallback((cardId: string) => {
    setOptimistic((prev) => {
      const next = {
        ...prev,
        unvotedCardIds: new Set(prev.unvotedCardIds),
        votedCardIds: new Set(prev.votedCardIds),
      };
      next.unvotedCardIds.add(cardId);
      next.votedCardIds.delete(cardId);
      return next;
    });
  }, []);

  const rollbackVote = useCallback((cardId: string) => {
    setOptimistic((prev) => {
      const next = { ...prev, votedCardIds: new Set(prev.votedCardIds) };
      next.votedCardIds.delete(cardId);
      return next;
    });
  }, []);

  const rollbackUnvote = useCallback((cardId: string) => {
    setOptimistic((prev) => {
      const next = { ...prev, unvotedCardIds: new Set(prev.unvotedCardIds) };
      next.unvotedCardIds.delete(cardId);
      return next;
    });
  }, []);

  return {
    optimistic,
    addCard,
    removeOptimisticCard,
    deleteCard,
    undeleteCard,
    editCard,
    uneditCard,
    voteCard,
    unvoteCard,
    rollbackVote,
    rollbackUnvote,
  };
}

// --------------------------------------------------------------------------
// Helper: apply optimistic overlays to produce a merged BoardView
// --------------------------------------------------------------------------

function applyOptimistic(serverBoard: BoardView, optimistic: OptimisticState): BoardView {
  return {
    ...serverBoard,
    lanes: serverBoard.lanes.map((lane) => {
      // Start with server cards, applying edits and deletes
      let cards = lane.cards
        .filter((c) => !optimistic.deletedCardIds.has(c.id))
        .map((c) => {
          const editedText = optimistic.editedCards.get(c.id);
          const voteAdjust =
            (optimistic.votedCardIds.has(c.id) ? 1 : 0) -
            (optimistic.unvotedCardIds.has(c.id) ? 1 : 0);
          return {
            ...c,
            text: editedText !== undefined ? editedText : c.text,
            voteCount: Math.max(0, c.voteCount + voteAdjust),
          };
        });

      // Add optimistically created cards for this lane
      for (const card of optimistic.addedCards.values()) {
        if (card.laneId === lane.id) {
          cards = [...cards, card];
        }
      }

      const cardCount =
        lane.cardCount -
        lane.cards.filter((c) => optimistic.deletedCardIds.has(c.id)).length +
        [...optimistic.addedCards.values()].filter((c) => c.laneId === lane.id).length;

      return {
        ...lane,
        cards,
        cardCount: Math.max(0, cardCount),
      };
    }),
  };
}

// --------------------------------------------------------------------------
// Main Interactive Component
// --------------------------------------------------------------------------

export function InteractiveRetroBoardView({
  board: serverBoard,
  boardId,
  backgroundImageUrl,
  boardTitle,
  onMutate,
  participantPollId,
}: InteractiveRetroBoardViewProps) {
  const { getParticipant } = useParticipantToken();
  const { post, patch, request } = useApi();
  const tokenKey = participantPollId ?? boardId;
  const participant = getParticipant(tokenKey);
  const participantToken = participant?.token ?? null;
  const participantName = participant?.name ?? 'Anonymous';

  const optimisticHook = useOptimisticBoard(serverBoard);
  const mergedBoard = applyOptimistic(serverBoard, optimisticHook.optimistic);

  // Track vote count for cap enforcement on the client side
  const currentVoteCount = serverBoard.lanes.reduce((total, lane) => {
    return total + lane.cards.filter((c) =>
      optimisticHook.optimistic.votedCardIds.has(c.id) ||
      // Count cards the user has already voted on (server truth)
      // We approximate by checking if it's own and voted
      false
    ).length;
  }, 0);

  // ---- Card Add ----
  const handleAddCard = useCallback(
    async (laneId: string, text: string) => {
      if (!participantToken || serverBoard.phase !== 'gather') return;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimisticCard: BoardCardView = {
        id: tempId,
        laneId,
        text,
        authorToken: participantToken,
        authorName: participantName,
        isOwn: true,
        voteCount: 0,
        hasVoted: false,
        createdAt: new Date(),
      };

      optimisticHook.addCard(tempId, optimisticCard);

      const res = await post(`/api/retro/${boardId}/cards`, {
        laneId,
        authorToken: participantToken,
        authorName: participantName,
        text,
      });

      if (res.status >= 400 || res.error) {
        // Roll back — remove the optimistic card
        optimisticHook.removeOptimisticCard(tempId);
      } else {
        onMutate?.();
      }
    },
    [participantToken, participantName, serverBoard.phase, boardId, post, optimisticHook, onMutate]
  );

  // ---- Card Edit ----
  const handleEditCard = useCallback(
    async (cardId: string, newText: string) => {
      if (!participantToken || serverBoard.phase !== 'gather') return;

      // Find original text for rollback
      const originalCard = serverBoard.lanes
        .flatMap((l) => l.cards)
        .find((c) => c.id === cardId);
      const originalText = originalCard?.text ?? '';

      optimisticHook.editCard(cardId, newText);

      const res = await patch(`/api/retro/${boardId}/cards/${cardId}`, {
        authorToken: participantToken,
        text: newText,
      });

      if (res.status >= 400 || res.error) {
        optimisticHook.uneditCard(cardId);
      } else {
        onMutate?.();
      }
    },
    [participantToken, serverBoard, boardId, patch, optimisticHook, onMutate]
  );

  // ---- Card Delete ----
  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      if (!participantToken || serverBoard.phase !== 'gather') return;

      optimisticHook.deleteCard(cardId);

      const res = await request(`/api/retro/${boardId}/cards/${cardId}`, {
        method: 'DELETE',
        body: JSON.stringify({ authorToken: participantToken }),
      });

      if (res.status >= 400 || res.error) {
        optimisticHook.undeleteCard(cardId);
      } else {
        onMutate?.();
      }
    },
    [participantToken, serverBoard.phase, boardId, request, optimisticHook, onMutate]
  );

  // ---- Vote ----
  const handleVote = useCallback(
    async (cardId: string) => {
      if (!participantToken || serverBoard.phase !== 'vote') return;

      optimisticHook.voteCard(cardId);

      const res = await post(`/api/retro/${boardId}/votes`, {
        cardId,
        voterToken: participantToken,
      });

      if (res.status >= 400 || res.error) {
        optimisticHook.rollbackVote(cardId);
      } else {
        onMutate?.();
      }
    },
    [participantToken, serverBoard.phase, boardId, post, optimisticHook, onMutate]
  );

  // ---- Unvote ----
  const handleUnvote = useCallback(
    async (cardId: string) => {
      if (!participantToken || serverBoard.phase !== 'vote') return;

      optimisticHook.unvoteCard(cardId);

      const res = await request(`/api/retro/${boardId}/votes`, {
        method: 'DELETE',
        body: JSON.stringify({ cardId, voterToken: participantToken }),
      });

      if (res.status >= 400 || res.error) {
        optimisticHook.rollbackUnvote(cardId);
      } else {
        onMutate?.();
      }
    },
    [participantToken, serverBoard.phase, boardId, request, optimisticHook, onMutate]
  );

  // Compute the user's total votes from server + optimistic state for cap checking
  const userVoteCount = computeUserVoteCount(serverBoard, optimisticHook.optimistic);

  return (
    <InteractiveBoardRenderer
      board={mergedBoard}
      backgroundImageUrl={backgroundImageUrl}
      boardTitle={boardTitle}
      participantToken={participantToken}
      votesPerUser={serverBoard.votesPerUser}
      userVoteCount={userVoteCount}
      onAddCard={handleAddCard}
      onEditCard={handleEditCard}
      onDeleteCard={handleDeleteCard}
      onVote={handleVote}
      onUnvote={handleUnvote}
      optimistic={optimisticHook.optimistic}
    />
  );
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * Computes the total number of votes the current user has cast, combining
 * server truth (cards marked `hasVoted`) with optimistic additions/removals.
 */
function computeUserVoteCount(serverBoard: BoardView, optimistic: OptimisticState): number {
  // Count cards the server already knows the user voted on.
  let serverVotes = 0;
  for (const lane of serverBoard.lanes) {
    for (const card of lane.cards) {
      if (card.hasVoted) serverVotes++;
    }
  }

  // Adjust for optimistic votes not yet confirmed by the server, and
  // optimistic unvotes not yet reflected in the server response.
  let optimisticAdded = 0;
  for (const cardId of optimistic.votedCardIds) {
    const alreadyCounted = serverBoard.lanes.some((l) =>
      l.cards.some((c) => c.id === cardId && c.hasVoted)
    );
    if (!alreadyCounted) optimisticAdded++;
  }

  let optimisticRemoved = 0;
  for (const cardId of optimistic.unvotedCardIds) {
    const wasCounted = serverBoard.lanes.some((l) =>
      l.cards.some((c) => c.id === cardId && c.hasVoted)
    );
    if (wasCounted) optimisticRemoved++;
  }

  return serverVotes + optimisticAdded - optimisticRemoved;
}

// --------------------------------------------------------------------------
// Interactive Board Renderer — extends layout with action affordances
// --------------------------------------------------------------------------

interface InteractiveBoardRendererProps {
  board: BoardView;
  backgroundImageUrl?: string | null;
  boardTitle?: string;
  participantToken: string | null;
  votesPerUser: number;
  userVoteCount: number;
  onAddCard: (laneId: string, text: string) => void;
  onEditCard: (cardId: string, newText: string) => void;
  onDeleteCard: (cardId: string) => void;
  onVote: (cardId: string) => void;
  onUnvote: (cardId: string) => void;
  optimistic: OptimisticState;
}

function InteractiveBoardRenderer({
  board,
  backgroundImageUrl,
  boardTitle,
  participantToken,
  votesPerUser,
  userVoteCount,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onVote,
  onUnvote,
  optimistic,
}: InteractiveBoardRendererProps) {
  const phase = board.phase;
  const isGather = phase === 'gather';
  const isVote = phase === 'vote';
  const isClosed = phase === 'closed';
  const atVoteCap = userVoteCount >= votesPerUser;

  return (
    <div>
      {/* Vote budget indicator during vote phase */}
      {isVote && participantToken && (
        <div
          style={{
            marginBottom: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
            fontSize: 'var(--font-size-sm)',
            color: atVoteCap ? 'var(--color-error-700)' : 'var(--color-text-secondary)',
            fontWeight: 'var(--font-weight-medium)',
          }}
          role="status"
          aria-live="polite"
        >
          Votes used: {userVoteCount} / {votesPerUser}
          {atVoteCap && ' — Vote limit reached'}
        </div>
      )}

      {/* Render the board using the same layout as RetroBoardView but with interactive lanes */}
      <InteractiveBoard
        board={board}
        backgroundImageUrl={backgroundImageUrl}
        boardTitle={boardTitle}
        isGather={isGather}
        isVote={isVote}
        isClosed={isClosed}
        atVoteCap={atVoteCap}
        participantToken={participantToken}
        onAddCard={onAddCard}
        onEditCard={onEditCard}
        onDeleteCard={onDeleteCard}
        onVote={onVote}
        onUnvote={onUnvote}
        optimistic={optimistic}
      />
    </div>
  );
}

// --------------------------------------------------------------------------
// Interactive Board — mirrors RetroBoardView structure with interactivity
// --------------------------------------------------------------------------

interface InteractiveBoardProps {
  board: BoardView;
  backgroundImageUrl?: string | null;
  boardTitle?: string;
  isGather: boolean;
  isVote: boolean;
  isClosed: boolean;
  atVoteCap: boolean;
  participantToken: string | null;
  onAddCard: (laneId: string, text: string) => void;
  onEditCard: (cardId: string, newText: string) => void;
  onDeleteCard: (cardId: string) => void;
  onVote: (cardId: string) => void;
  onUnvote: (cardId: string) => void;
  optimistic: OptimisticState;
}

function InteractiveBoard(props: InteractiveBoardProps) {
  const { board, backgroundImageUrl, boardTitle, ...rest } = props;
  const sortedLanes = [...board.lanes].sort((a, b) => a.displayOrder - b.displayOrder);
  const manyLanes = sortedLanes.length > 3;

  // Background image comes from the board's own backgroundImage config (the
  // retro-specific JSON field: { url, opacity, displayMode }). Fall back to the
  // legacy backgroundImageUrl prop if provided.
  const bg = board.backgroundImage;
  const bgUrl = bg?.url ?? backgroundImageUrl ?? null;
  const bgOpacity = bg ? Math.max(0, Math.min(100, bg.opacity)) / 100 : 1;
  const bgDisplayMode = bg?.displayMode ?? 'cover';

  // We render inline with the same layout patterns as RetroBoardView (column grid)
  // but add interactive elements. Desktop uses the column layout fallback.
  // On mobile with >3 lanes, use horizontal scroll with flex instead of grid.
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Background image layer — lazy-loaded, sits behind the columns. */}
      {bgUrl && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${bgUrl})`,
            backgroundSize: bgDisplayMode,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: bgOpacity,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: manyLanes ? 'flex' : 'grid',
          gridTemplateColumns: manyLanes ? undefined : `repeat(${Math.min(sortedLanes.length, 4)}, 1fr)`,
          overflowX: manyLanes ? 'auto' : undefined,
          WebkitOverflowScrolling: manyLanes ? 'touch' : undefined,
          gap: 'var(--space-3)',
          width: '100%',
          minHeight: '400px',
          fontFamily: 'var(--font-family-sans)',
          padding: bgUrl ? 'var(--space-3)' : undefined,
          paddingBottom: manyLanes ? 'var(--space-2)' : undefined,
        }}
        role="region"
        aria-label="Retro board"
      >
        {sortedLanes.map((lane) => (
          <div
            key={lane.id}
            style={{
              minWidth: manyLanes ? '280px' : undefined,
              flex: manyLanes ? '0 0 280px' : undefined,
            }}
          >
            <InteractiveLaneColumn
              lane={lane}
              {...rest}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Interactive Lane Column
// --------------------------------------------------------------------------

interface InteractiveLaneColumnProps {
  lane: BoardLaneView;
  isGather: boolean;
  isVote: boolean;
  isClosed: boolean;
  atVoteCap: boolean;
  participantToken: string | null;
  onAddCard: (laneId: string, text: string) => void;
  onEditCard: (cardId: string, newText: string) => void;
  onDeleteCard: (cardId: string) => void;
  onVote: (cardId: string) => void;
  onUnvote: (cardId: string) => void;
  optimistic: OptimisticState;
}

function InteractiveLaneColumn({
  lane,
  isGather,
  isVote,
  isClosed,
  atVoteCap,
  participantToken,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onVote,
  onUnvote,
  optimistic,
}: InteractiveLaneColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [addText, setAddText] = useState('');

  const sortedCards = [...lane.cards].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const handleSubmitAdd = () => {
    const trimmed = addText.trim();
    if (trimmed.length === 0 || trimmed.length > 2000) return;
    onAddCard(lane.id, trimmed);
    setAddText('');
    setIsAdding(false);
  };

  const handleCancelAdd = () => {
    setAddText('');
    setIsAdding(false);
  };

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
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--color-border-default)',
          backgroundColor: lane.color
            ? `${lane.color}18`
            : 'var(--color-bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '48px',
        }}
      >
        <h3
          style={{
            fontSize: 'var(--font-size-sm)',
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
          gap: 'var(--space-3)',
        }}
      >
        {sortedCards.length === 0 && !isAdding && (
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
          <InteractiveCardView
            key={card.id}
            card={card}
            isGather={isGather}
            isVote={isVote}
            isClosed={isClosed}
            atVoteCap={atVoteCap}
            participantToken={participantToken}
            onEditCard={onEditCard}
            onDeleteCard={onDeleteCard}
            onVote={onVote}
            onUnvote={onUnvote}
            isOptimisticVoted={optimistic.votedCardIds.has(card.id)}
            isOptimisticUnvoted={optimistic.unvotedCardIds.has(card.id)}
          />
        ))}

        {/* Add card form (gather phase only) */}
        {isGather && participantToken && isAdding && (
          <div
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-focus)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <textarea
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              placeholder="Type your card text..."
              maxLength={2000}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitAdd();
                }
                if (e.key === 'Escape') {
                  handleCancelAdd();
                }
              }}
              style={{
                width: '100%',
                minHeight: '60px',
                padding: 'var(--space-2)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family-sans)',
                resize: 'vertical',
                outline: 'none',
              }}
              aria-label="New card text"
            />
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCancelAdd}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: 'var(--font-size-sm)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  minHeight: '44px',
                  minWidth: '44px',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitAdd}
                disabled={addText.trim().length === 0}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: 'var(--font-size-sm)',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: addText.trim().length > 0 ? 'var(--color-primary-600)' : 'var(--color-neutral-300)',
                  color: 'var(--color-text-inverse)',
                  cursor: addText.trim().length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: 'var(--font-weight-medium)',
                  minHeight: '44px',
                  minWidth: '44px',
                }}
                aria-label="Submit card"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add card button (gather phase, at bottom of lane) */}
      {isGather && participantToken && !isAdding && (
        <div
          style={{
            padding: 'var(--space-3)',
            borderTop: '1px solid var(--color-border-default)',
          }}
        >
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            style={{
              width: '100%',
              padding: 'var(--space-3)',
              fontSize: 'var(--font-size-sm)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--color-border-strong)',
              backgroundColor: 'transparent',
              color: 'var(--color-primary-600)',
              cursor: 'pointer',
              fontWeight: 'var(--font-weight-medium)',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-1)',
              transition: 'background-color var(--transition-fast)',
            }}
            aria-label={`Add card to ${lane.title}`}
          >
            + Add card
          </button>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Interactive Card View
// --------------------------------------------------------------------------

interface InteractiveCardViewProps {
  card: BoardCardView;
  isGather: boolean;
  isVote: boolean;
  isClosed: boolean;
  atVoteCap: boolean;
  participantToken: string | null;
  onEditCard: (cardId: string, newText: string) => void;
  onDeleteCard: (cardId: string) => void;
  onVote: (cardId: string) => void;
  onUnvote: (cardId: string) => void;
  isOptimisticVoted: boolean;
  isOptimisticUnvoted: boolean;
}

function InteractiveCardView({
  card,
  isGather,
  isVote,
  isClosed,
  atVoteCap,
  participantToken,
  onEditCard,
  onDeleteCard,
  onVote,
  onUnvote,
  isOptimisticVoted,
  isOptimisticUnvoted,
}: InteractiveCardViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(card.text);

  const canEdit = isGather && card.isOwn && participantToken;
  const canDelete = isGather && card.isOwn && participantToken;
  const showVotes = isVote || isClosed;

  // Determine if the user has voted on this card (optimistically tracked)
  const hasVoted = isOptimisticVoted && !isOptimisticUnvoted;
  const canVote = isVote && participantToken && !hasVoted && !atVoteCap;
  const canUnvote = isVote && participantToken && hasVoted;

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed.length === 0 || trimmed.length > 2000) return;
    if (trimmed === card.text) {
      setIsEditing(false);
      return;
    }
    onEditCard(card.id, trimmed);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(card.text);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-focus)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          maxLength={2000}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSaveEdit();
            }
            if (e.key === 'Escape') {
              handleCancelEdit();
            }
          }}
          style={{
            width: '100%',
            minHeight: '60px',
            padding: 'var(--space-2)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family-sans)',
            resize: 'vertical',
            outline: 'none',
          }}
          aria-label="Edit card text"
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleCancelEdit}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--font-size-sm)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              minHeight: '44px',
              minWidth: '44px',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveEdit}
            disabled={editText.trim().length === 0}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--font-size-sm)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: editText.trim().length > 0 ? 'var(--color-primary-600)' : 'var(--color-neutral-300)',
              color: 'var(--color-text-inverse)',
              cursor: editText.trim().length > 0 ? 'pointer' : 'not-allowed',
              fontWeight: 'var(--font-weight-medium)',
              minHeight: '44px',
              minWidth: '44px',
            }}
            aria-label="Save edit"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '8px',
        padding: 'var(--space-3)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        transition: 'box-shadow var(--transition-fast)',
        minHeight: '56px',
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
          fontSize: 'var(--font-size-sm)',
          lineHeight: 'var(--line-height-normal)',
          color: 'var(--color-text-primary)',
          margin: 0,
          wordBreak: 'break-word',
        }}
      >
        {card.text}
      </p>

      {/* Footer row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
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

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          {/* Edit/Delete buttons during gather phase for own cards */}
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setEditText(card.text);
                setIsEditing(true);
              }}
              style={{
                padding: 'var(--space-1) var(--space-2)',
                fontSize: 'var(--font-size-xs)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                minHeight: '44px',
                minWidth: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Edit card"
            >
              ✏️
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDeleteCard(card.id)}
              style={{
                padding: 'var(--space-1) var(--space-2)',
                fontSize: 'var(--font-size-xs)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-error-700)',
                cursor: 'pointer',
                minHeight: '44px',
                minWidth: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Delete card"
            >
              🗑️
            </button>
          )}

          {/* Vote button during vote phase */}
          {showVotes && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              {canVote && (
                <button
                  type="button"
                  onClick={() => onVote(card.id)}
                  style={{
                    padding: 'var(--space-2)',
                    fontSize: 'var(--font-size-sm)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-primary-300)',
                    backgroundColor: 'var(--color-primary-50)',
                    color: 'var(--color-primary-700)',
                    cursor: 'pointer',
                    minHeight: '44px',
                    minWidth: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'var(--font-weight-medium)',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  aria-label="Vote for this card"
                >
                  👍
                </button>
              )}
              {canUnvote && (
                <button
                  type="button"
                  onClick={() => onUnvote(card.id)}
                  style={{
                    padding: 'var(--space-2)',
                    fontSize: 'var(--font-size-sm)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-primary-600)',
                    backgroundColor: 'var(--color-primary-600)',
                    color: 'var(--color-text-inverse)',
                    cursor: 'pointer',
                    minHeight: '44px',
                    minWidth: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'var(--font-weight-medium)',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  aria-label="Remove vote from this card"
                >
                  👍
                </button>
              )}
              {isVote && atVoteCap && !hasVoted && (
                <button
                  type="button"
                  disabled
                  style={{
                    padding: 'var(--space-2)',
                    fontSize: 'var(--font-size-sm)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-muted)',
                    cursor: 'not-allowed',
                    minHeight: '44px',
                    minWidth: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Vote limit reached"
                >
                  👍
                </button>
              )}
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: card.voteCount > 0 ? 'var(--color-primary-700)' : 'var(--color-text-muted)',
                  minWidth: '20px',
                  textAlign: 'center',
                }}
                aria-label={`${card.voteCount} vote${card.voteCount !== 1 ? 's' : ''}`}
              >
                {card.voteCount}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
