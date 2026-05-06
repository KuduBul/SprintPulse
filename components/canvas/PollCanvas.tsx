'use client';

import { useState, useRef, useCallback, useEffect, DragEvent, MouseEvent } from 'react';

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

interface PollCanvasProps {
  pollId: string;
  questions: Question[];
  backgroundImageUrl: string | null;
  onQuestionPositionChange: (questionId: string, position: Position) => void;
  onQuestionRemoveFromCanvas: (questionId: string) => void;
}

// Default size for newly placed questions (percentage of canvas)
const DEFAULT_WIDTH = 20;
const DEFAULT_HEIGHT = 15;

// Minimum size constraints
const MIN_WIDTH = 8;
const MIN_HEIGHT = 6;

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export function PollCanvas({
  pollId,
  questions,
  backgroundImageUrl,
  onQuestionPositionChange,
  onQuestionRemoveFromCanvas,
}: PollCanvasProps) {
  // Track placement order for z-index
  const [placementOrder, setPlacementOrder] = useState<string[]>(() =>
    questions.filter((q) => q.position !== null).map((q) => q.id)
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    questionId: string;
  } | null>(null);

  // Resize state
  const [resizing, setResizing] = useState<{
    questionId: string;
    corner: 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    startPos: Position;
  } | null>(null);

  // Dragging placed question state
  const [draggingPlaced, setDraggingPlaced] = useState<{
    questionId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Separate placed and unplaced questions
  const placedQuestions = questions.filter((q) => q.position !== null);
  const unplacedQuestions = questions.filter((q) => q.position === null);

  // Update placement order when questions change externally
  useEffect(() => {
    const placedIds = new Set(placedQuestions.map((q) => q.id));
    setPlacementOrder((prev) => {
      // Keep existing order for still-placed questions, add new ones at end
      const filtered = prev.filter((id) => placedIds.has(id));
      const newIds = placedQuestions
        .map((q) => q.id)
        .filter((id) => !filtered.includes(id));
      return [...filtered, ...newIds];
    });
  }, [placedQuestions]);

  // Close context menu on click elsewhere or Escape key
  useEffect(() => {
    function handleClick() {
      setContextMenu(null);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    }
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('click', handleClick);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [contextMenu]);

  // --------------------------------------------------------------------------
  // Drag from sidebar to canvas
  // --------------------------------------------------------------------------

  function handleSidebarDragStart(e: DragEvent<HTMLDivElement>, questionId: string) {
    e.dataTransfer.setData('text/plain', questionId);
    e.dataTransfer.setData('application/x-source', 'sidebar');
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleCanvasDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleCanvasDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const questionId = e.dataTransfer.getData('text/plain');
    const source = e.dataTransfer.getData('application/x-source');

    if (!questionId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    if (source === 'sidebar') {
      // New placement from sidebar — center the card on drop point
      const x = Math.max(0, Math.min(100 - DEFAULT_WIDTH, xPercent - DEFAULT_WIDTH / 2));
      const y = Math.max(0, Math.min(100 - DEFAULT_HEIGHT, yPercent - DEFAULT_HEIGHT / 2));

      const position: Position = {
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
      };

      // Add to placement order (last = on top)
      setPlacementOrder((prev) => [...prev.filter((id) => id !== questionId), questionId]);
      onQuestionPositionChange(questionId, position);
    } else if (source === 'canvas') {
      // Repositioning an existing placed question
      const offsetX = parseFloat(e.dataTransfer.getData('application/x-offset-x') || '0');
      const offsetY = parseFloat(e.dataTransfer.getData('application/x-offset-y') || '0');
      const question = questions.find((q) => q.id === questionId);
      if (!question?.position) return;

      const newX = Math.max(0, Math.min(100 - question.position.width, xPercent - offsetX));
      const newY = Math.max(0, Math.min(100 - question.position.height, yPercent - offsetY));

      const position: Position = {
        x: Math.round(newX * 100) / 100,
        y: Math.round(newY * 100) / 100,
        width: question.position.width,
        height: question.position.height,
      };

      onQuestionPositionChange(questionId, position);
    }
  }

  // --------------------------------------------------------------------------
  // Drag placed questions to reposition
  // --------------------------------------------------------------------------

  function handlePlacedDragStart(e: DragEvent<HTMLDivElement>, question: Question) {
    if (!question.position || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    // Calculate offset from the top-left of the card to the mouse position (in %)
    const cardLeftPx = (question.position.x / 100) * rect.width;
    const cardTopPx = (question.position.y / 100) * rect.height;
    const offsetX = ((e.clientX - rect.left - cardLeftPx) / rect.width) * 100;
    const offsetY = ((e.clientY - rect.top - cardTopPx) / rect.height) * 100;

    e.dataTransfer.setData('text/plain', question.id);
    e.dataTransfer.setData('application/x-source', 'canvas');
    e.dataTransfer.setData('application/x-offset-x', String(offsetX));
    e.dataTransfer.setData('application/x-offset-y', String(offsetY));
    e.dataTransfer.effectAllowed = 'move';
  }

  // --------------------------------------------------------------------------
  // Resize handles
  // --------------------------------------------------------------------------

  const handleResizeStart = useCallback(
    (e: MouseEvent, questionId: string, corner: 'nw' | 'ne' | 'sw' | 'se') => {
      e.preventDefault();
      e.stopPropagation();
      const question = questions.find((q) => q.id === questionId);
      if (!question?.position) return;

      setResizing({
        questionId,
        corner,
        startX: e.clientX,
        startY: e.clientY,
        startPos: { ...question.position },
      });
    },
    [questions]
  );

  useEffect(() => {
    if (!resizing) return;

    function handleMouseMove(e: globalThis.MouseEvent) {
      if (!resizing || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const deltaXPercent = ((e.clientX - resizing.startX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - resizing.startY) / rect.height) * 100;

      let { x, y, width, height } = resizing.startPos;

      switch (resizing.corner) {
        case 'se':
          width = Math.max(MIN_WIDTH, Math.min(100 - x, width + deltaXPercent));
          height = Math.max(MIN_HEIGHT, Math.min(100 - y, height + deltaYPercent));
          break;
        case 'sw':
          const newWidthSW = Math.max(MIN_WIDTH, width - deltaXPercent);
          const newXSW = x + (width - newWidthSW);
          x = Math.max(0, newXSW);
          width = Math.min(newWidthSW, x + newWidthSW > 100 ? 100 - x : newWidthSW);
          height = Math.max(MIN_HEIGHT, Math.min(100 - y, height + deltaYPercent));
          break;
        case 'ne':
          width = Math.max(MIN_WIDTH, Math.min(100 - x, width + deltaXPercent));
          const newHeightNE = Math.max(MIN_HEIGHT, height - deltaYPercent);
          const newYNE = y + (height - newHeightNE);
          y = Math.max(0, newYNE);
          height = Math.min(newHeightNE, y + newHeightNE > 100 ? 100 - y : newHeightNE);
          break;
        case 'nw':
          const newWidthNW = Math.max(MIN_WIDTH, width - deltaXPercent);
          const newXNW = x + (width - newWidthNW);
          x = Math.max(0, newXNW);
          width = Math.min(newWidthNW, x + newWidthNW > 100 ? 100 - x : newWidthNW);
          const newHeightNW = Math.max(MIN_HEIGHT, height - deltaYPercent);
          const newYNW = y + (height - newHeightNW);
          y = Math.max(0, newYNW);
          height = Math.min(newHeightNW, y + newHeightNW > 100 ? 100 - y : newHeightNW);
          break;
      }

      const position: Position = {
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        width: Math.round(width * 100) / 100,
        height: Math.round(height * 100) / 100,
      };

      onQuestionPositionChange(resizing.questionId, position);
    }

    function handleMouseUp() {
      setResizing(null);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, onQuestionPositionChange]);

  // --------------------------------------------------------------------------
  // Context menu
  // --------------------------------------------------------------------------

  function handleContextMenu(e: MouseEvent, questionId: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, questionId });
  }

  function handlePlacedKeyDown(e: React.KeyboardEvent, questionId: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      setContextMenu({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, questionId });
    }
  }

  function handleRemoveFromCanvas() {
    if (contextMenu) {
      onQuestionRemoveFromCanvas(contextMenu.questionId);
      setPlacementOrder((prev) => prev.filter((id) => id !== contextMenu.questionId));
      setContextMenu(null);
    }
  }

  // --------------------------------------------------------------------------
  // Z-index helper
  // --------------------------------------------------------------------------

  function getZIndex(questionId: string): number {
    const index = placementOrder.indexOf(questionId);
    return index >= 0 ? index + 1 : 1;
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-4)',
        height: '600px',
        fontFamily: 'var(--font-family-sans)',
      }}
    >
      {/* Sidebar — unplaced questions */}
      <aside
        style={{
          width: '240px',
          minWidth: '240px',
          overflowY: 'auto',
          padding: 'var(--space-3)',
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-default)',
        }}
        aria-label="Unplaced questions"
      >
        <h3
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Unplaced Questions
        </h3>
        {unplacedQuestions.length === 0 && (
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)',
            }}
          >
            All questions placed on canvas.
          </p>
        )}
        {unplacedQuestions.map((question) => (
          <div
            key={question.id}
            draggable
            onDragStart={(e) => handleSidebarDragStart(e, question.id)}
            style={{
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-2)',
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-md)',
              cursor: 'grab',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-primary)',
              userSelect: 'none',
              transition: 'box-shadow var(--transition-fast)',
            }}
            role="listitem"
            aria-label={`Drag question: ${question.text}`}
          >
            <span
              style={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {question.text}
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-muted)',
                marginTop: 'var(--space-1)',
                display: 'block',
              }}
            >
              {question.options.length} options
            </span>
          </div>
        ))}
      </aside>

      {/* Canvas area */}
      <div
        ref={canvasRef}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
        style={{
          flex: 1,
          position: 'relative',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '2px dashed var(--color-border-strong)',
          backgroundColor: backgroundImageUrl ? undefined : 'var(--color-bg-canvas)',
          backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
        role="application"
        aria-label="Poll canvas editor"
      >
        {/* Grey placeholder when no background */}
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
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-1)' }}>
              Drag questions here to place them
            </p>
          </div>
        )}

        {/* Placed questions */}
        {placedQuestions.map((question) => {
          const pos = question.position!;
          const zIndex = getZIndex(question.id);

          return (
            <div
              key={question.id}
              draggable
              onDragStart={(e) => handlePlacedDragStart(e, question)}
              onContextMenu={(e) => handleContextMenu(e, question.id)}
              onKeyDown={(e) => handlePlacedKeyDown(e, question.id)}
              style={{
                position: 'absolute',
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${pos.width}%`,
                height: `${pos.height}%`,
                zIndex,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2)',
                cursor: 'grab',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                userSelect: 'none',
              }}
              aria-label={question.text}
              role="button"
              tabIndex={0}
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

              {/* Corner resize handles */}
              <ResizeHandle
                corner="nw"
                onMouseDown={(e) => handleResizeStart(e, question.id, 'nw')}
              />
              <ResizeHandle
                corner="ne"
                onMouseDown={(e) => handleResizeStart(e, question.id, 'ne')}
              />
              <ResizeHandle
                corner="sw"
                onMouseDown={(e) => handleResizeStart(e, question.id, 'sw')}
              />
              <ResizeHandle
                corner="se"
                onMouseDown={(e) => handleResizeStart(e, question.id, 'se')}
              />
            </div>
          );
        })}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: 'var(--space-1)',
            minWidth: '180px',
          }}
          role="menu"
          aria-label="Question actions"
        >
          <button
            onClick={handleRemoveFromCanvas}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setContextMenu(null);
              }
            }}
            autoFocus
            role="menuitem"
            style={{
              display: 'block',
              width: '100%',
              padding: 'var(--space-2) var(--space-3)',
              border: 'none',
              backgroundColor: 'transparent',
              textAlign: 'left',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-error-600)',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Remove from canvas
          </button>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Resize Handle sub-component
// --------------------------------------------------------------------------

interface ResizeHandleProps {
  corner: 'nw' | 'ne' | 'sw' | 'se';
  onMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
}

function ResizeHandle({ corner, onMouseDown }: ResizeHandleProps) {
  const positionStyles: Record<string, string> = {};
  let cursor = '';

  switch (corner) {
    case 'nw':
      positionStyles.top = '0';
      positionStyles.left = '0';
      cursor = 'nw-resize';
      break;
    case 'ne':
      positionStyles.top = '0';
      positionStyles.right = '0';
      cursor = 'ne-resize';
      break;
    case 'sw':
      positionStyles.bottom = '0';
      positionStyles.left = '0';
      cursor = 'sw-resize';
      break;
    case 'se':
      positionStyles.bottom = '0';
      positionStyles.right = '0';
      cursor = 'se-resize';
      break;
  }

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        width: '10px',
        height: '10px',
        backgroundColor: 'var(--color-primary-500)',
        borderRadius: 'var(--radius-full)',
        cursor,
        ...positionStyles,
        transform: 'translate(-50%, -50%)',
        // Adjust transform based on corner
        ...(corner === 'nw' && { transform: 'translate(-25%, -25%)' }),
        ...(corner === 'ne' && { transform: 'translate(25%, -25%)' }),
        ...(corner === 'sw' && { transform: 'translate(-25%, 25%)' }),
        ...(corner === 'se' && { transform: 'translate(25%, 25%)' }),
      }}
      aria-hidden="true"
    />
  );
}
