'use client';

import { useEffect, useRef, useCallback } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiMartEmojiData {
  native: string;
  id: string;
  name: string;
}

// --------------------------------------------------------------------------
// EmojiPicker
// --------------------------------------------------------------------------

/**
 * Floating emoji picker panel wrapping emoji-mart. Renders absolutely
 * positioned above other content. Escape key or clicking outside closes it.
 */
export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  // Close on click outside
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleKeyDown, handleClickOutside]);

  const handleEmojiSelect = (emoji: EmojiMartEmojiData) => {
    if (emoji.native) {
      onSelect(emoji.native);
    }
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Emoji picker"
      aria-modal="true"
      style={{
        position: 'absolute',
        zIndex: 1000,
        top: '100%',
        left: 0,
        marginTop: 'var(--space-2)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden',
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-default)',
      }}
    >
      <Picker
        data={data}
        onEmojiSelect={handleEmojiSelect}
        theme="light"
        previewPosition="none"
        skinTonePosition="none"
        maxFrequentRows={2}
        perLine={8}
      />
    </div>
  );
}
